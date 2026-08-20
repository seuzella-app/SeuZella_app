import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantByPhone } from '@/lib/resolve-tenant-by-phone';
import { verifyWhatsAppWebhook, validateWebhookTenant } from '@/lib/security/webhook-verify';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (!configuredToken || mode !== 'subscribe' || !token || !challenge) return new Response('Forbidden', { status: 403 });
    const crypto = await import('crypto');
    const a = Buffer.from(token); const b = Buffer.from(configuredToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new Response('Forbidden', { status: 403 });
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', 'X-Security-Shield': 'zero-trust-v1' } });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (process.env.NODE_ENV === 'production') {
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      if (!appSecret) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
      const verification = verifyWhatsAppWebhook(rawBody, request.headers.get('x-hub-signature-256'), appSecret);
      if (!verification.valid) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
    if (payload.object !== 'whatsapp_business_account') return NextResponse.json({ status: 'ignored' });

    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!value || !message) return NextResponse.json({ status: 'ok', processed: 0 });

    const fromPhone = message.from;
    const displayPhoneNumber = value.metadata?.display_phone_number || '';
    const contactName = value.contacts?.[0]?.profile?.name || '';
    if (!fromPhone || !displayPhoneNumber || !message.id) return NextResponse.json({ error: 'INVALID_WEBHOOK_EVENT' }, { status: 400 });

    let messageText = '';
    if (message.type === 'text') messageText = message.text?.body || '';
    else if (message.type === 'audio' || message.type === 'voice') {
      const { transcribeWhatsAppAudio } = await import('@/lib/audio-transcriber');
      const audioResult = await transcribeWhatsAppAudio({ mediaId: message.audio?.id || message.voice?.id, provider: 'meta' });
      messageText = `[ÁUDIO TRANSCRITO]: "${audioResult.transcript}"`;
    } else return NextResponse.json({ status: 'ok', processed: 0, reason: 'unsupported_message_type' });

    const tenantResult = await resolveTenantByPhone(displayPhoneNumber);
    const tenantValidation = validateWebhookTenant(displayPhoneNumber, tenantResult.tenantId);
    if (!tenantValidation.valid) return NextResponse.json({ status: 'rejected', reason: tenantValidation.reason }, { status: 403 });

    const { enqueueJob, QUEUE_NAMES } = await import('@/lib/queue/queue-service');
    try {
      await enqueueJob(QUEUE_NAMES.WHATSAPP_WEBHOOK, {
        idempotencyKey: `whatsapp:${message.id}`,
        providerMessageId: message.id,
        tenantId: tenantResult.tenantId!,
        guestPhone: fromPhone,
        guestName: contactName,
        messageContent: messageText,
        messageFrom: 'whatsapp',
        displayPhoneNumber,
        messageTimestamp: message.timestamp,
      });
    } catch (queueError) {
      // Never process synchronously after a queue failure: that would create
      // duplicate processing and defeats the durability contract. Returning
      // non-2xx lets Meta retry the event.
      console.error('[whatsapp-webhook] Queue unavailable; requesting provider retry:', queueError);
      return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '5' } });
    }

    return NextResponse.json({ success: true, queued: true }, { headers: { 'X-Security-Shield': 'zero-trust-v1' } });
  } catch (error) {
    console.error('[whatsapp-webhook-error]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
