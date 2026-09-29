import { NextRequest, NextResponse } from 'next/server';
import { META_APP_SECRET, META_VERIFY_TOKEN } from '@/lib/env';
import { resolveTenantByPhone } from '@/lib/resolve-tenant-by-phone';
import { verifyWhatsAppWebhook, validateWebhookTenant } from '@/lib/security/webhook-verify';
import { normalizeWhatsAppInboundMessage } from '@/lib/whatsapp/inbound-message';
import { claimMetaEvent, completeMetaEvent } from '@/lib/meta/meta-events';
import { webhookRatelimit } from '@/lib/rate-limit';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 120 req/1min.
  const rlDeny = guardRequest(request, 'webhook-whatsapp', { points: 120, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:webhook-whatsapp', what: 'webhook-whatsapp.entry', resource: 'api', result: 'ALLOW' });
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    if (!META_VERIFY_TOKEN || mode !== 'subscribe' || !token || !challenge) return new Response('Forbidden', { status: 403 });
    const crypto = await import('crypto');
    const a = Buffer.from(token); const b = Buffer.from(META_VERIFY_TOKEN);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new Response('Forbidden', { status: 403 });
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', 'X-Security-Shield': 'zero-trust-v2' } });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    if (process.env.NODE_ENV === 'production') {
      if (!META_APP_SECRET) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
      const verification = verifyWhatsAppWebhook(rawBody, request.headers.get('x-hub-signature-256'), META_APP_SECRET);
      if (!verification.valid) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });
    }

    const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rate = await webhookRatelimit.limit(`webhook:whatsapp:${sourceIp}`);
    if (!rate.success) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });

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

    let messageContent = '';
    let messageType: 'text' | 'audio' | 'voice' = 'text';
    let mediaId: string | undefined;
    if (message.type === 'text') {
      messageContent = message.text?.body || '';
    } else if (message.type === 'audio' || message.type === 'voice') {
      messageType = message.type;
      mediaId = message.audio?.id || message.voice?.id;
      if (!mediaId) return NextResponse.json({ error: 'INVALID_MEDIA_EVENT' }, { status: 400 });
      messageContent = '[ÁUDIO PENDENTE DE TRANSCRIÇÃO]';
    } else {
      return NextResponse.json({ status: 'ok', processed: 0, reason: 'unsupported_message_type' });
    }

    const tenantResult = await resolveTenantByPhone(displayPhoneNumber);
    const tenantValidation = validateWebhookTenant(displayPhoneNumber, tenantResult.tenantId);
    if (!tenantValidation.valid) return NextResponse.json({ status: 'rejected', reason: tenantValidation.reason }, { status: 403 });

    const normalized = normalizeWhatsAppInboundMessage({
      providerMessageId: message.id,
      tenantId: tenantResult.tenantId!,
      guestPhone: fromPhone,
      guestName: contactName,
      displayPhoneNumber,
      messageType,
      content: messageContent,
      mediaId,
      timestamp: message.timestamp,
    });

    // ── RBW Fase M: idempotência UNIFICADA entre as duas rotas de webhook ──
    // A MESMA mensagem entregue às DUAS rotas (/api/webhooks/whatsapp canônica
    // e /api/webhook-whatsapp legada) não pode ser processada duas vezes. A
    // autoridade é a MESMA da rota canônica: claimMetaEvent('inbound_message',
    // messageId). Claim negado = duplicata (processada pela canônica ou retry
    // da Meta) → ack sem reprocessamento.
    const inboundClaim = await claimMetaEvent('inbound_message', message.id, {
      destination: displayPhoneNumber,
      from: fromPhone,
      source: 'webhook-whatsapp-legacy',
    });
    if (!inboundClaim.claimed) {
      return NextResponse.json({ success: true, queued: false, deduplicated: true }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }

    const { enqueueJob, QUEUE_NAMES } = await import('@/lib/queue/queue-service');
    try {
      await enqueueJob(
        QUEUE_NAMES.WHATSAPP_WEBHOOK,
        {
          ...normalized.message,
          idempotencyKey: normalized.idempotencyKey,
          messageFrom: 'whatsapp',
        },
        { jobId: normalized.idempotencyKey, tenantId: normalized.message.tenantId },
      );
      await completeMetaEvent('inbound_message', message.id, 'processed');
    } catch (queueError) {
      console.error('[whatsapp-webhook] Queue unavailable; requesting provider retry:', queueError);
      // Libera o claim para o retry da Meta reprocessar mais tarde.
      await completeMetaEvent('inbound_message', message.id, 'failed').catch(() => {});
      return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '5' } });
    }

    return NextResponse.json({ success: true, queued: true, idempotencyKey: normalized.idempotencyKey }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[whatsapp-webhook-error]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
