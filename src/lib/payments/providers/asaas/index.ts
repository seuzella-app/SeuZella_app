import { ASAAS_ACCESS_TOKEN, ASAAS_ENVIRONMENT, ASAAS_WEBHOOK_SECRET } from '@/lib/env';
import type { CreatePaymentInput, CreatePaymentResult, IPaymentGateway, PaymentStatus, WebhookEvent, WebhookVerificationContext } from '../../types';
import { PaymentGatewayError } from '../../types';

const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/v3';
interface AsaasCustomer { id: string; }
interface AsaasPaymentResponse {
  id: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'CHARGEBACK_REVERSED' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  pixCopyAndPaste?: string;
  pixExpirationDate?: string;
  value: number;
  externalReference?: string;
}

function referenceOf(input: CreatePaymentInput): string {
  return input.referenceId || input.subscriptionId || '';
}

export class AsaasGateway implements IPaymentGateway {
  readonly id = 'asaas' as const;
  isConfigured(): boolean { return Boolean(ASAAS_ACCESS_TOKEN) && !ASAAS_ACCESS_TOKEN.startsWith('$'); }
  private authHeaders(): HeadersInit {
    return {
      access_token: ASAAS_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'SeuZella/1.0 (+https://seuzella.com.br)',
    };
  }

  private async ensureCustomer(input: CreatePaymentInput): Promise<string> {
    const listRes = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(input.customer.email)}`, { headers: this.authHeaders() });
    if (!listRes.ok) throw new PaymentGatewayError(`Asaas customer list failed: ${listRes.status}`, 'asaas', 'CUSTOMER_LIST_FAILED', listRes.status);
    const listBody = (await listRes.json()) as { data?: AsaasCustomer[] };
    if (listBody.data?.length) return listBody.data[0].id;
    const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        cpfCnpj: input.customer.document,
        externalReference: input.tenantId,
        notificationDisabled: true,
      }),
    });
    if (!createRes.ok) throw new PaymentGatewayError(`Asaas customer creation failed: ${await createRes.text()}`, 'asaas', 'CUSTOMER_CREATE_FAILED', createRes.status);
    return ((await createRes.json()) as AsaasCustomer).id;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const referenceId = referenceOf(input);
    if (!referenceId) throw new PaymentGatewayError('Payment reference id is required', 'asaas', 'REFERENCE_ID_MISSING');
    if (!this.isConfigured()) throw new PaymentGatewayError('Asaas not configured — set ASAAS_ACCESS_TOKEN', 'asaas', 'NOT_CONFIGURED');
    const customerId = await this.ensureCustomer(input);
    const billingType = input.paymentMethod === 'pix' ? 'PIX' : input.paymentMethod === 'cartao' ? 'CREDIT_CARD' : 'BOLETO';
    const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: input.amount,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: input.description,
        externalReference: referenceId,
        callbackUrl: input.webhookUrl,
      }),
    });
    if (!res.ok) throw new PaymentGatewayError(`Asaas payment creation failed: ${await res.text()}`, 'asaas', 'CREATE_FAILED', res.status);
    return this.normalizeResponse((await res.json()) as AsaasPaymentResponse);
  }

  private normalizeStatus(s: string): PaymentStatus {
    return ({
      PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending', RECEIVED: 'approved', CONFIRMED: 'approved',
      RECEIVED_IN_CASH: 'approved', OVERDUE: 'rejected', REFUNDED: 'refunded', REFUND_REQUESTED: 'refunded',
      CHARGEBACK_REQUESTED: 'refunded', CHARGEBACK_DISPUTE: 'refunded', CHARGEBACK_REVERSED: 'approved',
      DUNNING_REQUESTED: 'in_progress', DUNNING_RECEIVED: 'approved',
    } as Record<string, PaymentStatus>)[s] ?? 'unknown';
  }

  private normalizeResponse(r: AsaasPaymentResponse): CreatePaymentResult {
    const result: CreatePaymentResult = { gateway: 'asaas', gatewayPaymentId: r.id, status: this.normalizeStatus(r.status), raw: r };
    if (r.pixQrCode || r.pixCopyAndPaste) result.pix = { qrCode: (r.pixCopyAndPaste ?? r.pixQrCode) as string, expiresAt: r.pixExpirationDate };
    if (r.invoiceUrl) result.checkoutUrl = r.invoiceUrl;
    if (r.bankSlipUrl) {
      result.boleto = { url: r.bankSlipUrl, expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() };
      result.checkoutUrl = r.bankSlipUrl;
    }
    return result;
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) throw new PaymentGatewayError('Asaas not configured', 'asaas', 'NOT_CONFIGURED');
    const res = await fetch(`${ASAAS_BASE_URL}/payments/${gatewayPaymentId}`, { headers: this.authHeaders() });
    if (!res.ok) throw new PaymentGatewayError(`Asaas getPaymentStatus failed: ${res.status}`, 'asaas', 'GET_FAILED', res.status);
    return this.normalizeStatus(((await res.json()) as AsaasPaymentResponse).status);
  }

  async verifyWebhook(_payload: string | Buffer, signature: string, _context?: WebhookVerificationContext): Promise<boolean> {
    if (!ASAAS_WEBHOOK_SECRET || !signature) return false;
    const crypto = await import('crypto');
    const received = Buffer.from(signature.trim(), 'utf8');
    const expected = Buffer.from(ASAAS_WEBHOOK_SECRET, 'utf8');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent> {
    try {
      const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
      const paymentId = String(body?.payment?.id ?? '');
      const providerEventId = String(body?.id ?? '');
      if (!providerEventId) throw new PaymentGatewayError('Asaas webhook missing event.id', 'asaas', 'MALFORMED', 400);
      if (!paymentId) throw new PaymentGatewayError('Asaas webhook missing payment.id', 'asaas', 'MALFORMED', 400);
      const res = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers: this.authHeaders() });
      if (!res.ok) throw new PaymentGatewayError(`Asaas payment lookup failed: ${res.status}`, 'asaas', 'LOOKUP_FAILED', res.status);
      const full = (await res.json()) as AsaasPaymentResponse;
      const referenceId = full.externalReference ?? '';
      return {
        gateway: 'asaas', providerEventId, event: body?.event ?? 'payment.update', gatewayPaymentId: paymentId,
        referenceId, referenceType: undefined, subscriptionId: referenceId || undefined,
        status: this.normalizeStatus(full.status), amount: full.value, receivedAt: new Date().toISOString(), raw: body,
      };
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err;
      throw new PaymentGatewayError('Failed to parse Asaas webhook', 'asaas', 'PARSE_FAILED', 400, err);
    }
  }
}
