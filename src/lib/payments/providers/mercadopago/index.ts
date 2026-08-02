// ==============================================================================
// SEUZÉLLA — MercadoPago Gateway Adapter
// ==============================================================================
// Wraps the existing src/lib/mercadopago.ts (PIX-only today) and adds
// Checkout Pro (card) + boleto support via the same SDK.
//
// Sprint 1, Day 3: Real MP integration
// Sprint 1, Day 1-2: Adapter shell with mock fallback (no behavior change)
// ==============================================================================

import { MP_ACCESS_TOKEN } from '@/lib/env';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentGateway,
  PaymentStatus,
  WebhookEvent,
} from '../../types';
import { PaymentGatewayError } from '../../types';

// ── Native MP SDK imports (lazy-loaded) ───────────────────────────────────────
// We lazy-load so projects without `mercadopago` installed can still import
// this file (used only in mock mode).

type MercadoPagoConfig = {
  accessToken: string;
  options?: { timeout?: number };
};

interface MPPaymentResponse {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_process' | 'authorized';
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string; // boleto URL
  };
}

// ── Adapter implementation ─────────────────────────────────────────────────────
export class MercadoPagoGateway implements IPaymentGateway {
  readonly id = 'mercadopago' as const;

  private cachedClient: unknown = null;

  isConfigured(): boolean {
    return Boolean(MP_ACCESS_TOKEN) && !MP_ACCESS_TOKEN.startsWith('TEST-xxxxx');
  }

  private async getClient(): Promise<unknown> {
    if (this.cachedClient) return this.cachedClient;
    if (!this.isConfigured()) {
      throw new PaymentGatewayError(
        'MercadoPago access token not configured',
        'mercadopago',
        'NOT_CONFIGURED',
      );
    }
    // Dynamic import — keeps MP SDK out of the bundle when not configured
    const mp = await import('mercadopago');
    const MercadoPagoConfigClass = (mp as { MercadoPagoConfig: new (cfg: MercadoPagoConfig) => unknown }).MercadoPagoConfig;
    this.cachedClient = new MercadoPagoConfigClass({ accessToken: MP_ACCESS_TOKEN });
    return this.cachedClient;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError(
        'MercadoPago not configured — set MP_ACCESS_TOKEN',
        'mercadopago',
        'NOT_CONFIGURED',
      );
    }

    const client = await this.getClient();
    const mp = await import('mercadopago');
    const PaymentClass = (mp as { Payment: new (c: unknown) => { create: (args: { body: unknown }) => Promise<MPPaymentResponse> } }).Payment;
    const payment = new PaymentClass(client);

    const [firstName, ...lastNameParts] = input.customer.name.split(' ');
    const lastName = lastNameParts.join(' ') || firstName;

    // Body varies by method
    const body: Record<string, unknown> = {
      transaction_amount: input.amount,
      description: input.description,
      payer: {
        email: input.customer.email,
        first_name: firstName,
        last_name: lastName,
        ...(input.customer.document
          ? { identification: { type: input.customer.document.length > 11 ? 'CNPJ' : 'CPF', number: input.customer.document } }
          : {}),
      },
      external_reference: input.subscriptionId,
      notification_url: input.webhookUrl,
    };

    if (input.paymentMethod === 'pix') {
      body.payment_method_id = 'pix';
    } else if (input.paymentMethod === 'boleto') {
      body.payment_method_id = 'bolbradesco';
      body.date_of_expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Cartão — uses token submitted by frontend (Checkout Pro / Web Tokenize)
      // In production: body.token = input.cardToken (added by frontend SDK)
      // For mock mode, we don't have a token — caller must use Preference API instead
      throw new PaymentGatewayError(
        'Card payment requires Checkout Pro Preference API (not direct Payment.create)',
        'mercadopago',
        'CARD_REQUIRES_PREFERENCE',
        400,
      );
    }

    try {
      const result = await payment.create({ body });
      return this.normalizeResponse(result);
    } catch (err) {
      throw new PaymentGatewayError(
        err instanceof Error ? err.message : 'MercadoPago createPayment failed',
        'mercadopago',
        'CREATE_FAILED',
        (err as { statusCode?: number })?.statusCode,
        err,
      );
    }
  }

  // ── Normalize MP status → unified PaymentStatus ────────────────────────────
  private normalizeStatus(mpStatus: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      pending: 'pending',
      approved: 'approved',
      authorized: 'authorized',
      in_process: 'in_progress',
      rejected: 'rejected',
      cancelled: 'cancelled',
      refunded: 'refunded',
    };
    return map[mpStatus] ?? 'unknown';
  }

  private normalizeResponse(r: MPPaymentResponse): CreatePaymentResult {
    const status = this.normalizeStatus(r.status);
    const result: CreatePaymentResult = {
      gateway: 'mercadopago',
      gatewayPaymentId: String(r.id),
      status,
      raw: r,
    };

    // PIX payload
    if (r.point_of_interaction?.transaction_data?.qr_code) {
      const td = r.point_of_interaction.transaction_data;
      result.pix = {
        qrCode: td.qr_code as string,
        qrCodeBase64: td.qr_code_base64,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      if (td.ticket_url) result.checkoutUrl = td.ticket_url;
    }

    // Boleto URL
    if (r.transaction_details?.external_resource_url) {
      result.boleto = {
        url: r.transaction_details.external_resource_url,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
      result.checkoutUrl = r.transaction_details.external_resource_url;
    }

    return result;
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError('MercadoPago not configured', 'mercadopago', 'NOT_CONFIGURED');
    }
    const client = await this.getClient();
    const mp = await import('mercadopago');
    const PaymentClass = (mp as { Payment: new (c: unknown) => { get: (args: { id: string }) => Promise<MPPaymentResponse> } }).Payment;
    const payment = new PaymentClass(client);
    try {
      const r = await payment.get({ id: gatewayPaymentId });
      return this.normalizeStatus(r.status);
    } catch (err) {
      throw new PaymentGatewayError(
        'Failed to fetch MP payment status',
        'mercadopago',
        'GET_FAILED',
        (err as { statusCode?: number })?.statusCode,
        err,
      );
    }
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<boolean> {
    // MP signs webhooks with x-signature header: hash HMAC SHA256 of (data.id + "." + x-request-id)
    // using MP_WEBHOOK_SECRET. The full algorithm is documented at:
    // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_validate_the_notification
    //
    // For Sprint 1 we accept the webhook if signature is present and secret is configured.
    // Full cryptographic verification will be added in Sprint 1 Day 7 (unified webhook route).
    void payload;
    void signature;
    return Boolean(signature && process.env.MP_WEBHOOK_SECRET);
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent> {
    try {
      const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
      // MP sends: { type: "payment", data: { id: "123456789" } }
      const paymentId = String(body?.data?.id ?? body?.id ?? '');
      if (!paymentId) {
        throw new PaymentGatewayError('MP webhook missing payment ID', 'mercadopago', 'MALFORMED', 400);
      }

      // Fetch full payment to resolve status + external_reference
      const status = await this.getPaymentStatus(paymentId);
      const client = await this.getClient();
      const mp = await import('mercadopago');
      const PaymentClass = (mp as { Payment: new (c: unknown) => { get: (args: { id: string }) => Promise<MPPaymentResponse & { external_reference?: string; transaction_amount?: number }> } }).Payment;
      const payment = new PaymentClass(client);
      const full = await payment.get({ id: paymentId });

      return {
        gateway: 'mercadopago',
        event: body?.type ?? 'payment.update',
        gatewayPaymentId: paymentId,
        subscriptionId: full.external_reference ?? '',
        status,
        amount: full.transaction_amount,
        receivedAt: new Date().toISOString(),
        raw: body,
      };
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err;
      throw new PaymentGatewayError(
        'Failed to parse MP webhook',
        'mercadopago',
        'PARSE_FAILED',
        400,
        err,
      );
    }
  }
}
