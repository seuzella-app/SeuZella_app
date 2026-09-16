// ==============================================================================
// ZÉLLA — Meta WhatsApp Cloud API Webhook (Multi-Tenant Safe)
// ==============================================================================
// Rota receptora de eventos da Meta Cloud API.
//
// CORREÇÕES v2:
//  - Finding 1.1: verifyMetaSignature agora é fail-closed em produção.
//    Se META_APP_SECRET não configurado em prod, rejeita TUDO.
//  - Finding 1.4: opt-out LGPD é interceptado SÍNCRONO, antes de enfileirar
//    para o AI pipeline. Antes, a IA rodava e custava tokens mesmo em opt-out.
//  - Usa resolveTenantByPhone (v2) com match exato E.164.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { META_VERIFY_TOKEN, META_APP_SECRET } from '@/lib/env';
import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';
import { bufferMessage } from '@/lib/message-bundler';
import { sendWhatsAppMessage } from '@/lib/whatsapp-send';
import { resolveTenantByPhone } from '@/lib/resolve-tenant-by-phone';
import { isOptOutMessage, handleOptOut } from '@/lib/lgpd-consent';
import { resolveGuest } from '@/lib/bsuid-resolver';
import { recordMetaCost, recordMetaPricingFromStatus } from '@/lib/meta-cost-guard';
// Notification bridge — Phase 2: pushes guest/lead notifications into DDC
import { bridgeWhatsAppIncoming } from '@/lib/notifications/bridges';
// ── Meta Foundation (Fase 5/6/9/24) — aditivo, não substitui o fluxo existente ──
import { extractWebhookValues, normalizeMetaOutboundStatuses } from '@/lib/meta/meta-normalizer';
import { claimMetaEvent, completeMetaEvent, recordMetaTelemetry } from '@/lib/meta/meta-events';
import { recordMetaAttribution, linkAttributionToConversation } from '@/lib/meta/meta-attribution';
import { webhookRatelimit } from '@/lib/rate-limit';

/* eslint-disable @typescript-eslint/no-unused-vars -- Meta payload types kept as documentation */

// ══
// META WHATSAPP BUSINESS API — WEBHOOK ENDPOINT
// GET  → Verificação do Webhook (Meta onboarding flow)
// POST → Recepção de mensagens + isolamento multi-tenant
// ══

interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

interface MetaWebhookValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
  errors?: Array<{ code: number; title: string; message: string }>;
}

interface MetaContact {
  wa_id: string;
  profile?: {
    name?: string;
  };
}

interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string; preview_url?: boolean };
  image?: { id: string; caption?: string; mime_type?: string; sha256?: string };
  document?: { id: string; caption?: string; filename?: string; mime_type?: string; sha256?: string };
  audio?: { id: string; mime_type?: string; sha256?: string; voice?: boolean };
  video?: { id: string; caption?: string; mime_type?: string; sha256?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  sticker?: { id: string; mime_type?: string; animated?: boolean };
  interactive?: {
    type?: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  context?: { id: string; forwarded?: boolean; frequently_forwarded?: boolean };
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string };
  reaction?: { message_id: string; emoji: string };
}

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | 'undelivered';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string; error_data?: { details: string } }>;
  conversation?: {
    id: string;
    origin?: { type: string };
    expiration_timestamp?: number;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
    cost?: number;
  };
}

interface ParsedIncomingMessage {
  from: string;
  contactName: string | null;
  messageId: string;
  timestamp: number;
  type: string;
  textContent: string | null;
  destinationNumber: string;
  phoneNumberId: string;
  wabaId: string;
  /** Click-to-WhatsApp referral (Fase 9) — capturado sem alterar o fluxo. */
  referral: {
    source_url?: string;
    source_id?: string;
    source_type?: string;
    headline?: string;
    body?: string;
  } | null;
}

// ── HMAC Signature Verification (fail-closed em produção) 

/**
 * Verifica assinatura HMAC-SHA256 do payload da Meta.
 *
 * CORREÇÃO v2 — finding 1.1:
 *  Versão anterior retornava `true` quando META_APP_SECRET era ausente,
 *  apenas com console.warn. Em produção, isso permitiria a qualquer um
 *  enviar payloads falsos. Agora:
 *   - Produção sem META_APP_SECRET → rejeita (false)
 *   - Dev sem META_APP_SECRET → permite apenas com WEBHOOK_ALLOW_NO_SECRET=true
 *   - Dev com META_APP_SECRET → valida normalmente
 */
function verifyMetaSignature(
  payload: string,
  signatureHeader: string | null
): { valid: boolean; reason?: string } {
  // 1. Fail-closed em produção se META_APP_SECRET ausente
  if (!META_APP_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[WhatsApp Webhook] CRÍTICO: META_APP_SECRET não configurado em produção — rejeitando');
      return { valid: false, reason: 'META_APP_SECRET_NOT_SET_IN_PRODUCTION' };
    }
    // Dev mode: exige opt-in explícito para bypass
    if (process.env.WEBHOOK_ALLOW_NO_SECRET !== 'true') {
      console.error('[WhatsApp Webhook] META_APP_SECRET não setado. Set WEBHOOK_ALLOW_NO_SECRET=true para bypass em dev.');
      return { valid: false, reason: 'META_APP_SECRET_NOT_SET_USE_BYPASS_ENV' };
    }
    console.warn('[WhatsApp Webhook] ⚠️ Bypassing HMAC verification in dev mode (WEBHOOK_ALLOW_NO_SECRET=true)');
    return { valid: true };
  }

  if (!signatureHeader) {
    console.error('[WhatsApp Webhook] ❌ No X-Hub-Signature-256 header present');
    return { valid: false, reason: 'MISSING_SIGNATURE_HEADER' };
  }

  // Format: "sha256=<hex>"
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('[WhatsApp Webhook] ❌ Invalid signature format:', signatureHeader.substring(0, 20));
    return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  }

  const expectedSig = parts[1];
  const computedSig = createHmac('sha256', META_APP_SECRET)
    .update(payload)
    .digest('hex');

  try {
    const expected = Buffer.from(expectedSig, 'hex');
    const computed = Buffer.from(computedSig, 'hex');

    // timingSafeEqual exige buffers de mesmo tamanho
    if (expected.length !== computed.length) {
      console.error('[WhatsApp Webhook] ❌ Signature length mismatch');
      return { valid: false, reason: 'SIGNATURE_LENGTH_MISMATCH' };
    }

    const isValid = timingSafeEqual(expected, computed);
    if (!isValid) {
      console.error('[WhatsApp Webhook] ❌ Signature mismatch — possible tampering');
      return { valid: false, reason: 'SIGNATURE_MISMATCH' };
    }
    return { valid: true };
  } catch (err) {
    console.error('[WhatsApp Webhook] ❌ Signature comparison error:', err);
    return { valid: false, reason: 'SIGNATURE_COMPARISON_ERROR' };
  }
}

// ── Safe Payload Parser 

function parseIncomingMessages(rawBody: unknown): ParsedIncomingMessage[] {
  const results: ParsedIncomingMessage[] = [];

  const body = rawBody as Record<string, unknown> | null;
  if (!body?.object || body.object !== 'whatsapp_business_account') {
    return results;
  }

  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    const wabaId = (e.id as string) || '';
    const changes = Array.isArray(e.changes) ? e.changes : [];

    for (const change of changes) {
      const c = change as Record<string, unknown>;
      if (c.field !== 'messages') continue;

      const value = c.value as Record<string, unknown> | null;
      if (!value) continue;

      const metadata = value.metadata as Record<string, unknown> | null;
      const destinationNumber = (metadata?.display_phone_number as string) || '';
      const phoneNumberId = (metadata?.phone_number_id as string) || '';

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactMap = new Map<string, string | null>();
      for (const contact of contacts) {
        const ct = contact as Record<string, unknown>;
        const waId = (ct.wa_id as string) || '';
        const profile = ct.profile as Record<string, unknown> | null;
        const name = (profile?.name as string) || null;
        contactMap.set(waId, name);
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const msg of messages) {
        const m = msg as Record<string, unknown>;

        let textContent: string | null = null;
        if (m.type === 'text' && m.text) {
          const textObj = m.text as Record<string, unknown>;
          textContent = (textObj.body as string) || null;
        }

        results.push({
          from: (m.from as string) || '',
          contactName: contactMap.get((m.from as string) || '') || null,
          messageId: (m.id as string) || '',
          timestamp: Number(m.timestamp) || 0,
          type: (m.type as string) || 'unknown',
          textContent,
          destinationNumber,
          phoneNumberId,
          wabaId,
          referral: (m.referral as ParsedIncomingMessage['referral']) || null,
        });
      }
    }
  }

  return results;
}

// ══
// Meta Foundation — Fase 6/11/24: STATUS OUTBOUND (authoritative pricing)
// ══
// "Meta aceitou o envio" ≠ "Meta cobrou". O status da Meta com
// pricing.billable=true é o evento AUTHORITATIVE de billing.
// Este handler é fire-and-forget seguro: falha aqui NUNCA derruba o webhook.

async function touchMetaConnection(params: {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  kind: 'webhook' | 'delivery';
}): Promise<void> {
  try {
    const now = new Date();
    const data =
      params.kind === 'delivery'
        ? { lastWebhookAt: now, lastDeliveryAt: now }
        : { lastWebhookAt: now };
    const existing = await db.metaConnection.findFirst({
      where: { tenantId: params.tenantId, wabaId: params.wabaId, phoneNumberId: params.phoneNumberId },
      select: { id: true },
    });
    if (existing) {
      await db.metaConnection.update({ where: { id: existing.id }, data });
    } else {
      await db.metaConnection.create({
        data: {
          tenantId: params.tenantId,
          wabaId: params.wabaId || null,
          phoneNumberId: params.phoneNumberId || null,
          displayPhoneNumber: params.displayPhoneNumber || null,
          // Estado honesto: PENDING até haver verificação real (nunca "verde"
          // fabricado — Fase 10).
          connectionStatus: 'PENDING',
        },
      });
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] touchMetaConnection failed (non-fatal):', error);
  }
}

async function processMetaStatuses(parsedBody: unknown): Promise<number> {
  const values = extractWebhookValues(parsedBody);
  let processed = 0;

  for (const { wabaId, value } of values) {
    const metadata = value.metadata as Record<string, unknown> | null;
    const displayPhoneNumber = (metadata?.display_phone_number as string) || '';
    const phoneNumberId = (metadata?.phone_number_id) as string || '';

    const statuses = normalizeMetaOutboundStatuses(value);
    if (statuses.length === 0) continue;

    // Tenant lookup (mesma política do fluxo de mensagens).
    const lookup = await resolveTenantByPhone(displayPhoneNumber, wabaId);
    const tenantId = lookup.found ? lookup.tenantId! : null;

    for (const status of statuses) {
      // ── Idempotência (Fase 5): status NUNCA processado duas vezes ──
      const claim = await claimMetaEvent('outbound_status', status.externalEventId, {
        status: status.status,
      });
      if (!claim.claimed) continue;

      try {
        // ── Authoritative pricing (Fase 6) ──
        if (status.pricing) {
          const conversationId = await resolveConversationIdForStatus(tenantId, status.recipientId);
          await recordMetaPricingFromStatus({
            tenantId: tenantId ?? 'shared',
            conversationId: conversationId ?? 'unresolved',
            guestId: undefined,
            messageId: status.pricing.messageId,
            billable: status.pricing.billable,
            category: status.pricing.category,
            pricingModel: status.pricing.pricingModel ?? undefined,
            cost: status.pricing.cost ?? undefined,
            currency: status.pricing.currency ?? undefined,
            metadata: {
              status: status.status,
              wabaId,
              phoneNumberId,
              displayPhoneNumber,
            },
          });

          recordMetaTelemetry({
            name: 'meta.pricing.recorded',
            tenantId: tenantId ?? undefined,
            message: `Pricing authoritative registrado (billable=${status.pricing.billable}, category=${status.pricing.category})`,
            context: { messageId: status.pricing.messageId, status: status.status },
          });
        }

        // ── Telemetria de entrega (Fase 24) ──
        const telemetryName =
          status.status === 'delivered'
            ? 'meta.message.delivered'
            : status.status === 'read'
              ? 'meta.message.read'
              : status.status === 'failed'
                ? 'meta.message.failed'
                : null;
        if (telemetryName) {
          recordMetaTelemetry({
            name: telemetryName,
            tenantId: tenantId ?? undefined,
            message: `Status ${status.status} da Meta`,
            severity: status.status === 'failed' ? 'warn' : 'info',
            context: {
              messageId: status.externalEventId,
              error: status.errorMessage,
              conversationOriginType: status.conversationOriginType,
            },
          });
        }

        // ── Heartbeat de conexão (Fase 11 — evidência real de vida) ──
        if (tenantId) {
          await touchMetaConnection({
            tenantId,
            wabaId,
            phoneNumberId,
            displayPhoneNumber,
            kind: 'delivery',
          });
        }

        await completeMetaEvent('outbound_status', status.externalEventId, 'processed', status.status);
        processed += 1;
      } catch (err) {
        console.error('[WhatsApp Webhook] processMetaStatuses item error (non-fatal):', err);
      }
    }
  }

  return processed;
}

/** Encontra a conversa ativa do guest para anexar o pricing (best-effort). */
async function resolveConversationIdForStatus(
  tenantId: string | null,
  recipientId: string
): Promise<string | null> {
  if (!tenantId) return null;
  try {
    const guest = await db.guest.findFirst({
      where: { tenantId, phone: recipientId },
      select: { id: true },
    });
    if (!guest) return null;
    const conversation = await db.conversationLog.findFirst({
      where: { tenantId, guestId: guest.id, status: 'active' },
      select: { id: true },
    });
    return conversation?.id ?? null;
  } catch {
    return null;
  }
}

// ══
// GET — Meta Webhook Verification
// ══


// ── LGPD: minimização de PII em logs (FASE 02B — FRENTE 30) ──────────────────
// Nunca logar número de hóspede completo nem conteúdo de mensagem.
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(unknown)';
  const raw = String(phone);
  return raw.length <= 4 ? '****' : `****${raw.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[WhatsApp Webhook] GET verification request:', {
    mode,
    token: token ? '***present***' : '***missing***',
    challenge: challenge ? '***present***' : '***missing***',
  });

  if (mode !== 'subscribe') {
    console.warn('[WhatsApp Webhook] ❌ Invalid hub.mode:', mode);
    return NextResponse.json(
      { error: 'Invalid mode. Expected "subscribe".' },
      { status: 403 }
    );
  }

  if (!META_VERIFY_TOKEN) {
    console.error('[WhatsApp Webhook] ❌ META_VERIFY_TOKEN not configured');
    return NextResponse.json(
      { error: 'Webhook verification not configured.' },
      { status: 500 }
    );
  }

  // timing-safe comparison para evitar timing attacks no verify token
  try {
    const received = Buffer.from(token || '');
    const expected = Buffer.from(META_VERIFY_TOKEN);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      console.warn('[WhatsApp Webhook] ❌ Token mismatch (timing-safe check)');
      return NextResponse.json(
        { error: 'Verification token mismatch.' },
        { status: 403 }
      );
    }
  } catch {
    console.warn('[WhatsApp Webhook] ❌ Token comparison error');
    return NextResponse.json(
      { error: 'Verification token mismatch.' },
      { status: 403 }
    );
  }

  if (!challenge) {
    console.warn('[WhatsApp Webhook] ❌ No hub.challenge provided');
    return NextResponse.json(
      { error: 'Missing hub.challenge.' },
      { status: 400 }
    );
  }

  console.log('[WhatsApp Webhook] ✅ Webhook verified successfully');

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ══
// POST — Meta Message Reception + Multi-Tenant Isolation
// ══

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ── Step 0: Guardas de abuso (portados do webhook legado — auditoria FASE 5)
  // O canônico é o webhook público da Meta; sem payload guard nem rate limit
  // ele ficava exposto (o legado tinha os dois). 413/429 são semânticos e
  // NÃO afetam a estratégia 200-de-rejeição-de-assinatura (anti-disable).
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
    console.error('[WhatsApp Webhook] ❌ Payload too large (max 1MB)');
    return NextResponse.json({ status: 'payload_too_large' }, { status: 413 });
  }
  const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = await webhookRatelimit.limit(`webhook:whatsapp:${sourceIp}`);
  if (!rate.success) {
    console.error('[WhatsApp Webhook] ❌ Rate limited:', sourceIp);
    return NextResponse.json({ status: 'rate_limited' }, { status: 429 });
  }

  // ── Step 1: Verify HMAC Signature (fail-closed)
  const signature = request.headers.get('x-hub-signature-256');

  const signatureCheck = verifyMetaSignature(rawBody, signature);
  if (!signatureCheck.valid) {
    console.error('[WhatsApp Webhook] ❌ Invalid signature:', signatureCheck.reason);
    // Retorna 200 para Meta não fazer retry, mas logamos o problema
    // (não queremos que Meta desabilite o webhook por 401)
    return NextResponse.json(
      { status: 'rejected', reason: signatureCheck.reason },
      { status: 200, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }

  // ── Step 2: Parse the payload safely 
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    console.error('[WhatsApp Webhook] ❌ Invalid JSON payload');
    return NextResponse.json({ status: 'invalid_json' }, { status: 400 });
  }

  // ── Step 3: Extract incoming messages 
  const messages = parseIncomingMessages(parsedBody);

  // ── Meta Foundation (Fase 6): processa STATUS OUTBOUND mesmo sem mensagens
  // inbound — é aqui que chega o pricing authoritative da Meta.
  if (messages.length === 0) {
    const statusesProcessed = await processMetaStatuses(parsedBody);
    if (statusesProcessed > 0) {
      const processingTime = Date.now() - startTime;
      console.log(`[WhatsApp Webhook] 📊 Status events processed: ${statusesProcessed} (${processingTime}ms)`);
      return NextResponse.json({ status: 'statuses_processed' }, { status: 200 });
    }
    const processingTime = Date.now() - startTime;
    console.log(`[WhatsApp Webhook] 📋 Non-message event acknowledged (${processingTime}ms)`);
    return NextResponse.json({ status: 'acknowledged' }, { status: 200 });
  }

  console.log(`[WhatsApp Webhook] 📨 Received ${messages.length} message(s)`);

  // ── Step 4: Multi-Tenant Isolation + Message Processing 
  const processingResults: Array<{
    messageId: string;
    from: string;
    destination: string;
    tenantFound: boolean;
    tenantId: string | null;
    accepted: boolean;
    reason?: string;
  }> = [];

  for (const msg of messages) {
    console.log(`[WhatsApp Webhook] 📨 Processing message from ${maskPhone(msg.from)} → ${maskPhone(msg.destinationNumber)} (type: ${msg.type})`);

    // ── Tenant lookup via resolveTenantByPhone (v2 — match exato E.164) 
    const lookup = await resolveTenantByPhone(msg.destinationNumber, msg.wabaId);

    if (!lookup.found) {
      console.warn(
        `[WhatsApp Webhook] ⚠️ SILENT DISCARD — No tenant for number ${msg.destinationNumber}` +
        ` | from: ${maskPhone(msg.from)} | msgId: ${msg.messageId}` +
        ` | reason: ${lookup.reason || 'unknown'}`
      );

      processingResults.push({
        messageId: msg.messageId,
        from: msg.from,
        destination: msg.destinationNumber,
        tenantFound: false,
        tenantId: null,
        accepted: false,
        reason: lookup.reason,
      });
      continue;
    }

    // ── Tenant found → check subscription status 
    if (lookup.tenantStatus === 'suspended' || lookup.tenantStatus === 'churned') {
      console.warn(
        `[WhatsApp Webhook] ⚠️ SILENT DISCARD — Tenant "${lookup.tenantName}" (${lookup.tenantId})` +
        ` is ${lookup.tenantStatus} | from: ${maskPhone(msg.from)} | msgId: ${msg.messageId}`
      );
      processingResults.push({
        messageId: msg.messageId,
        from: msg.from,
        destination: msg.destinationNumber,
        tenantFound: true,
        tenantId: lookup.tenantId,
        accepted: false,
        reason: `Tenant status: ${lookup.tenantStatus}`,
      });
      continue;
    }

    // ── Plan check — GRATUITO não pode receber mensagens reais 
    if (lookup.tenantPlan === 'gratuito') {
      console.warn(
        `[WhatsApp Webhook] ⚠️ SILENT DISCARD — Tenant "${lookup.tenantName}" (${lookup.tenantId})` +
        ` is on GRATUITO plan — real WhatsApp integration requires LITE+` +
        ` | from: ${maskPhone(msg.from)} | msgId: ${msg.messageId}`
      );
      processingResults.push({
        messageId: msg.messageId,
        from: msg.from,
        destination: msg.destinationNumber,
        tenantFound: true,
        tenantId: lookup.tenantId,
        accepted: false,
        reason: 'GRATUITO plan — upgrade required',
      });
      continue;
    }

    // ── Tenant OK → PROCESS 
    // FASE 02B (FRENTE 30): sem conteúdo de mensagem e sem telefone completo
    // em logs (LGPD — minimização). Tipo e tamanho bastam para triagem.
    console.log(
      `[WhatsApp Webhook] ✅ ACCEPTED — Tenant "${lookup.tenantName}" (${lookup.tenantId})` +
      ` | niche: ${lookup.niche} | plan: ${lookup.tenantPlan}` +
      ` | from: ${maskPhone(msg.from)}` +
      ` | type: ${msg.type}` +
      ` | textLength: ${msg.textContent ? msg.textContent.length : 0}`
    );

    const tenantId = lookup.tenantId!; // Guaranteed non-null após checks acima

    // ── Meta Foundation (Fase 5): IDEMPOTÊNCIA de mensagem inbound ──
    // Meta faz retry do webhook em timeout/5xx; sem idempotência a mensagem
    // seria processada (e respondida/cobrada) duas vezes.
    const inboundClaim = await claimMetaEvent('inbound_message', msg.messageId, {
      destination: msg.destinationNumber,
      from: msg.from,
      wabaId: msg.wabaId,
    });
    if (!inboundClaim.claimed) {
      console.log(`[WhatsApp Webhook] ♻️ Duplicate message ignored (idempotency): ${msg.messageId}`);
      processingResults.push({
        messageId: msg.messageId,
        from: msg.from,
        destination: msg.destinationNumber,
        tenantFound: true,
        tenantId,
        accepted: false,
        reason: 'DUPLICATE_MESSAGE_IDEMPOTENCY',
      });
      continue;
    }

    // ── Meta Foundation (Fase 9): captura de ATTRIBUTION (referral) ──
    // Fire-and-forget: falha de atribuição NUNCA quebra a conversa.
    // Referral cru → MetaReferralEvent normalizado (campos null, não undefined).
    void recordMetaAttribution({
      tenantId,
      guestPhone: msg.from,
      messageId: msg.messageId,
      referral: msg.referral
        ? {
            source: msg.referral.source_type ?? null,
            sourceId: msg.referral.source_id ?? null,
            sourceUrl: msg.referral.source_url ?? null,
            sourceType: msg.referral.source_type ?? null,
            headline: msg.referral.headline ?? null,
            body: msg.referral.body ?? null,
          }
        : null,
    }).catch((err) =>
      console.error('[WhatsApp Webhook] recordMetaAttribution error (non-fatal):', err)
    );

    // ── Meta Foundation (Fase 11): heartbeat real de webhook ──
    void touchMetaConnection({
      tenantId,
      wabaId: msg.wabaId,
      phoneNumberId: msg.phoneNumberId,
      displayPhoneNumber: msg.destinationNumber,
      kind: 'webhook',
    });

    if (msg.type === 'text' && msg.textContent) {
      const guestPhone = msg.from;
      const guestName = msg.contactName || undefined;
      const messageContent = msg.textContent;

      // ── CORREÇÃO v2 — finding 1.4: LGPD Opt-Out INTERCEPTADO SÍNCRONO 
      // Antes de enfileirar para o AI pipeline (que custa LLM tokens + Meta tariff),
      // verificamos se é um pedido de opt-out. Se for, processa imediatamente,
      // envia confirmação, e NÃO enfileira para IA.
      if (isOptOutMessage(messageContent)) {
        console.log(`[WhatsApp Webhook] 🚫 LGPD Opt-Out detectado — processando síncrono (tenant ${tenantId}, guest ${maskPhone(guestPhone)})`);

        // Fire-and-forget mas SEM bufferMessage — processa imediatamente
        (async () => {
          try {
            const guest = await resolveGuest(tenantId, {
              phone: guestPhone,
              profileName: guestName,
            });

            const confirmationText = await handleOptOut(tenantId, guest.id, 'whatsapp');

            // Envia confirmação de opt-out para o hóspede
            const sendResult = await sendWhatsAppMessage(guestPhone, confirmationText);
            if (!sendResult.success) {
              console.error(`[WhatsApp Webhook] ❌ Falha ao enviar confirmação opt-out para ${maskPhone(guestPhone)}: ${sendResult.error}`);
            } else {
              console.log(`[WhatsApp Webhook] ✅ Opt-out confirmado e enviado para ${maskPhone(guestPhone)}`);

              // Registra custo Meta (messageType = service_reply, dentro da service window)
              // PASSO 11.3: void explícito para fire-and-forget absoluto
              try {
                // Tenta encontrar conversationLog ativo para registrar o custo
                const conversation = await db.conversationLog.findFirst({
                  where: { tenantId, guestId: guest.id, status: 'active' },
                  select: { id: true },
                });
                if (conversation) {
                  void recordMetaCost({
                    tenantId,
                    conversationId: conversation.id,
                    guestId: guest.id,
                    messageType: 'service_reply',
                    intent: 'opt_out_confirmation',
                    withinServiceWindow: true,
                    metadata: {
                      provider: 'hardcoded_optout',
                      isSingleShot: true,
                      optOutMethod: 'keyword_whatsapp',
                    },
                  }).catch(err => console.error('[WhatsApp Webhook] recordMetaCost (opt-out) error:', err));
                }
              } catch (costError) {
                console.error('[WhatsApp Webhook] Erro ao buscar conversation para opt-out cost (non-fatal):', costError);
              }
            }
          } catch (err) {
            console.error(`[WhatsApp Webhook] ❌ Erro no handler de opt-out:`, err);
          }
        })();

        processingResults.push({
          messageId: msg.messageId,
          from: msg.from,
          destination: msg.destinationNumber,
          tenantFound: true,
          tenantId,
          accepted: true,
          reason: 'OPT_OUT_PROCESSED_SYNCHRONOUSLY',
        });
        continue; // NÃO enfileirar para IA
      }

      // ── Mensagem normal → buffer para AI pipeline 
      bufferMessage(
        {
          tenantId,
          guestPhone,
          guestName,
          messageContent,
          messageFrom: 'whatsapp',
        },
        async (payload) => {
          try {
            const result = await processIncomingMessage({
              tenantId: payload.tenantId,
              guestPhone: payload.guestPhone,
              guestName: payload.guestName,
              messageContent: payload.messageContent,
              messageFrom: payload.messageFrom,
            });

            // ── Onda correção/hardening: fecha ATTRIBUTION → CONVERSATION.
            // A attribution nasce antes da conversa (buffer); com o id em
            // mãos, linkamos por (tenantId, messageId) — fire-and-forget.
            if (result?.conversationId && msg.messageId) {
              void linkAttributionToConversation({
                tenantId,
                messageId: msg.messageId,
                conversationId: result.conversationId,
              }).catch((linkErr) =>
                console.error('[WhatsApp Webhook] linkAttributionToConversation error (non-fatal):', linkErr)
              );
            }

            // ── Phase 2: Bridge to DDC Notification Center 
            // Push "new lead" notification into the in-memory store so the
            // DDC mobile notification center sees it. Non-blocking — failures
            // must NOT break the AI pipeline.
            try {
              const nicheFromLookup = (lookup as any)?.niche ?? 'pousada';
              bridgeWhatsAppIncoming({
                niche: nicheFromLookup === 'airbnb' ? 'airbnb' : 'pousada',
                guestName: guestName ?? guestPhone,
                guestPhone,
                message: messageContent,
                tenantId,
                conversationId: result?.conversationId,
              });
            } catch (notifErr) {
              console.error('[WhatsApp Webhook] notification bridge error:', notifErr);
            }

            if (result.aiResponse) {
              const sendResult = await sendWhatsAppMessage(guestPhone, result.aiResponse);
              if (!sendResult.success) {
                console.error(
                  `[WhatsApp Webhook] ❌ Failed to send AI response to ${guestPhone}: ${sendResult.error}`
                );
                // NÃO registra custo Meta — mensagem não foi entregue
              } else if (sendResult.isMock) {
                // PASSO 11.3: void explícito para fire-and-forget absoluto
                if (process.env.META_COST_RECORD_MOCK === 'true' && result.metaCostRecord) {
                  void recordMetaCost({
                    tenantId,
                    conversationId: result.conversationId,
                    guestId: result.guestId,
                    messageId: result.metaCostRecord.aiMessageId,
                    messageType: result.metaCostRecord.messageType,
                    intent: result.metaCostRecord.intent,
                    withinServiceWindow: result.metaCostRecord.withinServiceWindow,
                    metadata: {
                      provider: result.metaCostRecord.providerId,
                      latencyMs: result.metaCostRecord.latencyMs,
                      isSingleShot: result.metaCostRecord.isSingleShot,
                      serviceWindowOpen: result.metaCostRecord.withinServiceWindow,
                      serviceWindowRemainingHours: result.metaCostRecord.serviceWindowRemainingHours,
                      isMock: true,
                    },
                  }).catch(err => console.error('[WhatsApp Webhook] recordMetaCost (mock) error:', err));
                }
              } else if (result.metaCostRecord) {
                // Envio real confirmado pela Meta — registra custo
                // PASSO 11.3: void explícito para fire-and-forget absoluto
                void recordMetaCost({
                  tenantId,
                  conversationId: result.conversationId,
                  guestId: result.guestId,
                  messageId: sendResult.messageId,
                  messageType: result.metaCostRecord.messageType,
                  intent: result.metaCostRecord.intent,
                  withinServiceWindow: result.metaCostRecord.withinServiceWindow,
                  metadata: {
                    provider: result.metaCostRecord.providerId,
                    latencyMs: result.metaCostRecord.latencyMs,
                    isSingleShot: result.metaCostRecord.isSingleShot,
                    serviceWindowOpen: result.metaCostRecord.withinServiceWindow,
                    serviceWindowRemainingHours: result.metaCostRecord.serviceWindowRemainingHours,
                    metaMessageId: sendResult.messageId,
                  },
                }).catch(err => console.error('[WhatsApp Webhook] recordMetaCost error:', err));
              }
            }
          } catch (err) {
            console.error(
              `[WhatsApp Webhook] ❌ Error in AI pipeline for tenant ${tenantId}, guest ${maskPhone(guestPhone)}:`,
              err
            );
          }
        }
      ).catch((err) => {
        console.error(
          `[WhatsApp Webhook] ❌ bufferMessage error for tenant ${tenantId}, guest ${maskPhone(guestPhone)}:`,
          err
        );
      });
    } else {
      // ── Non-text message → registra mídia, sem IA 
      const mediaNote = `[Mídia recebida: ${msg.type}]`;
      console.log(
        `[WhatsApp Webhook] 📎 Non-text message from ${maskPhone(msg.from)} (type: ${msg.type}) — recording media entry`
      );

      (async () => {
        try {
          const guest = await resolveGuest(tenantId, {
            phone: msg.from,
            profileName: msg.contactName || undefined,
          });

          // FASE 02B (FRENTE 01): lookup escalado-aware — mídia recebida durante
          // handover vai para a conversa escalada existente, NUNCA cria conversa
          // nova 'active' (que reabriria o canal para a IA).
          let conversation = await db.conversationLog.findFirst({
            where: {
              tenantId,
              guestId: guest.id,
              status: { in: ['active', 'escalated'] },
            },
            orderBy: { lastUpdate: 'desc' },
          });

          if (!conversation) {
            conversation = await db.conversationLog.create({
              data: {
                tenantId,
                guestId: guest.id,
                guestName: guest.name,
                guestPhone: msg.from,
                status: 'active',
                aiConfidence: 0,
                metadata: '{}',
              },
            });
          }

          await db.conversationMessage.create({
            data: {
              conversationId: conversation.id,
              from: 'guest',
              content: mediaNote,
              metadata: JSON.stringify({
                mediaType: msg.type,
                originalMessageId: msg.messageId,
              }),
            },
          });

          // Onda correção/hardening: fecha ATTRIBUTION → CONVERSATION (mídia)
          if (msg.messageId) {
            await linkAttributionToConversation({
              tenantId,
              messageId: msg.messageId,
              conversationId: conversation.id,
            });
          }
        } catch (err) {
          console.error(
            `[WhatsApp Webhook] ❌ Error recording non-text message from ${maskPhone(msg.from)}:`,
            err
          );
        }
      })();
    }

    processingResults.push({
      messageId: msg.messageId,
      from: msg.from,
      destination: msg.destinationNumber,
      tenantFound: true,
      tenantId: lookup.tenantId,
      accepted: true,
    });

    // ── Meta Foundation (Fase 5): evento aceito → marca como processado
    // para retries da Meta serem ignorados com segurança.
    void completeMetaEvent('inbound_message', msg.messageId, 'processed');
  }

  // ── Summary Logging 
  const accepted = processingResults.filter((r) => r.accepted).length;
  const discarded = processingResults.filter((r) => !r.accepted).length;
  const processingTime = Date.now() - startTime;

  console.log(
    `[WhatsApp Webhook] 📊 Batch complete: ${accepted} accepted, ${discarded} discarded` +
    ` | ${processingTime}ms | ${messages.length} total messages`
  );

  return NextResponse.json(
    {
      status: 'processed',
      summary: {
        total: messages.length,
        accepted,
        discarded,
        processingTimeMs: processingTime,
      },
    },
    {
      status: 200,
      headers: {
        'X-Security-Shield': 'zero-trust-v2',
        'X-Processing-Time': `${processingTime}ms`,
      },
    }
  );
}
