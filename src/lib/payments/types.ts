// ==============================================================================
// SEUZÉLLA — Unified Payment Gateway Contract
// ==============================================================================
// This file defines the SINGLE contract that all 3 payment gateways
// (MercadoPago, Asaas, Stripe) must implement. New gateways plug in by
// implementing IPaymentGateway — no other code in the app changes.
//
// Sprint 1, Day 1-2: Foundation (NON-BREAKING, additive)
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';

// ── Payment Methods supported across all gateways ─────────────────────────────
export type PaymentMethod = 'pix' | 'cartao' | 'boleto';

// ── Gateway identifiers ────────────────────────────────────────────────────────
export type GatewayId = 'mercadopago' | 'asaas' | 'stripe' | 'mock';

// ── Customer info passed to every gateway ─────────────────────────────────────
export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string;
  document?: string; // CPF/CNPJ — required by Asaas, optional for MP
}

// ── Subscription / one-time charge input ──────────────────────────────────────
export interface CreatePaymentInput {
  subscriptionId: string; // Internal subscription ID (cuid)
  tenantId: string;
  planTier: PlanTier;
  amount: number; // BRL, already validated by pricing.ts
  paymentMethod: PaymentMethod;
  customer: PaymentCustomer;
  description: string;
  // URLs gateway should redirect to after the user completes checkout
  successUrl: string;
  cancelUrl: string;
  // Webhook URL the gateway should call for status updates
  webhookUrl: string;
}

// ── Standardized result returned by every gateway ─────────────────────────────
export interface CreatePaymentResult {
  gateway: GatewayId;
  gatewayPaymentId: string; // External ID (MP payment_id, Asaas payment_id, Stripe session_id)
  status: PaymentStatus;
  // Method-specific output — at least one will be populated
  checkoutUrl?: string; // For redirect-based flows (MP Checkout Pro, Stripe Checkout, Asaas invoice)
  pix?: {
    qrCode: string; // Copy-paste PIX code ("copia e cola")
    qrCodeBase64?: string; // Base64-encoded QR image
    expiresAt?: string; // ISO timestamp
  };
  boleto?: {
    url: string; // PDF/HTML boleto URL
    barcode?: string; // Numeric barcode
    expiresAt?: string;
  };
  // Raw payload preserved for audit/debugging
  raw?: unknown;
}

// ── Payment status (normalized across gateways) ───────────────────────────────
export type PaymentStatus =
  | 'pending' // Awaiting user action (QR generated, redirect pending)
  | 'approved' // Confirmed by gateway
  | 'authorized' // Pre-authorized (card, captured later — future)
  | 'in_progress' // Boleto paid but not yet cleared (1-3 business days)
  | 'rejected' // Failed / declined
  | 'cancelled' // Voided by user or system
  | 'refunded' // Reversed
  | 'unknown'; // Gateway returned something we don't recognize

// ── Webhook event after signature verification ────────────────────────────────
export interface WebhookEvent {
  gateway: GatewayId;
  event: string; // Native event name (e.g. "payment.approved", "payment.created")
  gatewayPaymentId: string;
  subscriptionId: string; // Resolved from external_reference / metadata
  status: PaymentStatus;
  amount?: number;
  receivedAt: string; // ISO timestamp
  raw: unknown; // Original gateway payload for audit
}

// ── The gateway contract ───────────────────────────────────────────────────────
export interface IPaymentGateway {
  readonly id: GatewayId;

  // True if env vars for this gateway are configured
  isConfigured(): boolean;

  // Create a new payment / checkout session
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  // Query current status of a payment by gateway payment ID
  getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus>;

  // Verify webhook signature (HMAC, signature header, etc.) — returns true if valid
  // Throws on malformed payload; returns false on signature mismatch
  verifyWebhook(payload: string | Buffer, signature: string): Promise<boolean>;

  // Parse a verified webhook payload into a normalized WebhookEvent
  parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent>;
}

// ── Error class for explicit gateway errors ───────────────────────────────────
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
