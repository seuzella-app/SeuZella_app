// ==============================================================================
// SEUZÉLLA — Stripe Gateway Adapter
// ==============================================================================
// Stripe is the gateway for international expansion (when SeuZélla goes outside
// Brazil). For now, used primarily for:
//   - Recurring card subscriptions (Stripe Billing)
//   - Backstop if MP/Asaas have downtime
//   - Payment method storage for one-click re-charge
//
// Sprint 1, Day 6: Stripe integration via REST API (no SDK dependency)
// Docs: https://docs.stripe.com/api
// ==============================================================================

import { STRIPE_SECRET_KEY } from '@/lib/env';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentGateway,
  PaymentStatus,
  WebhookEvent,
} from '../../types';
import { PaymentGatewayError } from '../../types';

// ── Stripe API base URL ───────────────────────────────────────────────────────
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

// ── Stripe API types (subset) ─────────────────────────────────────────────────
interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  status: 'open' | 'complete' | 'expired';
  metadata?: Record<string, string>;
  amount_total?: number;
}
interface StripePaymentIntent {
  id: string;
  status: 'requires_payment_method' | 'requires_action' | 'succeeded' | 'canceled' | 'processing';
  amount: number;
}

// ── Adapter ────────────────────────────────────────────────────────────────────
export class StripeGateway implements IPaymentGateway {
  readonly id = 'stripe' as const;

  isConfigured(): boolean {
    return Boolean(STRIPE_SECRET_KEY) && STRIPE_SECRET_KEY.startsWith('sk_');
  }

  private authHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Account': process.env.STRIPE_ACCOUNT_ID ?? '',
    } as HeadersInit;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError(
        'Stripe not configured — set STRIPE_SECRET_KEY',
        'stripe',
        'NOT_CONFIGURED',
      );
    }

    // Stripe handles all payment methods via Checkout Sessions (recommended)
    // or PaymentIntents (custom UI). We use Checkout Sessions for now.
    const params = new URLSearchParams();
    params.append('mode', 'payment'); // one-time charge; future: 'subscription' for recurring
    params.append('customer_email', input.customer.email);
    params.append('client_reference_id', input.subscriptionId);
    params.append('metadata[subscriptionId]', input.subscriptionId);
    params.append('metadata[tenantId]', input.tenantId);
    params.append('metadata[planTier]', input.planTier);
    params.append('metadata[paymentMethod]', input.paymentMethod);
    params.append('success_url', input.successUrl);
    params.append('cancel_url', input.cancelUrl);

    // Line item
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'brl');
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(input.amount * 100)));
    params.append('line_items[0][price_data][product_data][name]', input.description);

    // Payment method types — varies by method
    if (input.paymentMethod === 'pix') {
      params.append('payment_method_types[0]', 'pix');
    } else if (input.paymentMethod === 'cartao') {
      params.append('payment_method_types[0]', 'card');
    } else if (input.paymentMethod === 'boleto') {
      // Stripe doesn't natively support boleto in Brazil Checkout Sessions yet
      // (boleto is in beta as of 2025). We fall back to card.
      params.append('payment_method_types[0]', 'card');
    }

    const res = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new PaymentGatewayError(
        `Stripe session creation failed: ${errText}`,
        'stripe',
        'CREATE_FAILED',
        res.status,
      );
    }

    const r = (await res.json()) as StripeCheckoutSession;
    return {
      gateway: 'stripe',
      gatewayPaymentId: r.id,
      status: r.status === 'complete' ? (r.payment_status === 'paid' ? 'approved' : 'pending') : 'pending',
      checkoutUrl: r.url,
      raw: r,
    };
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) {
      throw new PaymentGatewayError('Stripe not configured', 'stripe', 'NOT_CONFIGURED');
    }
    // For Checkout Sessions
    const res = await fetch(`${STRIPE_BASE_URL}/checkout/sessions/${gatewayPaymentId}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      // Try as PaymentIntent
      const piRes = await fetch(`${STRIPE_BASE_URL}/payment_intents/${gatewayPaymentId}`, {
        headers: this.authHeaders(),
      });
      if (!piRes.ok) {
        throw new PaymentGatewayError(
          `Stripe getPaymentStatus failed: ${res.status}`,
          'stripe',
          'GET_FAILED',
          res.status,
        );
      }
      const pi = (await piRes.json()) as StripePaymentIntent;
      return this.normalizePIStatus(pi.status);
    }
    const s = (await res.json()) as StripeCheckoutSession;
    if (s.payment_status === 'paid') return 'approved';
    if (s.status === 'expired') return 'cancelled';
    return 'pending';
  }

  private normalizePIStatus(s: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      requires_payment_method: 'pending',
      requires_action: 'pending',
      processing: 'in_progress',
      succeeded: 'approved',
      canceled: 'cancelled',
    };
    return map[s] ?? 'unknown';
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<boolean> {
    // Stripe webhooks are signed with the STRIPE_WEBHOOK_SECRET.
    // The Stripe-Signature header format is: "t=timestamp,v1=hash"
    // Verification: HMAC-SHA256(secret, "${timestamp}.${payload}") === v1
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    // Parse the Stripe-Signature header
    const parts = signature.split(',').map(p => p.trim());
    const tsPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));
    if (!tsPart || !v1Part) return false;

    const timestamp = tsPart.slice(2);
    const expectedHash = v1Part.slice(3);

    // Prevent replay attacks: reject timestamps older than 5 minutes
    const ageMs = Date.now() - Number(timestamp) * 1000;
    if (isNaN(Number(timestamp)) || ageMs > 5 * 60 * 1000) return false;

    // Compute HMAC-SHA256
    const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
    const signedPayload = `${timestamp}.${payloadStr}`;
    const crypto = await import('crypto');
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Timing-safe comparison
    try {
      const a = Buffer.from(computedHash, 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEvent> {
    try {
      const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
      const eventType = body?.type ?? 'unknown';
      const obj = body?.data?.object ?? {};

      // Determine status
      let status: PaymentStatus = 'unknown';
      let paymentId = String(obj?.id ?? '');
      let amount: number | undefined;

      if (eventType.startsWith('checkout.session.')) {
        if (obj.payment_status === 'paid') status = 'approved';
        else if (obj.status === 'expired') status = 'cancelled';
        else status = 'pending';
        paymentId = obj.id;
        amount = obj.amount_total ? obj.amount_total / 100 : undefined;
      } else if (eventType.startsWith('payment_intent.')) {
        status = this.normalizePIStatus(obj.status ?? '');
        paymentId = obj.id;
        amount = obj.amount ? obj.amount / 100 : undefined;
      }

      return {
        gateway: 'stripe',
        event: eventType,
        gatewayPaymentId: paymentId,
        subscriptionId: obj.client_reference_id ?? obj.metadata?.subscriptionId ?? '',
        status,
        amount,
        receivedAt: new Date().toISOString(),
        raw: body,
      };
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err;
      throw new PaymentGatewayError(
        'Failed to parse Stripe webhook',
        'stripe',
        'PARSE_FAILED',
        400,
        err,
      );
    }
  }
}
