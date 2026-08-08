import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyMercadoPagoWebhook } from '@/lib/security/webhook-verify';
// Notification bridge — Phase 2: pushes payment events into DDC
import { bridgePaymentEvent, bridgeSecurityAlert } from '@/lib/notifications/bridges';

/**
 * POST /api/checkout/webhook
 * 
 * SECURITY (Zero Trust V2):
 * - In production, HMAC-SHA256 signature is MANDATORY. No mock fallback.
 * - Timestamp replay protection: rejects signatures older than 5 minutes.
 * - All comparison uses crypto.timingSafeEqual.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;

    // SECURITY: In production, webhook secret is MANDATORY
    if (process.env.NODE_ENV === 'production' && !webhookSecret) {
      console.error('[checkout-webhook] CRITICAL: MP_WEBHOOK_SECRET not set in production');
      return NextResponse.json(
        { error: 'WEBHOOK_NOT_CONFIGURED' },
        { status: 503, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
      );
    }

    // SECURITY: In production, signature is MANDATORY (no mock fallback)
    if (process.env.NODE_ENV === 'production') {
      if (!signature) {
        console.warn('[checkout-webhook] REJECTED: Missing x-signature in production');
        return NextResponse.json(
          { error: 'SIGNATURE_REQUIRED', reason: 'x-signature header is mandatory' },
          { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
        );
      }

      const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!);
      if (!verification.valid) {
        console.warn(`[checkout-webhook] REJECTED: ${verification.reason}`);
        // ── Notification bridge: alert tenant about invalid webhook signature ──
        try {
          bridgeSecurityAlert({
            niche: 'all',
            ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
            reason: `Webhook checkout assinatura inválida: ${verification.reason}`,
          });
        } catch (notifErr) {
          console.error('[checkout-webhook] security bridge error:', notifErr);
        }
        return NextResponse.json(
          { error: 'SIGNATURE_INVALID', reason: verification.reason },
          { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
        );
      }
    } else {
      // Dev/Mock mode: warn but allow
      if (webhookSecret && signature) {
        // If both are present, still validate
        const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret);
        if (!verification.valid) {
          console.warn(`[checkout-webhook] MOCK mode but signature invalid: ${verification.reason}`);
          // In mock mode, log warning but continue for testing
        }
      } else {
        console.warn('[checkout-webhook] MOCK mode: no signature verification (dev only)');
      }
    }

    const body = JSON.parse(rawBody);

    if (body.action === 'payment.updated' || body.type === 'payment') {
      const paymentId = body.data?.id;

      if (!paymentId) {
        return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
      }

      const transaction = await db.paymentTransaction.findFirst({
        where: { externalId: String(paymentId) },
      });

      if (!transaction) {
        console.log(`Webhook: Payment ${paymentId} not found in DB`);
        return NextResponse.json({ received: true });
      }

      const token = process.env.MP_ACCESS_TOKEN;
      if (token) {
        try {
          const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const mpData = await mpResponse.json();
          const newStatus = mpData.status;

          await db.paymentTransaction.update({
            where: { id: transaction.id },
            data: { status: newStatus },
          });

          if (newStatus === 'approved') {
            const subscription = await db.subscription.findUnique({
              where: { id: transaction.subscriptionId },
            });

            if (subscription) {
              const now = new Date();
              const periodEnd = new Date(now);
              periodEnd.setMonth(periodEnd.getMonth() + 1);

              await db.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'active',
                  paymentStatus: 'approved',
                  paymentId: String(paymentId),
                  currentPeriodStart: now,
                  currentPeriodEnd: periodEnd,
                },
              });

              await db.tenant.update({
                where: { id: subscription.tenantId },
                data: { plan: subscription.planType, subscriptionAt: now, status: 'active' },
              });

              // ── Notification bridge: payment received ──
              try {
                bridgePaymentEvent({
                  niche: 'all',
                  paymentId: String(paymentId),
                  amount: Number(transaction.amount ?? 0),
                  guestName: subscription.tenantId,
                  method: 'pix',
                  status: 'received',
                  tenantId: subscription.tenantId,
                });
              } catch (notifErr) {
                console.error('[checkout-webhook] payment bridge error:', notifErr);
              }
            }
          } else if (newStatus === 'rejected') {
            await db.subscription.update({
              where: { id: transaction.subscriptionId },
              data: { paymentStatus: 'rejected' },
            });

            // ── Notification bridge: payment failed ──
            try {
              const subscription = await db.subscription.findUnique({
                where: { id: transaction.subscriptionId },
              });
              if (subscription) {
                bridgePaymentEvent({
                  niche: 'all',
                  paymentId: String(paymentId),
                  amount: Number(transaction.amount ?? 0),
                  guestName: subscription.tenantId,
                  status: 'failed',
                  tenantId: subscription.tenantId,
                });
              }
            } catch (notifErr) {
              console.error('[checkout-webhook] payment-failed bridge error:', notifErr);
            }
          }
        } catch (mpError) {
          console.error('MP fetch error:', mpError);
        }
      }

      return NextResponse.json(
        { received: true },
        { headers: { 'X-Security-Shield': 'zero-trust-v1' } }
      );
    }

    return NextResponse.json({ received: true, action: body.action });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      {
        status: 500,
        headers: { 'X-Security-Shield': 'zero-trust-v1' },
      }
    );
  }
}