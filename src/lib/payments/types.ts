// ==============================================================================
// SEUZÉLLA — Unified Payment Gateway Contract
// ==============================================================================
// Production payment scope: Asaas + Mercado Pago.
// Mock remains available for development/testing only.
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';

export type PaymentMethod = 'pix' | 'cartao' | 'boleto';
export type GatewayId = 'mercadopago' | 'asaas' | 'mock';

export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string;
  document?: string;
}

export interface CreatePaymentInput {
  subscriptionId: string;
  tenantId: string;
  planTier: PlanTier;
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
  pix?: {
    qrCode: string;
    qrCodeBase64?: string;
    expiresAt?: string;
  };
  boleto?: {
    url: string;
    barcode?: string;
    expiresAt?: string;
  };
  raw?: unknown;
}

export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_progress'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'unknown';

export interface WebhookEvent {
  gateway: GatewayId;
  event: string;
  gatewayPaymentId: string;
  subscriptionId: string;
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
  verifyWebhook(payload: string | Buffer, signature: string): Promise<boolean>;
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
