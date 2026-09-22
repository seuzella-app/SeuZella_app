import { NextRequest, NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments';
import { processPaymentWebhookEvent } from '@/lib/payments/process-webhook';
import { webhookRatelimit } from '@/lib/rate-limit';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 120 req/1min.
  const rlDeny = guardRequest(request, 'webhooks.mercadopago', { points: 120, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:webhooks.mercadopago', what: 'webhooks.mercadopago.entry', resource: 'api', result: 'ALLOW' });
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody) as Record<string, unknown>; }
    catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

    const data = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : {};
    const dataId = typeof data.id === 'string' ? data.id : typeof data.id === 'number' ? String(data.id) : '';
    const requestId = request.headers.get('x-request-id') || '';
    const signature = request.headers.get('x-signature') || '';
    const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!dataId || !requestId || !signature) return NextResponse.json({ error: 'SIGNATURE_CONTEXT_MISSING' }, { status: 401 });

    const gateway = getGateway('mercadopago');
    if (!(await gateway.verifyWebhook(rawBody, signature, { requestId, dataId }))) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });

    // Rate-limit by source, not request-id: request-id is controlled by the
    // provider and is intentionally unique per delivery, so it is not a
    // useful abuse bucket.
    const limit = await webhookRatelimit.limit(`webhook:mercadopago:${sourceIp}`);
    if (!limit.success) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });

    const event = await gateway.parseWebhookEvent(rawBody);
    const result = await processPaymentWebhookEvent(event);
    return NextResponse.json({ received: true, provider: 'mercadopago', referenceType: result.referenceType, eventId: event.providerEventId, deduplicated: result.deduplicated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WEBHOOK_ERROR';
    const status = message.includes('REFERENCE_NOT_FOUND') ? 422 : 500;
    console.error('[MP_WEBHOOK] processing failed:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { Allow: 'POST' } });
}
