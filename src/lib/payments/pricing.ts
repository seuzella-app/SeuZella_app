// ==============================================================================
// SEUZÉLLA — Single Source of Truth for Pricing
// ==============================================================================
// Replaces the 4 duplicated pricing tables that existed across:
//   - src/app/api/checkout/create/route.ts (PRICING constant)
//   - src/app/api/checkout/upgrade/route.ts
//   - src/app/api/checkout/downgrade/route.ts
//   - src/lib/plan-features.ts (PLAN_DISPLAY price)
//
// Sprint 1, Day 2: Centralize pricing. All checkout routes MUST import from here.
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';
import type { PaymentMethod } from './types';

// ── Canonical pricing matrix ──────────────────────────────────────────────────
// Rows = plan tier, Columns = payment method
// Values = monthly price in BRL
//
// Business rules (validated against plan-features.ts PLAN_DISPLAY):
//   - LITE: R$197 (PIX) / R$247 (cartão) — premium for card due to acquirer fees
//   - PRO:  R$397 flat (PIX or card — premium plan absorbs card fees)
//   - MAX:  R$797 flat
//   - PARCEIRO: R$247 flat (treated as subscription, PIX or card)
//   - GRATUITO: R$0 (free trial, no payment required)
//
// NOTE: ARPU math from the 18-month strategic report assumed R$330 ARPU.
// With current matrix the blended ARPU is R$220 (LITE PIX dominant).
// Raising LITE card price to R$247 (already in matrix) moves blended ARPU
// closer to R$280. Hitting R$330 ARPU requires either:
//   (a) Pushing 60%+ of base to PRO, OR
//   (b) Introducing annual prepay at 10% discount (improves cash flow + LTV)
// ==============================================================================
export const PRICING_MATRIX: Record<PlanTier, Record<PaymentMethod, number>> = {
  gratuito: { pix: 0, cartao: 0, boleto: 0 },
  lite: { pix: 197, cartao: 247, boleto: 207 },
  pro: { pix: 397, cartao: 397, boleto: 407 },
  max: { pix: 797, cartao: 797, boleto: 807 },
  parceiro: { pix: 297, cartao: 297, boleto: 307 },
};

// ── Payment methods allowed per plan ──────────────────────────────────────────
// PRO and MAX accept all 3 methods (card, PIX, boleto).
// LITE and PARCEIRO accept PIX and boleto only (card fee too high relative to plan price).
// GRATUITO requires no payment.
//
// NOTE: This is the Sprint 1 correction of the previous hard rule
// "PRO/MAX só aceitam cartão" which leaked revenue (forced card decline → lost sale).
// New rule: every paid plan accepts PIX (cheapest, instant); card and boleto optional.
export const ALLOWED_METHODS: Record<PlanTier, PaymentMethod[]> = {
  gratuito: [],
  lite: ['pix', 'boleto', 'cartao'],
  pro: ['pix', 'cartao', 'boleto'],
  max: ['pix', 'cartao', 'boleto'],
  parceiro: ['pix', 'boleto', 'cartao'],
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface PriceQuote {
  planTier: PlanTier;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: 'BRL';
  interval: 'monthly';
}

export function getPrice(planTier: PlanTier, paymentMethod: PaymentMethod): PriceQuote {
  const amount = PRICING_MATRIX[planTier]?.[paymentMethod];
  if (amount === undefined) {
    throw new Error(`Invalid plan/method combo: ${planTier}/${paymentMethod}`);
  }
  return {
    planTier,
    paymentMethod,
    amount,
    currency: 'BRL',
    interval: 'monthly',
  };
}

export function isMethodAllowed(planTier: PlanTier, paymentMethod: PaymentMethod): boolean {
  return ALLOWED_METHODS[planTier]?.includes(paymentMethod) ?? false;
}

export function listAllowedMethods(planTier: PlanTier): PaymentMethod[] {
  return ALLOWED_METHODS[planTier] ?? [];
}

// ── Annual prepay (10% discount) — future lever for ARPU improvement ──────────
export const ANNUAL_DISCOUNT_RATE = 0.10; // 10% off when paying 12 months upfront

export function getAnnualPrice(planTier: PlanTier, paymentMethod: PaymentMethod): number {
  const monthly = getPrice(planTier, paymentMethod).amount;
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT_RATE));
}
