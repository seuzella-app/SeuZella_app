// ============================================================================
// JEV — Firewall de privacidade (allowlist por modo) — RUN22-A
// ============================================================================
// Camada ADITIVA que complementa o pii-guard existente da casa (src/lib/ai/
// pii-guard.ts). Princípio: NEGAR POR PADRÃO — só atravessa a fronteira de
// decisão o campo que estiver na allowlist DO MODO, já truncado e com padrões
// de PII ofuscados. Estruturas profundas, funções e campos desconhecidos são
// descartados. Na onda SHADOW_ONLY nada sai do processo; o firewall existe
// desde já para que a onda remota herde a mesma fronteira sem retrabalho.
// ============================================================================

import type { JevDecisionMode } from '../../../domain/decision/contracts/JevTypes';

export const JEV_MAX_TEXT_LEN = 512;
export const JEV_MAX_FIELDS = 16;
export const JEV_MAX_ARRAY_ITEMS = 20;

/** Padrões de PII ofuscados em qualquer string que atravesse a fronteira. */
const JEV_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JEV_PHONE_RE = /(?:\+?\d{2,3}[\s.-]?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

/** Allowlist por modo (deny-by-default). Espelha os sinais que os handlers
 * já usam hoje (tf-client USE_TF_*, cerebro). Campos fora da lista são
 * descartados — nunca "passam para ver se serve". */
export const JEV_MODE_ALLOWED_FIELDS: Record<JevDecisionMode, readonly string[]> = {
  INTENT: ['text', 'channel', 'language'],
  SENTIMENT: ['text', 'channel'],
  CHURN: ['recencyDays', 'bookingCount', 'npsScore', 'cancellationCount'],
  LEAD: ['text', 'hasContact', 'partySize', 'nightsHint'],
  ANOMALY: ['metric', 'deviation', 'baseline', 'window'],
  OCCUPANCY: ['rate', 'leadTimeDays', 'channel'],
  UPSELL: ['partySize', 'nights', 'totalValue', 'tier'],
};

function redactPii(text: string): string {
  return text.replace(JEV_EMAIL_RE, '[redacted-email]').replace(JEV_PHONE_RE, '[redacted-phone]');
}

function sanitizeScalar(v: unknown): string | number | boolean | null {
  if (typeof v === 'string') {
    return redactPii(v).slice(0, JEV_MAX_TEXT_LEN);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'boolean') {
    return v;
  }
  return null; // objetos/funções/undefined/symbol/bigint não cruzam a fronteira
}

function sanitizeArray(v: unknown[]): Array<string | number | boolean> {
  const out: Array<string | number | boolean> = [];
  for (const item of v) {
    const s = sanitizeScalar(item);
    if (s !== null) out.push(s);
    if (out.length >= JEV_MAX_ARRAY_ITEMS) break;
  }
  return out;
}

/**
 * Minimiza o payload para o modo informado. Nunca lança: entrada inválida
 * devolve objeto vazio (fail-closed) — a decisão segue com o que sobrar ou o
 * adapter reporta baixa confiança; NADA de dados desconhecidos atravessa.
 */
export function sanitizeJevPayload(
  mode: JevDecisionMode,
  payload: Record<string, unknown>,
): Record<string, string | number | boolean | Array<string | number | boolean>> {
  if (typeof mode !== 'string' || !(mode in JEV_MODE_ALLOWED_FIELDS)) {
    return {};
  }
  const allowed = JEV_MODE_ALLOWED_FIELDS[mode];
  const out: Record<string, string | number | boolean | Array<string | number | boolean>> = {};
  let kept = 0;
  for (const field of allowed) {
    if (kept >= JEV_MAX_FIELDS) break;
    if (!(field in payload)) continue;
    const value = payload[field];
    if (Array.isArray(value)) {
      const arr = sanitizeArray(value);
      if (arr.length > 0) {
        out[field] = arr;
        kept += 1;
      }
      continue;
    }
    const scalar = sanitizeScalar(value);
    if (scalar !== null) {
      out[field] = scalar;
      kept += 1;
    }
  }
  return out;
}
