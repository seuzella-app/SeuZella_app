import { NextRequest, NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments';
import { processPaymentWebhookEvent } from '@/lib/payments/process-webhook';
import { webhookRatelimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    // Prefer the body-bound HMAC signature. Legacy access-token verification is
    // only accepted when explicitly enabled by ASAAS_ALLOW_LEGACY_TOKEN.
    const signature = request.headers.get('asaas-signature') || request.headers.get('asaas-access-token') || '';
    const gateway = getGateway('asaas');
    if (!(await gateway.verifyWebhook(rawBody, signature))) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });

    const limit = await webhookRatelimit.limit(`webhook:asaas:${request.headers.get('x-forwarded-for') || 'unknown'}`);
    if (!limit.success) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });

    const event = await gateway.parseWebhookEvent(rawBody);
    const result = await processPaymentWebhookEvent(event);
    return NextResponse.json({ received: true, provider: 'asaas', referenceType: result.referenceType, eventId: event.providerEventId, deduplicated: result.deduplicated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WEBHOOK_ERROR';
    const status = message.includes('REFERENCE_NOT_FOUND') ? 422 : 500;
    console.error('[ASAAS_WEBHOOK] processing failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: status === 422 ? 'REFERENCE_NOT_FOUND' : 'WEBHOOK_ERROR' }, { status });
  }
}
