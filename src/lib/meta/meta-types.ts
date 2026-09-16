// ==============================================================================
// ZÉLLA — Meta Foundation Types (Fase 1 / Fase 4)
// ==============================================================================
// Contratos normalizados para TODOS os eventos externos da Meta.
//
// REGRA CANÔNICA: Meta NÃO é o cérebro do Zélla. Meta é canal, distribuição,
// identidade, aquisição e infraestrutura de conversas. O Cérebro Zélla continua
// responsável por contexto hoteleiro, memória, conhecimento, raciocínio,
// ferramentas e aprendizagem.
//
// Todo evento normalizado carrega:
//   tenantId | channel | eventType | externalEventId | timestamp | source | metadata
// ==============================================================================

export type MetaChannel = 'WHATSAPP' | 'INSTAGRAM';

export type MetaPricingCategory =
  | 'marketing'
  | 'utility'
  | 'authentication'
  | 'service'
  | 'marketing_lite'
  | 'UNKNOWN';

/**
 * Categorias oficiais conhecidas pela Meta (Cloud API).
 * Qualquer categoria fora desta lista é registrada como 'UNKNOWN'
 * (nunca descartada, nunca inventada, nunca precificada por suposição).
 */
export const KNOWN_META_PRICING_CATEGORIES: readonly string[] = [
  'marketing',
  'utility',
  'authentication',
  'service',
  'marketing_lite',
];

export function normalizeMetaPricingCategory(raw: unknown): MetaPricingCategory {
  if (typeof raw !== 'string' || raw.trim() === '') return 'UNKNOWN';
  const value = raw.trim().toLowerCase();
  return (KNOWN_META_PRICING_CATEGORIES as readonly string[]).includes(value)
    ? (value as MetaPricingCategory)
    : 'UNKNOWN';
}

// ── Estados de conexão (Fase 10 — DDC META CONNECT) ─────────────────────────

export type MetaConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'PENDING'
  | 'CONNECTED'
  | 'ERROR'
  | 'DISCONNECTED';

export type MetaVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED';

/**
 * Estado de capacidade do Meta Business Agent (Fase 13).
 * DEFAULT é SEMPRE disabled — o Zélla Brain permanece principal.
 */
export interface MetaBusinessAgentCapability {
  businessAgentAvailable: boolean;
  businessAgentEnabled: boolean;
  businessAgentProvider: 'meta' | 'none';
  businessAgentBillingModel: 'meta_one_essential' | 'meta_one_advanced' | 'meta_one_expert' | 'meta_one_max' | 'none';
}

// ── Eventos normalizados (Fase 4) ────────────────────────────────────────────

export interface MetaEventEnvelope {
  tenantId: string | null;
  channel: MetaChannel;
  eventType: string;
  externalEventId: string;
  timestamp: Date;
  source: 'meta_webhook' | 'meta_status_poll' | 'internal';
  metadata: Record<string, unknown>;
}

/** Mensagem inbound normalizada (WhatsApp ou Instagram). */
export interface MetaInboundMessage extends MetaEventEnvelope {
  eventType: 'message.received';
  channel: MetaChannel;
  externalEventId: string; // wamid da Meta
  from: string; // wa_id do remetente
  profileName: string | null;
  displayPhoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  messageText: string | null;
  messageType: string;
  referral: MetaReferralEvent | null;
}

/** Status outbound normalizado (sent/delivered/read/failed...). */
export interface MetaOutboundStatus extends MetaEventEnvelope {
  eventType: 'message.status';
  channel: MetaChannel;
  externalEventId: string; // wamid da mensagem enviada
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | 'undelivered' | 'unknown';
  recipientId: string;
  errorMessage: string | null;
  conversationOriginType: string | null;
  conversationExpirationTimestamp: number | null;
  pricing: MetaPricingEvent | null;
}

/** Evento de pricing authoritative (vindo do status da Meta — Fase 6). */
export interface MetaPricingEvent {
  messageId: string;
  billable: boolean;
  pricingModel: string | null;
  category: MetaPricingCategory;
  /** Custo informado pela Meta (quando presente no payload). */
  cost: number | null;
  currency: string | null;
}

/** Evento de referral — Click-to-WhatsApp / entry point (Fase 9). */
export interface MetaReferralEvent {
  source: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  headline: string | null;
  body: string | null;
}

/** Chave de resolução de tenant a partir do webhook (multi-tenant). */
export interface MetaTenantResolutionKey {
  displayPhoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
}
