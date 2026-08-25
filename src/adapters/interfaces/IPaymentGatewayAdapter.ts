// ============================================================================
// IPaymentGatewayAdapter — canonical payment provider contract
// ----------------------------------------------------------------------------
// Production providers for Seu Zélla:
//   - Asaas — SaaS billing / subscriptions and supported PIX/card flows
//   - Mercado Pago — guest/reservation payments and PIX/cards
// Mock remains a test-only Digital Twin.
// ============================================================================

export type PaymentProvider = 'asaas' | 'mercadopago';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface PaymentIntentInput {
  amountBRL: number;
  currency?: 'BRL';
  method: PaymentMethod;
  /** Which production provider to use. */
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
