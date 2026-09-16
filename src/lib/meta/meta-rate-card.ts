// ==============================================================================
// ZÉLLA — Meta Rate Card 2026 (Fase 6 / Fase 7 / Fase 8)
// ==============================================================================
// RATE CARD = DADOS DE ESTIMATIVA, NÃO FONTE DE COBRANÇA.
//
// Regra canônica:
//   Meta status pricing.billable = autoridade de cobrança.
//   O rate card abaixo só serve para estimativas quando a Meta não devolve
//   um valor monetário no status. Nunca apresentar uma estimativa como fatura.
//
// Brasil — rate card publicado para 01/07/2026:
//   marketing       R$ 0,3217
//   utility         R$ 0,0350
//   authentication  R$ 0,0350
//   service         R$ 0,0350 a partir de 01/10/2026
//   marketing_lite  usa a tarifa de marketing
// ==============================================================================

import { MetaPricingCategory } from './meta-types';

export type MetaMarket = 'BR' | 'US' | string;
export type MetaCurrency = 'BRL' | 'USD' | string;

export interface MetaRateCardEntry {
  market: MetaMarket;
  currency: MetaCurrency;
  category: MetaPricingCategory;
  rate: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export const META_RATE_CARD_BR: MetaRateCardEntry[] = [
  {
    market: 'BR',
    currency: 'BRL',
    category: 'marketing',
    rate: 0.3217,
    effectiveFrom: '2026-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'marketing_lite',
    rate: 0.3217,
    effectiveFrom: '2026-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'utility',
    rate: 0.035,
    effectiveFrom: '2026-07-01',
    effectiveUntil: null,
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'authentication',
    rate: 0.035,
    effectiveFrom: '2026-07-01',
    effectiveUntil: null,
  },
  // Mantida como entrada histórica para resolver corretamente a vigência;
  // billable=false antes de outubro é decidido pela função de política abaixo.
  {
    market: 'BR',
    currency: 'BRL',
    category: 'service',
    rate: 0.035,
    effectiveFrom: '2026-07-01',
    effectiveUntil: '2026-09-30',
  },
  {
    market: 'BR',
    currency: 'BRL',
    category: 'service',
    rate: 0.035,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  },
];

export function isCustomerServiceWindowOpen(
  lastGuestMessageAt?: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastGuestMessageAt) return false;
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - lastGuestMessageAt.getTime();
  return elapsed >= 0 && elapsed < WINDOW_MS;
}

export function getServiceWindowRemainingHours(
  lastGuestMessageAt?: Date | null,
  now: Date = new Date()
): number {
  if (!lastGuestMessageAt) return 0;
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const remainingMs = WINDOW_MS - (now.getTime() - lastGuestMessageAt.getTime());
  return Math.max(0, Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10);
}

/**
 * Política de cobrança usada apenas para estimativa.
 * A decisão final é sempre o `pricing.billable` enviado pela Meta.
 */
export function isMetaMessageBillable(params: {
  category: MetaPricingCategory;
  withinServiceWindow: boolean;
  at?: Date;
}): boolean {
  const { category, at = new Date() } = params;

  if (category === 'UNKNOWN') return false;
  if (category === 'service') return at >= new Date('2026-10-01T00:00:00Z');

  // Utility/authentication/marketing/marketing_lite são billable quando a
  // Meta marca o envio como cobrável. A janela de 24h não é uma prova de
  // gratuidade.
  return true;
}

/** Nunca faz fallback silencioso para BR: mercado desconhecido = sem estimativa. */
export function resolveRateCardEntry(params: {
  market: MetaMarket;
  category: MetaPricingCategory;
  at?: Date;
}): MetaRateCardEntry | null {
  const { market, category, at = new Date() } = params;
  if (category === 'UNKNOWN') return null;

  const marketCode = market.trim().toUpperCase();
  if (marketCode !== 'BR') return null;

  const candidates = META_RATE_CARD_BR
    .filter((entry) => entry.market === marketCode && entry.category === category)
    .filter((entry) => new Date(entry.effectiveFrom) <= at)
    .filter((entry) => entry.effectiveUntil === null || new Date(entry.effectiveUntil) >= at)
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  return candidates[0] ?? null;
}

export function estimateMetaCost(params: {
  market: MetaMarket;
  category: MetaPricingCategory;
  withinServiceWindow: boolean;
  at?: Date;
}): { cost: number; currency: MetaCurrency; estimated: true; billable: boolean } | null {
  const { market, category, withinServiceWindow, at = new Date() } = params;
  if (category === 'UNKNOWN') return null;

  const billable = isMetaMessageBillable({ category, withinServiceWindow, at });
  const entry = resolveRateCardEntry({ market, category, at });
  if (!entry) return null;

  if (!billable) {
    return { cost: 0, currency: entry.currency, estimated: true, billable: false };
  }

  return { cost: entry.rate, currency: entry.currency, estimated: true, billable: true };
}
