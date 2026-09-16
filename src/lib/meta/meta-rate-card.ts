// ==============================================================================
// ZÉLLA — Meta Rate Card 2026 (Fase 6 / Fase 7 / Fase 8)
// ==============================================================================
// PREÇOS META = DADOS DE CONFIGURAÇÃO VERSIONADOS, NÃO LÓGICA ESPALHADA.
//
// Regras implementadas:
//  1. Meta aceitou o envio  ≠  Meta cobrou. O evento AUTHORITATIVE de billing
//     é o status da Meta com pricing.billable=true (Fase 6).
//  2. Rate card configurável por market / currency / category / effectiveFrom /
//     effectiveUntil (Fase 7). Sem conversão USD→BRL com câmbio fixo: a
//     currency é registrada junto com o custo, do jeito que a Meta reporta.
//  3. Mudança de outubro/2026 (Fase 8): mensagens de serviço passam a ser
//     cobradas a partir de 01/10/2026 e utility templates dentro da janela de
//     atendimento passam a ser cobrados. A janela de 24h CONTINUA existindo
//     como regra de envio — ela NÃO é sinônimo de "mensagem grátis".
//  4. Categoria desconhecida → UNKNOWN: registrar, não descartar, não inventar
//     preço.
// ==============================================================================

import { MetaPricingCategory } from './meta-types';

export type MetaMarket = 'BR' | 'US' | string;
export type MetaCurrency = 'BRL' | 'USD' | string;

export interface MetaRateCardEntry {
  market: MetaMarket;
  currency: MetaCurrency;
  category: MetaPricingCategory;
  /** Preço por mensagem na moeda do rate card. */
  rate: number;
  effectiveFrom: string; // ISO date
  effectiveUntil: string | null; // ISO date (null = vigente)
}

/**
 * RATE CARD — Brasil (dados de configuração versionados).
 *
 * Fonte: pricing público da Meta para marketing/utility/authentication/service.
 * Valores marcados como REFERENCE: são referências de configuração, o custo
 * AUTHORITATIVE sempre vem do webhook de status da Meta quando disponível
 * (source='meta_webhook_pricing').
 *
 * ⚠️ Os valores abaixo devem ser revisados contra o painel da Meta antes de
 * qualquer faturamento real de cliente. Eles existem para permitir ESTIMATIVA
 * explícita (estimated=true) — nunca para simular cobrança real.
 */
export const META_RATE_CARD_BR: MetaRateCardEntry[] = [
  // ── Período pré 01/10/2026: service dentro da janela não é billable ──
  {
    market: 'BR',
    currency: 'BRL',
    category: 'service',
    rate: 0.0315,
    effectiveFrom: '2025-07-01',
    effectiveUntil: '2026-09-30',
  },
  // ── Mudança de outubro 2026: service passa a ser cobrado ──
  {
    market: 'BR',
    currency: 'BRL',
    category: 'service',
    rate: 0.0315,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'utility',
    rate: 0.0315,
    effectiveFrom: '2025-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'authentication',
    rate: 0.0315,
    effectiveFrom: '2025-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'marketing',
    rate: 0.1875,
    effectiveFrom: '2025-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'marketing_lite',
    rate: 0.0938,
    effectiveFrom: '2025-07-01',
    effectiveUntil: null,
  },
];

// ── Janela de atendimento vs cobrança (Fase 8 — responsabilidades separadas) ─

/**
 * A janela de 24h Customer Service Window é uma regra de ENVIO (quando o
 * negócio pode usar templates de utilidade/serviço). Ela NÃO determina
 * cobrança. Use isMetaMessageBillable() para cobrança.
 */
export function isCustomerServiceWindowOpen(lastGuestMessageAt?: Date | null, now: Date = new Date()): boolean {
  if (!lastGuestMessageAt) return false;
  const WINDOW_HOURS = 24;
  const elapsed = now.getTime() - lastGuestMessageAt.getTime();
  return elapsed >= 0 && elapsed < WINDOW_HOURS * 60 * 60 * 1000;
}

/** Horas restantes na janela de 24h (0 = fechada). */
export function getServiceWindowRemainingHours(lastGuestMessageAt?: Date | null, now: Date = new Date()): number {
  if (!lastGuestMessageAt) return 0;
  const WINDOW_HOURS = 24;
  const remainingMs =
    WINDOW_HOURS * 60 * 60 * 1000 - (now.getTime() - lastGuestMessageAt.getTime());
  return Math.max(0, Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10);
}

/**
 * Cobrança por categoria + vigência:
 *  - Antes de 01/10/2026: service dentro da janela de 24h NÃO é billable;
 *    utility template dentro da janela JÁ é billable conforme o pricing atual
 *    da Meta (utility responses fora de template são o que muda em 10/2026).
 *  - A partir de 01/10/2026: service passa a ser billable (nova regra Meta).
 *
 * ⚠️ Esta função expressa a política de COBRANÇA. A política de ENVIO continua
 * sendo a janela de 24h (isCustomerServiceWindowOpen). Nunca misturar.
 */
export function isMetaMessageBillable(params: {
  category: MetaPricingCategory;
  withinServiceWindow: boolean;
  /** Data do evento de status da Meta (default: agora). */
  at?: Date;
}): boolean {
  const { category, withinServiceWindow, at = new Date() } = params;

  if (category === 'UNKNOWN') {
    // Sem categoria conhecida não assumimos billable nem free — quem decide é
    // o pricing.billable do status da Meta. Estimativa fica conservadora.
    return false;
  }

  const SERVICE_PAID_FROM = new Date('2026-10-01T00:00:00Z');

  if (category === 'service') {
    if (at < SERVICE_PAID_FROM) return false; // dentro da janela => free era regra pré-10/2026
    return true; // 01/10/2026+: service é cobrado
  }

  // marketing / utility / authentication / marketing_lite são billables por
  // natureza quando enviados via template. Utility template DENTRO da janela
  // passa a ser explicitamente cobrado conforme a mudança de outubro/2026
  // (Fase 8) — a janela nunca foi sinônimo de "mensagem grátis" para templates.
  return true;
}

/** Entrada vigente do rate card para market/categoria/data. */
export function resolveRateCardEntry(params: {
  market: MetaMarket;
  category: MetaPricingCategory;
  at?: Date;
}): MetaRateCardEntry | null {
  const { market, category, at = new Date() } = params;
  if (category === 'UNKNOWN') return null;

  const cards = market.toUpperCase() === 'BR' ? META_RATE_CARD_BR : META_RATE_CARD_BR;
  const candidates = cards
    .filter((e) => e.category === category)
    .filter((e) => new Date(e.effectiveFrom) <= at)
    .filter((e) => e.effectiveUntil === null || new Date(e.effectiveUntil) >= at)
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  return candidates[0] ?? null;
}

/**
 * Estimativa de custo a partir do rate card.
 * SEMPRE retorna estimated=true — o custo real (authoritative) só vem da Meta.
 */
export function estimateMetaCost(params: {
  market: MetaMarket;
  category: MetaPricingCategory;
  withinServiceWindow: boolean;
  at?: Date;
}): { cost: number; currency: MetaCurrency; estimated: true; billable: boolean } | null {
  const { market, category, withinServiceWindow, at = new Date() } = params;
  // UNKNOWN: sem estimativa possível — registrar evento sem preço inventado
  // (a decisão de billing pertence ao pricing.billable do status da Meta).
  if (category === 'UNKNOWN') return null;

  const billable = isMetaMessageBillable({ category, withinServiceWindow, at });
  if (!billable) return { cost: 0, currency: 'BRL', estimated: true, billable: false };

  const entry = resolveRateCardEntry({ market, category, at });
  if (!entry) return null; // sem preço inventado
  return { cost: entry.rate, currency: entry.currency, estimated: true, billable: true };
}
