import { NextRequest, NextResponse } from 'next/server';
import { processarWebhookMercadoPago } from '@/lib/payments/mercadopago-service';
import { verifyMercadoPagoWebhook } from '@/lib/security/webhook-verify';

const MAX_WEBHOOK_BYTES = 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });

    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id') || undefined;
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const eventId = typeof body.id === 'string' ? body.id : typeof (body.data as Record<string, unknown> | undefined)?.id === 'string' ? (body.data as Record<string, unknown>).id as string : '';
    if (!eventId) return NextResponse.json({ error: 'MISSING_EVENT_ID' }, { status: 400 });

    const verification = verifyMercadoPagoWebhook(rawBody, signature, secret, eventId, requestId);
    if (!verification.valid) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });

    const result = await processarWebhookMercadoPago(body);
    if (!result.received) return NextResponse.json({ error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500 });

    return NextResponse.json({ received: true, type: result.type, eventId }, { status: 200 });
  } catch (err) {
    console.error('[MP_WEBHOOK] processing failed:', err instanceof Error ? err.name : 'UnknownError');
    return NextResponse.json({ error: 'WEBHOOK_ERROR' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { Allow: 'POST' } });
}
