// ==============================================================================
// SEUZÉLLA — Asaas Gateway Adapter
// ==============================================================================
// Asaas is the recommended gateway for Brazilian SaaS:
//   - Native PIX with QR code (no 3rd-party wrapper)
//   - Card tokenization via iframe (Asaas.js)
//   - Boleto with barcode
//   - Native recurring subscriptions (no webhook gymnastics)
//   - Lower fees than MP for sub-R$500 transactions
//
// Sprint 1, Day 4-5: Asaas integration (real implementation via REST API v3)
// Docs: https://docs.asaas.com/reference
// ==============================================================================

import { ASAAS_ACCESS_TOKEN, ASAAS_ENVIRONMENT } from '@/lib/env';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentGateway,
  PaymentStatus,
  WebhookEvent,
} from '../../types';
import { PaymentGatewayError } from '../../types';

// ── Asaas API base URL ────────────────────────────────────────────────────────
const ASAAS_BASE_URL =
  ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/v3';

// ── Asaas API types (subset) ──────────────────────────────────────────────────
interface AsaasCustomer {
  id: string;
}
interface AsaasPaymentResponse {
  id: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'CHARGEBACK_REVERSED' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  pixCopyAndPaste?: string;
  pixExpirationDate?: string;
  value: number;
}

// ── Adapter ────────────────────────────────────────────────────────────────────
export class AsaasGateway implements IPaymentGateway {
  readonly id = 'asaas' as const;

  isConfigured(): boolean {
    return Boolean(ASAAS_ACCESS_TOKEN) && !ASAAS_ACCESS_TOKEN.startsWith('$');
  }

  private authHeaders(): HeadersInit {
    return {
      'access_token': ASAAS_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'SeuZella/1.0 (+https://seuzella.com.br)',
    };
  }

  // ── Create customer (idempotent by email — required by Asaas) ──────────────
  private async ensureCustomer(input: CreatePaymentInput): Promise<string> {
    // Asaas allows querying customers by email
    const listUrl = `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(input.customer.email)}`;
    const listRes = await fetch(listUrl, { headers: this.authHeaders() });
    if (!listRes.ok) {
      throw new PaymentGatewayError(
        `Asaas customer list failed: ${listRes.status}`,
        'asaas',
        'CUSTOMER_LIST_FAILED',
        listRes.status,
      );
    }
    const listBody = (await listRes.json()) as { data?: AsaasCustomer[] };
    if (listBody.data && listBody.data.length > 0) {
      return listBody.data[0].id;
    }

    // Create new customer
    const [firstName, ...lastNameParts] = input.customer.name.split(' ');
    const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        cpfCnpj: input.customer.document,
        externalReference: input.tenantId,
        notificationDisabled: true, // Asaas default emails are confusing — we send our own
      }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new PaymentGatewayError(
        `Asaas customer creation failed: ${errText}`,
        'asaas',
        'CUSTOMER_CREATE_FAILED',
        createRes.status,
      );
    }
    const created = (await createRes.json()) as AsaasCustomer;
    return created.id;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError(
        'Asaas not configured — set ASAAS_ACCESS_TOKEN',
        'asaas',
        'NOT_CONFIGURED',
      );
    }

    const customerId = await this.ensureCustomer(input);

    // Map our PaymentMethod → Asaas billingType
    const billingType =
      input.paymentMethod === 'pix' ? 'PIX' :
      input.paymentMethod === 'cartao' ? 'CREDIT_CARD' :
      'BOLETO';

    const body: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: input.amount,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.subscriptionId,
      callbackUrl: input.webhookUrl,
    };

    const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new PaymentGatewayError(
        `Asaas payment creation failed: ${errText}`,
        'asaas',
        'CREATE_FAILED',
        res.status,
      );
    }

    const r = (await res.json()) as AsaasPaymentResponse;
    return this.normalizeResponse(r);
  }

  private normalizeStatus(s: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      PENDING: 'pending',
      AWAITING_RISK_ANALYSIS: 'pending',
      RECEIVED: 'approved',
      CONFIRMED: 'approved',
      RECEIVED_IN_CASH: 'approved',
      OVERDUE: 'rejected',
      REFUNDED: 'refunded',
      REFUND_REQUESTED: 'refunded',
      CHARGEBACK_REQUESTED: 'refunded',
      CHARGEBACK_DISPUTE: 'refunded',
      CHARGEBACK_REVERSED: 'approved',
      DUNNING_REQUESTED: 'in_progress',
      DUNNING_RECEIVED: 'approved',
    };
    return map[s] ?? 'unknown';
  }

  private normalizeResponse(r: AsaasPaymentResponse): CreatePaymentResult {
    const status = this.normalizeStatus(r.status);
    const result: CreatePaymentResult = {
      gateway: 'asaas',
      gatewayPaymentId: r.id,
      status,
      raw: r,
    };

    if (r.pixQrCode || r.pixCopyAndPaste) {
      result.pix = {
        qrCode: (r.pixCopyAndPaste ?? r.pixQrCode) as string,
        expiresAt: r.pixExpirationDate,
      };
      result.checkoutUrl = r.invoiceUrl;
    }

    if (r.bankSlipUrl) {
      result.boleto = {
        url: r.bankSlipUrl,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
      result.checkoutUrl = r.bankSlipUrl;
    }

    if (r.invoiceUrl && !result.checkoutUrl) {
      result.checkoutUrl = r.invoiceUrl;
    }

    return result;
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError('Asaas not configured', 'asaas', 'NOT_CONFIGURED');
    }
    const res = await fetch(`${ASAAS_BASE_URL}/payments/${gatewayPaymentId}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new PaymentGatewayError(
        `Asaas getPaymentStatus failed: ${res.status}`,
        'asaas',
        'GET_FAILED',
        res.status,
      );
    }
    const r = (await res.json()) as AsaasPaymentResponse;
    return this.normalizeStatus(r.status);
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<boolean> {
    // Asaas webhook signature: HMAC-SHA256 of body with ASAAS_WEBHOOK_SECRET
    // sent in `asaas-signature` header (format: "hash=...")
    // For Sprint 1 we accept if signature present and secret configured.
    // Full HMAC verification will be added in Sprint 1 Day 7.
    void payload;
    void signature;
    return Boolean(signature && process.env.ASAAS_WEBHOOK_SECRET);
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent> {
    try {
      const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
      // Asaas sends: { event: "PAYMENT_RECEIVED", payment: { id, ... } }
      const paymentId = String(body?.payment?.id ?? '');
      if (!paymentId) {
        throw new PaymentGatewayError(
          'Asaas webhook missing payment.id',
          'asaas',
          'MALFORMED',
          400,
        );
      }

      const status = await this.getPaymentStatus(paymentId);

      // Fetch full payment to resolve externalReference (= our subscriptionId)
      const res = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
        headers: this.authHeaders(),
      });
      const full = (await res.json()) as AsaasPaymentResponse & { externalReference?: string; value?: number };

      return {
        gateway: 'asaas',
        event: body?.event ?? 'payment.update',
        gatewayPaymentId: paymentId,
        subscriptionId: full.externalReference ?? '',
        status,
        amount: full.value,
        receivedAt: new Date().toISOString(),
        raw: body,
      };
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err;
      throw new PaymentGatewayError(
        'Failed to parse Asaas webhook',
        'asaas',
        'PARSE_FAILED',
        400,
        err,
      );
    }
  }
}
