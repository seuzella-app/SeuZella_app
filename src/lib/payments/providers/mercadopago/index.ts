import { MP_ACCESS_TOKEN, PAYMENT_WEBHOOK_SECRET } from '@/lib/env';
import type { CreatePaymentInput, CreatePaymentResult, IPaymentGateway, PaymentStatus, WebhookEvent, WebhookVerificationContext } from '../../types';
import { PaymentGatewayError } from '../../types';

type MercadoPagoConfig = { accessToken: string; options?: { timeout?: number } };
interface MPPaymentResponse {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_process' | 'authorized';
  status_detail?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  transaction_details?: { external_resource_url?: string };
  external_reference?: string;
  transaction_amount?: number;
}

export class MercadoPagoGateway implements IPaymentGateway {
  readonly id = 'mercadopago' as const;
  private cachedClient: unknown = null;
  isConfigured(): boolean { return Boolean(MP_ACCESS_TOKEN) && !MP_ACCESS_TOKEN.startsWith('TEST-xxxxx'); }

  private async getClient(): Promise<unknown> {
    if (this.cachedClient) return this.cachedClient;
    if (!this.isConfigured()) throw new PaymentGatewayError('MercadoPago access token not configured', 'mercadopago', 'NOT_CONFIGURED');
    const mp = await import('mercadopago');
    const Config = (mp as { MercadoPagoConfig: new (cfg: MercadoPagoConfig) => unknown }).MercadoPagoConfig;
    this.cachedClient = new Config({ accessToken: MP_ACCESS_TOKEN });
    return this.cachedClient;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) throw new PaymentGatewayError('MercadoPago not configured — set MP_ACCESS_TOKEN', 'mercadopago', 'NOT_CONFIGURED');
    const client = await this.getClient();
    const mp = await import('mercadopago');
    const Payment = (mp as { Payment: new (c: unknown) => { create: (args: { body: unknown; requestOptions?: { idempotencyKey?: string } }) => Promise<MPPaymentResponse> } }).Payment;
    const payment = new Payment(client);
    const [firstName, ...lastNameParts] = input.customer.name.split(' ');
    const body: Record<string, unknown> = {
      transaction_amount: input.amount,
      description: input.description,
      payer: {
        email: input.customer.email,
        first_name: firstName,
        last_name: lastNameParts.join(' ') || firstName,
        ...(input.customer.document ? { identification:{ type:input.customer.document.length>11?'CNPJ':'CPF', number:input.customer.document } } : {}),
      },
      external_reference: input.subscriptionId,
      notification_url: input.webhookUrl,
    };
    if (input.paymentMethod === 'pix') body.payment_method_id = 'pix';
    else if (input.paymentMethod === 'boleto') { body.payment_method_id = 'bolbradesco'; body.date_of_expiration = new Date(Date.now()+3*24*60*60*1000).toISOString(); }
    else throw new PaymentGatewayError('Card payment requires Checkout Preference flow', 'mercadopago', 'CARD_REQUIRES_PREFERENCE', 400);

    try {
      const result = await payment.create({ body, requestOptions:{ idempotencyKey:`zella:${input.subscriptionId}:${input.paymentMethod}` } });
      return this.normalizeResponse(result);
    } catch (err) {
      throw new PaymentGatewayError(err instanceof Error ? err.message : 'MercadoPago createPayment failed', 'mercadopago', 'CREATE_FAILED', (err as { statusCode?: number })?.statusCode, err);
    }
  }

  private normalizeStatus(s: string): PaymentStatus {
    return ({ pending:'pending', approved:'approved', authorized:'authorized', in_process:'in_progress', rejected:'rejected', cancelled:'cancelled', refunded:'refunded' } as Record<string, PaymentStatus>)[s] ?? 'unknown';
  }

  private normalizeResponse(r: MPPaymentResponse): CreatePaymentResult {
    const result: CreatePaymentResult = { gateway:'mercadopago', gatewayPaymentId:String(r.id), status:this.normalizeStatus(r.status), raw:r };
    const td = r.point_of_interaction?.transaction_data;
    if (td?.qr_code) { result.pix = { qrCode:td.qr_code, qrCodeBase64:td.qr_code_base64, expiresAt:new Date(Date.now()+30*60*1000).toISOString() }; if (td.ticket_url) result.checkoutUrl=td.ticket_url; }
    if (r.transaction_details?.external_resource_url) { result.boleto={ url:r.transaction_details.external_resource_url, expiresAt:new Date(Date.now()+3*24*60*60*1000).toISOString() }; result.checkoutUrl=r.transaction_details.external_resource_url; }
    return result;
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) throw new PaymentGatewayError('MercadoPago not configured', 'mercadopago', 'NOT_CONFIGURED');
    const client = await this.getClient(); const mp = await import('mercadopago');
    const Payment = (mp as { Payment: new (c: unknown) => { get: (args:{id:string}) => Promise<MPPaymentResponse> } }).Payment;
    try { return this.normalizeStatus((await new Payment(client).get({id:gatewayPaymentId})).status); }
    catch (err) { throw new PaymentGatewayError('Failed to fetch MP payment status', 'mercadopago', 'GET_FAILED', (err as {statusCode?:number})?.statusCode, err); }
  }

  async verifyWebhook(_payload: string | Buffer, signature: string, context?: WebhookVerificationContext): Promise<boolean> {
    if (!PAYMENT_WEBHOOK_SECRET || !signature || !context?.requestId || !context?.dataId) return false;
    const parts = signature.split(',').map(p => p.trim());
    const ts = parts.find(p => p.startsWith('ts='))?.slice(3);
    const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
    if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
    const ageMs = Date.now() - Number(ts) * 1000;
    if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000 || ageMs < -60 * 1000) return false;
    const manifest = `id:${context.dataId};request-id:${context.requestId};ts:${ts};`;
    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', PAYMENT_WEBHOOK_SECRET).update(manifest, 'utf8').digest('hex');
    try {
      const received = Buffer.from(v1, 'hex'); const expectedBuf = Buffer.from(expected, 'hex');
      return received.length === expectedBuf.length && crypto.timingSafeEqual(received, expectedBuf);
    } catch { return false; }
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent> {
    try {
      const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
      const paymentId = String(body?.data?.id ?? body?.id ?? '');
      if (!paymentId) throw new PaymentGatewayError('MP webhook missing payment ID', 'mercadopago', 'MALFORMED', 400);
      const status = await this.getPaymentStatus(paymentId);
      const client = await this.getClient(); const mp = await import('mercadopago');
      const Payment = (mp as { Payment: new (c: unknown) => { get: (args:{id:string}) => Promise<MPPaymentResponse> } }).Payment;
      const full = await new Payment(client).get({id:paymentId});
      return { gateway:'mercadopago', event:body?.action ?? body?.type ?? 'payment.update', gatewayPaymentId:paymentId, subscriptionId:full.external_reference ?? '', status, amount:full.transaction_amount, receivedAt:new Date().toISOString(), raw:body };
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err;
      throw new PaymentGatewayError('Failed to parse MP webhook', 'mercadopago', 'PARSE_FAILED', 400, err);
    }
  }
}
