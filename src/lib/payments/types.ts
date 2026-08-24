// ==============================================================================
// SEUZÉLLA — Unified Payment Gateway Contract
// Production payment scope: Asaas + Mercado Pago. Mock is test/development only.
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';

export type PaymentMethod = 'pix' | 'cartao' | 'boleto';
export type GatewayId = 'mercadopago' | 'asaas' | 'mock';
export type PaymentReferenceType = 'subscription' | 'reservation';

export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string;
  document?: string;
}

export interface CreatePaymentInput {
  /** Internal source-of-truth identifier. For SaaS billing this is Subscription.id; for guest billing this is Reservation.id. */
  referenceId: string;
  /** Business domain that owns the charge. */
  referenceType: PaymentReferenceType;
  /** Backward-compatible alias for existing SaaS billing callers. New integrations should use referenceId. */
  subscriptionId?: string;
  tenantId: string;
  planTier?: PlanTier;
  amount: number;
  paymentMethod: PaymentMethod;
  customer: PaymentCustomer;
  description: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

export interface CreatePaymentResult {
  gateway: GatewayId;
  gatewayPaymentId: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  pix?: { qrCode: string; qrCodeBase64?: string; expiresAt?: string };
  boleto?: { url: string; barcode?: string; expiresAt?: string };
  raw?: unknown;
}

export type PaymentStatus = 'pending' | 'approved' | 'authorized' | 'in_progress' | 'rejected' | 'cancelled' | 'refunded' | 'unknown';

export interface WebhookVerificationContext {
  requestId?: string;
  dataId?: string;
}

export interface WebhookEvent {
  gateway: GatewayId;
  providerEventId: string;
  event: string;
  gatewayPaymentId: string;
  referenceId: string;
  referenceType?: PaymentReferenceType;
  /** Backward-compatible SaaS alias. */
  subscriptionId?: string;
  status: PaymentStatus;
  amount?: number;
  receivedAt: string;
  raw: unknown;
}

export interface IPaymentGateway {
  readonly id: GatewayId;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus>;
  verifyWebhook(payload: string | Buffer, signature: string, context?: WebhookVerificationContext): Promise<boolean>;
  parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent>;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly gateway: GatewayId,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}
