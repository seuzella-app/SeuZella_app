import { NextRequest, NextResponse } from 'next/server';
import { processarWebhookMercadoPago } from '@/lib/payments/mercadopago-service';
import { verifyMercadoPagoWebhook } from '@/lib/security/webhook-verify';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });

    const signature = req.headers.get('x-signature');
    const verification = verifyMercadoPagoWebhook(rawBody, signature, secret);
    if (!verification.valid) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });

    let body: any;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

    // The provider event ID is the durable idempotency boundary. Reject malformed events before business logic.
    const eventId = body?.id ?? body?.data?.id;
    if (!eventId) return NextResponse.json({ error: 'MISSING_EVENT_ID' }, { status: 400 });

    const result = await processarWebhookMercadoPago(body);
    if (!result.received) return NextResponse.json({ error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500 });

    return NextResponse.json({ received: true, type: result.type, eventId }, { status: 200 });
  } catch (err) {
    console.error('[MP_WEBHOOK] erro:', err);
    return NextResponse.json({ error: 'WEBHOOK_ERROR' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
