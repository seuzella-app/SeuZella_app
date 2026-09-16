// ==============================================================================
// ZÉLLA — Meta Event Normalizer (Fase 4)
// ==============================================================================
// Transforma payloads crus do webhook Meta (messages / statuses) nos contratos
// normalizados: MetaInboundMessage | MetaOutboundStatus (com MetaPricingEvent e
// MetaReferralEvent). NÃO processa, NÃO persiste, NÃO decide tenant — só
// normaliza com segurança (nunca lança para payload malformado).
// ==============================================================================

import {
  MetaInboundMessage,
  MetaOutboundStatus,
  MetaPricingEvent,
  MetaReferralEvent,
  MetaChannel,
  MetaPricingCategory,
  normalizeMetaPricingCategory,
} from './meta-types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeReferral(raw: unknown): MetaReferralEvent | null {
  const ref = asRecord(raw);
  if (!ref) return null;
  return {
    source: str(ref.source),
    sourceId: str(ref.source_id),
    sourceUrl: str(ref.source_url),
    sourceType: str(ref.source_type),
    headline: str(ref.headline),
    body: str(ref.body),
  };
}

function normalizePricing(messageId: string, raw: unknown): MetaPricingEvent | null {
  const p = asRecord(raw);
  if (!p) return null;
  const category: MetaPricingCategory = normalizeMetaPricingCategory(p.category);
  return {
    messageId,
    billable: p.billable === true,
    pricingModel: str(p.pricing_model),
    category,
    // `cost` raramente vem no payload; se vier, usamos como authoritative.
    cost: typeof p.cost === 'number' && Number.isFinite(p.cost) ? p.cost : null,
    currency: str(p.currency),
  };
}

function normalizeStatus(raw: unknown): MetaOutboundStatus | null {
  const s = asRecord(raw);
  if (!s) return null;
  const messageId = str(s.id);
  if (!messageId) return null;

  const VALID_STATUSES = ['sent', 'delivered', 'read', 'failed', 'deleted', 'undelivered'] as const;
  const rawStatus = str(s.status) ?? 'unknown';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as MetaOutboundStatus['status'])
    : 'unknown';

  const conversation = asRecord(s.conversation);
  const origin = asRecord(conversation?.origin);

  return {
    tenantId: null, // resolvido a montante pelo caller (multi-tenant)
    channel: 'WHATSAPP', // Instagram terá contrato próprio (Fase 12)
    eventType: 'message.status',
    externalEventId: messageId,
    timestamp: new Date(Number(s.timestamp) * 1000 || Date.now()),
    source: 'meta_webhook',
    metadata: {},
    status,
    recipientId: str(s.recipient_id) ?? '',
    errorMessage:
      Array.isArray(s.errors) && s.errors.length > 0
        ? String((asRecord(s.errors[0]) as { message?: unknown })?.message ?? 'meta_error')
        : null,
    conversationOriginType: str(origin?.type),
    conversationExpirationTimestamp:
      typeof conversation?.expiration_timestamp === 'number'
        ? (conversation.expiration_timestamp as number)
        : null,
    pricing: normalizePricing(messageId, s.pricing),
  };
}

/** Normaliza um `value` de webhook (field=messages) em mensagens inbound. */
export function normalizeMetaInboundMessages(
  value: Record<string, unknown>,
  wabaId: string,
  channel: MetaChannel = 'WHATSAPP'
): MetaInboundMessage[] {
  const out: MetaInboundMessage[] = [];

  const metadata = asRecord(value.metadata);
  const displayPhoneNumber = str(metadata?.display_phone_number) ?? '';
  const phoneNumberId = str(metadata?.phone_number_id) ?? '';
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const contactMap = new Map<string, string | null>();
  for (const c of contacts) {
    const rec = asRecord(c);
    const waId = str(rec?.wa_id);
    if (waId) contactMap.set(waId, str(asRecord(rec?.profile)?.name));
  }

  const messages = Array.isArray(value.messages) ? value.messages : [];
  for (const msg of messages) {
    const m = asRecord(msg);
    if (!m) continue;
    const messageId = str(m.id);
    const from = str(m.from);
    if (!messageId || !from) continue;

    const textObj = asRecord(m.text);
    const referral = normalizeReferral(m.referral);

    out.push({
      tenantId: null,
      channel,
      eventType: 'message.received',
      externalEventId: messageId,
      timestamp: new Date(Number(m.timestamp) * 1000 || Date.now()),
      source: 'meta_webhook',
      metadata: {},
      from,
      profileName: contactMap.get(from) ?? null,
      displayPhoneNumber,
      phoneNumberId,
      wabaId,
      messageText: m.type === 'text' ? str(textObj?.body) : null,
      messageType: str(m.type) ?? 'unknown',
      referral,
    });
  }

  return out;
}

/** Normaliza um `value` de webhook (field=messages) em status outbound. */
export function normalizeMetaOutboundStatuses(value: Record<string, unknown>): MetaOutboundStatus[] {
  const statuses = Array.isArray(value.statuses) ? value.statuses : [];
  const out: MetaOutboundStatus[] = [];
  for (const s of statuses) {
    const normalized = normalizeStatus(s);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** Extrai todos os `values` de um payload bruto de webhook. */
export function extractWebhookValues(rawBody: unknown): Array<{
  wabaId: string;
  field: string;
  value: Record<string, unknown>;
}> {
  const out: Array<{ wabaId: string; field: string; value: Record<string, unknown> }> = [];
  const body = asRecord(rawBody);
  if (!body || body.object !== 'whatsapp_business_account') return out;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const e = asRecord(entry);
    if (!e) continue;
    const wabaId = str(e.id) ?? '';
    const changes = Array.isArray(e.changes) ? e.changes : [];
    for (const change of changes) {
      const c = asRecord(change);
      if (!c) continue;
      const field = str(c.field) ?? '';
      const value = asRecord(c.value);
      if (field && value) out.push({ wabaId, field, value });
    }
  }
  return out;
}
