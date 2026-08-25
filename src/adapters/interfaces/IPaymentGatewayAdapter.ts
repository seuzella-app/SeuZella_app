// ============================================================================
// IPaymentGatewayAdapter — contract for payment gateways
// ----------------------------------------------------------------------------
// Supports the two gateways the Zélla project uses (or will use):
//   - Payment Gateway (international)
//   - Mercado Pago (Brazilian PIX + cards)
//
// The interface is intentionally minimal. Higher-level concerns like
// subscription lifecycle, refunds, chargebacks are handled by a domain
// service that calls this adapter.
// ============================================================================

export type PaymentProvider = | 'mercadopago';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface PaymentIntentInput {
  amountBRL: number;
  currency?: 'BRL';
  method: PaymentMethod;
  /** Which provider to use. Required so the registry can route to Mock or Real. */
  provider: PaymentProvider;
  /** Customer reference in the CRM. */
  customerRef: string;
  description: string;
  /** Plan / product code in the Zélla catalogue. */
  planCode: string;
  /** Idempotency key — the same key always returns the same intent. */
  idempotencyKey: string;
}

export interface PaymentIntent {
  intentId: string;
  provider: PaymentProvider;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  amountBRL: number;
  method: PaymentMethod;
  /** PIX-only: the QR code payload and copy-paste string. */
  pix?: { qrCodePayload: string; copyPasteKey: string; expiresAt: string };
  /** Card-only: client secret for frontend confirmation. */
  clientSecret?: string;
  createdAt: string;
}

export interface WebhookEvent {
  eventId: string;
  intentId: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  occurredAt: string;
  signatureVerified: boolean;
  raw: Record<string, unknown>;
}

export interface IPaymentGatewayAdapter {
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  retrieveIntent(intentId: string): Promise<PaymentIntent>;
  refund(intentId: string, amountBRL?: number): Promise<PaymentIntent>;
  /**
   * In Real mode, this parses an inbound webhook payload and verifies its
   * signature. In Digital Twin mode, this is called by the simulator
   * to inject synthetic webhook events.
   */
  parseWebhook(rawPayload: unknown, signature: string): Promise<WebhookEvent>;
  isDigitalTwin(): boolean;
}
