import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyMercadoPagoWebhook } from '@/lib/security/webhook-verify';
import { bridgePaymentEvent, bridgeSecurityAlert } from '@/lib/notifications/bridges';
import { executeWithBillingIdempotency } from '@/lib/payments/idempotency';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const MAX_WEBHOOK_BYTES = 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    // RUN11-W3 (11B): anti-flood fail-closed por IP — 120 req/min.
    const rlDeny = guardRequest(request, 'checkout.webhook', { points: 120, windowMs: 60000 });
    if (rlDeny) return rlDeny;
    // RUN11-W3 (11D): trilha de auditoria da ENTRADA do webhook (sem payload).
    auditRouteEvent({ who: 'webhook:mercadopago', what: 'checkout.webhook.received', resource: 'payment', result: 'ALLOW' });
    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id') || undefined;
    const webhookSecret = process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;

    // ── M-PAY-011: Fail-closed em produção se webhook secret não estiver configurado ──
    if (process.env.NODE_ENV === 'production' && !webhookSecret) {
      console.error('[checkout-webhook] FAIL-CLOSED: MP_WEBHOOK_SECRET is not configured in production');
      return NextResponse.json(
        { error: 'WEBHOOK_SECRET_NOT_CONFIGURED' },
        { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    if (webhookSecret || process.env.NODE_ENV === 'production') {
      if (!signature) return NextResponse.json({ error: 'SIGNATURE_REQUIRED' }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
      const bodyForSignature = (() => {
        try { return JSON.parse(rawBody) as Record<string, unknown>; } catch { return null; }
      })();
      if (!bodyForSignature) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
      const paymentId = typeof bodyForSignature.data === 'object' && bodyForSignature.data !== null && typeof (bodyForSignature.data as Record<string, unknown>).id === 'string'
        ? String((bodyForSignature.data as Record<string, unknown>).id)
        : typeof bodyForSignature.id === 'string' ? bodyForSignature.id : '';
      if (!paymentId) return NextResponse.json({ error: 'MISSING_PAYMENT_ID' }, { status: 400 });
      const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret || '', paymentId, requestId);
      if (!verification.valid) {
        console.warn(`[checkout-webhook] REJECTED: ${verification.reason}`);
        try {
          bridgeSecurityAlert({ niche: 'all', ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', reason: `Webhook checkout assinatura inválida: ${verification.reason}` });
        } catch (notifErr) { console.error('[checkout-webhook] security bridge error:', notifErr); }
        return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
      }
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

    if (body.action === 'payment.updated' || body.type === 'payment') {
      const paymentId = typeof (body.data as Record<string, unknown> | undefined)?.id === 'string' ? String((body.data as Record<string, unknown>).id) : '';
      if (!paymentId) return NextResponse.json({ error: 'MISSING_PAYMENT_ID' }, { status: 400 });

      const transaction = await db.paymentTransaction.findFirst({ where: { externalId: paymentId } });
      if (!transaction) return NextResponse.json({ received: true, ignored: true });

      const token = process.env.MP_ACCESS_TOKEN;
      if (process.env.NODE_ENV === 'production' && !token) {
        console.error('[checkout-webhook] FAIL-CLOSED: MP_ACCESS_TOKEN is not configured in production');
        return NextResponse.json(
          { error: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
          { status: 503, headers: { 'X-Security-Shield': 'zero-trust-v2' } },
        );
      }

      if (token) {
        try {
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!mpResponse.ok) return NextResponse.json({ error: 'PAYMENT_STATUS_UNAVAILABLE' }, { status: 503 });
          const mpData = await mpResponse.json();
          const newStatus = typeof mpData.status === 'string' ? mpData.status : 'unknown';

          const idempotencyResult = await executeWithBillingIdempotency(
            {
              provider: 'mercadopago',
              eventId: paymentId,
              eventType: String(body.action || body.type || 'payment.updated'),
              status: newStatus,
            },
            async () => {
              await db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: newStatus } });

              if (newStatus === 'approved') {
                const subscription = await db.subscription.findUnique({ where: { id: transaction.subscriptionId } });
                if (subscription) {
                  const now = new Date();
                  const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);
                  await db.subscription.update({ where: { id: subscription.id }, data: { status: 'active', paymentStatus: 'approved', paymentId, currentPeriodStart: now, currentPeriodEnd: periodEnd } });
                  await db.tenant.update({ where: { id: subscription.tenantId }, data: { plan: subscription.planType, subscriptionAt: now, status: 'active' } });
                  try { bridgePaymentEvent({ niche: 'all', paymentId, amount: Number(transaction.amount ?? 0), guestName: subscription.tenantId, method: 'pix', status: 'received', tenantId: subscription.tenantId }); } catch (notifErr) { console.error('[checkout-webhook] payment bridge error:', notifErr); }
                }
              } else if (newStatus === 'rejected') {
                await db.subscription.update({ where: { id: transaction.subscriptionId }, data: { paymentStatus: 'rejected' } });
              }

              return { updated: true, paymentId, status: newStatus };
            },
          );

          return NextResponse.json(
            { received: true, deduplicated: idempotencyResult.deduplicated },
            { headers: { 'X-Security-Shield': 'zero-trust-v2' } },
          );
        } catch (mpError) { console.error('[checkout-webhook] provider status lookup failed:', mpError instanceof Error ? mpError.name : 'UnknownError'); return NextResponse.json({ error: 'PAYMENT_PROVIDER_UNAVAILABLE' }, { status: 503 }); }
      }
      return NextResponse.json({ received: true }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }

    return NextResponse.json({ received: true, action: typeof body.action === 'string' ? body.action : undefined });
  } catch (error) {
    console.error('[checkout-webhook] processing failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  }
}
