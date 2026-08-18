import { NextRequest, NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';
import { bufferMessage } from '@/lib/message-bundler';
import { resolveTenantByPhone } from '@/lib/resolve-tenant-by-phone';
import { verifyWhatsAppWebhook, validateWebhookTenant } from '@/lib/security/webhook-verify';

/**
 * GET Handler para verificação de webhook exigida pela Meta Developer Platform.
 * Facebook envia parâmetros query para validar o token.
 * 
 * SECURITY (Zero Trust):
 * - In production, requires WHATSAPP_WEBHOOK_VERIFY_TOKEN env var (no hardcoded fallback).
 * - Uses timing-safe comparison via crypto.timingSafeEqual (handled by verifyWhatsAppWebhook).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // SECURITY: Always require env var. No hardcoded fallback ever.
    const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!configuredToken) {
      console.error('[whatsapp-webhook] CRITICAL: WHATSAPP_WEBHOOK_VERIFY_TOKEN not set');
      return new Response('Service Unavailable', { status: 503 });
    }

    // Use the env var value directly (no fallback)
    const localVerifyToken = configuredToken;

    if (mode && token && localVerifyToken) {
      if (mode === 'subscribe') {
        // Use timing-safe comparison
        const crypto = await import('crypto');
        try {
          const isValid = crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(localVerifyToken)
          );
          if (isValid) {
            console.log('[whatsapp-webhook] Validado com sucesso (timing-safe)!');
            return new Response(challenge, {
              status: 200,
              headers: {
                'Content-Type': 'text/plain',
                'X-Security-Shield': 'zero-trust-v1',
              },
            });
          }
        } catch {
          // Length mismatch — immediately reject
        }
        console.warn('[whatsapp-webhook] Token de verificação incorreto.');
        return new Response('Forbidden', { status: 403 });
      }
      console.warn('[whatsapp-webhook] Modo incorreto:', mode);
      return new Response('Forbidden', { status: 403 });
    }

    console.warn('[whatsapp-webhook] Parâmetros hub.mode ou hub.verify_token ausentes.');
    return new Response('Bad Request', { status: 400 });
  } catch (error) {
    console.error('[whatsapp-webhook-error] Erro no GET de verificação:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST Handler para receber mensagens em tempo real da API oficial do WhatsApp Cloud.
 *
 * PERFORMANCE: responde 200 OK imediatamente após validação + enfileiramento.
 * O processamento da mensagem (chamada GLM 5.2, montagem de resposta, envio)
 * acontece de forma assíncrona via queue, evitando timeout do webhook da Meta (>5s).
 *
 * SECURITY (Zero Trust):
 * - In production, requires HMAC-SHA256 signature verification via hub.signature header.
 * - Validates tenant isolation to prevent Cross-Tenant Data Leak.
 * - No mock/fallback mode in production.
 */

// Vercel: permite até 60s de processamento (plano Pro). VPS Docker: sem limite.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Read raw body for signature verification BEFORE parsing
    const rawBody = await request.text();

    // ── Signature Verification (Production Only) ──
    if (process.env.NODE_ENV === 'production') {
      const signatureHeader = request.headers.get('x-hub-signature-256');
      const appSecret = process.env.WHATSAPP_APP_SECRET;

      if (!appSecret) {
        console.error('[whatsapp-webhook] CRITICAL: WHATSAPP_APP_SECRET not set in production');
        return NextResponse.json(
          { error: 'WEBHOOK_NOT_CONFIGURED' },
          { status: 503, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
        );
      }

      const verification = verifyWhatsAppWebhook(rawBody, signatureHeader, appSecret);
      if (!verification.valid) {
        console.warn(`[whatsapp-webhook] REJECTED: ${verification.reason}`);
        return NextResponse.json(
          { error: 'SIGNATURE_INVALID', reason: verification.reason },
          { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
        );
      }
    }

    const payload = JSON.parse(rawBody);

    // Ignorar payloads de validação ou de outros objetos do Facebook
    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored', reason: 'non_whatsapp_object' });
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      return NextResponse.json({ status: 'ignored', reason: 'empty_value' });
    }

    const contact = value.contacts?.[0];
    const contactName = contact?.profile?.name || '';

    const message = value.messages?.[0];
    if (!message) {
      return NextResponse.json({ status: 'ok', processed: 0, reason: 'status_update' });
    }

    const fromPhone = message.from;
    const messageType = message.type;
    const displayPhoneNumber = value.metadata?.display_phone_number || '';

    let messageText = '';

    if (messageType === 'text') {
      messageText = message.text?.body || '';
    } else if (messageType === 'audio' || messageType === 'voice') {
      console.log(`[whatsapp-webhook] Mensagem de Áudio Meta detectada do hóspede ${fromPhone}. Transcrevendo...`);
      const { transcribeWhatsAppAudio } = await import('@/lib/audio-transcriber');
      const audioResult = await transcribeWhatsAppAudio({
        mediaId: message.audio?.id || message.voice?.id,
        provider: 'meta',
      });
      messageText = `[ÁUDIO TRANSCRITO]: "${audioResult.transcript}"`;
    } else {
      console.warn(`[whatsapp-webhook] Tipo de mensagem não suportado: ${messageType}. Ignorando.`);
      return NextResponse.json({ status: 'ok', processed: 0, reason: 'unsupported_message_type' });
    }

    // Resolver Tenant com base no número receptor da pousada
    const tenantResult = await resolveTenantByPhone(displayPhoneNumber);
    const tenantId = tenantResult.tenantId;

    // SECURITY: Validate tenant isolation
    const tenantValidation = validateWebhookTenant(displayPhoneNumber, tenantId);
    if (!tenantValidation.valid) {
      console.warn(`[whatsapp-webhook] TENANT_ISOLATION_FAILURE: ${tenantValidation.reason} — phone: ${displayPhoneNumber}`);
      return NextResponse.json(
        { status: 'rejected', reason: tenantValidation.reason },
        { status: 403, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
      );
    }

    // ── Queue: enfileira mensagem para processamento assíncrono ──
    // Responde 200 OK imediato para a Meta (<2s). O processamento completo
    // (GLM 5.2, montagem de resposta, envio via WhatsApp API) acontece
    // no worker do queue, evitando timeout do webhook.
    const { enqueueJob, QUEUE_NAMES } = await import('@/lib/queue/queue-service');
    await enqueueJob(QUEUE_NAMES.WHATSAPP_WEBHOOK, {
      tenantId: tenantId!,
      guestPhone: fromPhone,
      guestName: contactName,
      messageContent: messageText,
      messageFrom: 'whatsapp',
      displayPhoneNumber,
      messageTimestamp: message.timestamp,
    }).catch((err) => {
      console.error('[whatsapp-webhook] Erro ao enfileirar mensagem:', err);
      // Fallback: processa síncrono se queue falhar
      bufferMessage(
        {
          tenantId: tenantId!,
          guestPhone: fromPhone,
          guestName: contactName,
          messageContent: messageText,
          messageFrom: 'whatsapp',
        },
        processIncomingMessage,
      ).catch((err2) => {
        console.error('[whatsapp-webhook] Erro crítico no fallback síncrono:', err2);
      });
    });

    return NextResponse.json(
      { success: true, processed: true, queued: true },
      { headers: { 'X-Security-Shield': 'zero-trust-v1' } }
    );
  } catch (error) {
    console.error('[whatsapp-webhook-error] Erro ao processar mensagem POST:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to process webhook event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: { 'X-Security-Shield': 'zero-trust-v1' },
      }
    );
  }
}