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
//
// IMPORTANTE:
// - descontos por volume podem reduzir utility/authentication;
// - a tarifa efetiva depende do mercado do destinatário e da conta;
// - por isso o rate card nunca substitui a reconciliação com Meta.
// ==============================================================================

import { MetaPricingCategory } from './meta-types';

export type MetaMarket = 'BR' | 'US' | string;
export type MetaCurrency = 'BRL' | 'USD' | string;

export interface MetaRateCardEntry {
  market: MetaMarket;
  currency: MetaCurrency;
  category: MetaPricingCategory;
  /** Preço de lista por mensagem na moeda do rate card. */
  rate: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

/**
 * Rate card brasileiro de referência.
 *
 * Os valores são usados SOMENTE para estimativa. O custo real deve ser
 * reconciliado pelo status da Meta (`pricing.billable`) e, quando disponível,
 * pelo valor retornado/fornecido pelo sistema de billing da Meta.
 */
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
  {
    market: 'BR',
    currency: 'BRL',
    category: 'service',
    rate: 0.035,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  },
];

/** Janela de atendimento de 24h = regra de envio, não regra de gratuidade. */
export function isCustomerServiceWindowOpen(
  lastGuestMessageAt?: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastGuestMessageAt) return false;
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - lastGuestMessageAt.getTime();
  return elapsed >= 0 && elapsed < WINDOW_MS;
}

/** Horas restantes na janela de 24h (0 = fechada). */
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

  // Antes de 01/10/2026, respostas service dentro da janela eram gratuitas.
  // A partir de 01/10/2026, service passa a ser cobrado por mensagem.
  if (category === 'service') {
    return at >= new Date('2026-10-01T00:00:00Z');
  }

  // Utility/authentication/marketing/marketing_lite são categorias billable
  // quando a Meta marca o envio como cobrável. A janela de 24h não deve ser
  // usada para inferir gratuidade.
  return true;
}

/** Entrada vigente para o mercado solicitado. Nunca faz fallback silencioso
 * para BR: mercado desconhecido = sem estimativa, evitando preço inventado. */
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

/**
 * Estimativa explícita. Sempre `estimated=true`.
 * O mercado precisa ser conhecido; sem mercado não precificamos por suposição.
 */
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

  return {
    cost: entry.rate,
    currency: entry.currency,
    estimated: true,
    billable: true,
  };
}
