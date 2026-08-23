import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { StripeGateway } from '@/lib/payments/providers/stripe';

const stripeGateway = new StripeGateway();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint. Verifies the Stripe-Signature header using
 * HMAC-SHA256 (timing-safe comparison) before processing the event.
 *
 * Required env: STRIPE_WEBHOOK_SECRET
 *
 * Handled events:
 *   - checkout.session.completed → activate subscription
 *   - invoice.paid → record payment transaction
 *   - customer.subscription.deleted → cancel subscription
 */
export async function POST(request: NextRequest) {
  const MAX_PAYLOAD = 1024 * 1024; // 1MB
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_PAYLOAD) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_PAYLOAD) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  const signature = request.headers.get('stripe-signature') || '';
  if (!signature) {
    return NextResponse.json({ error: 'MISSING_SIGNATURE' }, { status: 401 });
  }

  // Verify HMAC-SHA256 signature (timing-safe)
  const isValid = await stripeGateway.verifyWebhook(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });
  }

  try {
    const event = await stripeGateway.parseWebhookEvent(rawBody);
    if (!db) {
      return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 503 });
    }

    switch (event.event) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const externalId = event.gatewayPaymentId;
        const tenantId = (event.raw as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined as string | undefined;
        if (!tenantId) {
          console.warn('[StripeWebhook] No tenantId in metadata for', externalId);
          break;
        }
        // Activate subscription
        try {
          await (db as any).subscription.updateMany({
            where: { tenantId, externalId },
            data: { status: 'ACTIVE', paymentStatus: 'paid' },
          });
        } catch (err) {
          console.error('[StripeWebhook] subscription activation failed:', err);
        }
        break;
      }

      case 'invoice.paid': {
        const tenantId = (event.raw as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined as string | undefined;
        if (!tenantId) break;
        try {
          await (db as any).transaction.create({
            data: {
              tenantId,
              type: 'SUBSCRIPTION_PAYMENT',
              amount: event.amount || 0,
              status: 'CONFIRMED',
              externalId: event.gatewayPaymentId,
              method: 'cartao',
              metadata: JSON.stringify({ gateway: 'stripe', eventType: event.event }),
            },
          });
        } catch (err) {
          console.error('[StripeWebhook] transaction persist failed:', err);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const tenantId = (event.raw as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined as string | undefined;
        if (!tenantId) break;
        try {
          await (db as any).subscription.updateMany({
            where: { tenantId },
            data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
          });
        } catch (err) {
          console.error('[StripeWebhook] subscription cancel failed:', err);
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge but don't process
        console.log('[StripeWebhook] unhandled event type:', event.event);
    }

    return NextResponse.json({ received: true, type: event.event });
  } catch (err) {
    console.error('[StripeWebhook] processing failed:', err);
    return NextResponse.json(
      { error: 'PROCESSING_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
