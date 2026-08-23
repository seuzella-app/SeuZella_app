import { describe, expect, it } from 'vitest';
import {
  PRICING_MATRIX,
  ALLOWED_METHODS,
  ANNUAL_DISCOUNT_RATE,
  getPrice,
  isMethodAllowed,
  listAllowedMethods,
  getAnnualPrice,
} from '@/lib/payments/pricing';

describe('PRICING_MATRIX — canonical pricing source', () => {
  it('defines 5 plan tiers', () => {
    const plans = Object.keys(PRICING_MATRIX);
    expect(plans.sort()).toEqual(['gratuito', 'lite', 'max', 'parceiro', 'pro']);
  });

  it('every plan defines all 3 payment methods (pix, cartao, boleto)', () => {
    for (const [plan, methods] of Object.entries(PRICING_MATRIX)) {
      expect(methods.pix, `${plan}.pix must be defined`).toBeDefined();
      expect(methods.cartao, `${plan}.cartao must be defined`).toBeDefined();
      expect(methods.boleto, `${plan}.boleto must be defined`).toBeDefined();
    }
  });

  it('gratuito is R$0 across all methods', () => {
    expect(PRICING_MATRIX.gratuito.pix).toBe(0);
    expect(PRICING_MATRIX.gratuito.cartao).toBe(0);
    expect(PRICING_MATRIX.gratuito.boleto).toBe(0);
  });

  it('LITE charges a card premium (R$247 vs R$197 PIX) due to acquirer fees', () => {
    expect(PRICING_MATRIX.lite.pix).toBe(197);
    expect(PRICING_MATRIX.lite.cartao).toBe(247);
    expect(PRICING_MATRIX.lite.cartao).toBeGreaterThan(PRICING_MATRIX.lite.pix);
  });

  it('PRO and MAX absorb card fees (same price across methods)', () => {
    expect(PRICING_MATRIX.pro.pix).toBe(PRICING_MATRIX.pro.cartao);
    expect(PRICING_MATRIX.max.pix).toBe(PRICING_MATRIX.max.cartao);
  });

  it('PARCEIRO is flat-rate for pix and cartao (boleto has small premium)', () => {
    expect(PRICING_MATRIX.parceiro.pix).toBe(PRICING_MATRIX.parceiro.cartao);
    // Boleto carries a small premium (R$257 vs R$247) for manual processing.
    expect(PRICING_MATRIX.parceiro.boleto).toBeGreaterThanOrEqual(PRICING_MATRIX.parceiro.pix);
  });

  it('boleto is equal-or-cheaper than cartao for LITE (manual processing)', () => {
    // LITE: boleto (R$207) is cheaper than cartao (R$247) — manual processing
    // avoids the card acquirer fee.
    // PRO and MAX have boleto slightly MORE expensive (R$407/R$807) because
    // those plans absorb the card fee (cartao = pix) and boleto carries a
    // small manual handling premium.
    expect(PRICING_MATRIX.lite.boleto).toBeLessThanOrEqual(PRICING_MATRIX.lite.cartao);
  });
});

describe('ALLOWED_METHODS — payment method allowlist per plan', () => {
  it('gratuito accepts no payment methods (free plan)', () => {
    expect(ALLOWED_METHODS.gratuito).toEqual([]);
  });

  it('every paid plan accepts PIX (cheapest, instant)', () => {
    for (const plan of ['lite', 'pro', 'max', 'parceiro'] as const) {
      expect(ALLOWED_METHODS[plan]).toContain('pix');
    }
  });

  it('PRO and MAX accept all 3 methods (card, PIX, boleto)', () => {
    expect(ALLOWED_METHODS.pro.sort()).toEqual(['boleto', 'cartao', 'pix']);
    expect(ALLOWED_METHODS.max.sort()).toEqual(['boleto', 'cartao', 'pix']);
  });
});

describe('getPrice — price quote', () => {
  it('returns BRL currency and monthly interval for every plan/method combo', () => {
    for (const plan of Object.keys(PRICING_MATRIX) as Array<keyof typeof PRICING_MATRIX>) {
      for (const method of ['pix', 'cartao', 'boleto'] as const) {
        const quote = getPrice(plan, method);
        expect(quote.currency).toBe('BRL');
        expect(quote.interval).toBe('monthly');
        expect(quote.planTier).toBe(plan);
        expect(quote.paymentMethod).toBe(method);
        expect(quote.amount).toBe(PRICING_MATRIX[plan][method]);
      }
    }
  });

  it('throws on invalid plan/method combination', () => {
    expect(() => getPrice('invalid_plan' as any, 'pix')).toThrow(/Invalid plan\/method combo/);
    expect(() => getPrice('lite', 'invalid_method' as any)).toThrow(/Invalid plan\/method combo/);
  });
});

describe('isMethodAllowed + listAllowedMethods', () => {
  it('returns false for gratuito (no payment allowed)', () => {
    expect(isMethodAllowed('gratuito', 'pix')).toBe(false);
    expect(isMethodAllowed('gratuito', 'cartao')).toBe(false);
  });

  it('returns true for LITE+PIX, LITE+boleto, and LITE+cartao (all 3 allowed per latest matrix)', () => {
    expect(isMethodAllowed('lite', 'pix')).toBe(true);
    expect(isMethodAllowed('lite', 'boleto')).toBe(true);
    expect(isMethodAllowed('lite', 'cartao')).toBe(true);
  });

  it('listAllowedMethods returns the same set as isMethodAllowed', () => {
    for (const plan of Object.keys(ALLOWED_METHODS) as Array<keyof typeof ALLOWED_METHODS>) {
      const allowed = listAllowedMethods(plan);
      for (const method of ['pix', 'cartao', 'boleto'] as const) {
        expect(isMethodAllowed(plan, method)).toBe(allowed.includes(method));
      }
    }
  });
});

describe('Annual pricing — 10% discount on 12 months upfront', () => {
  it('ANNUAL_DISCOUNT_RATE is exactly 0.10 (10%)', () => {
    expect(ANNUAL_DISCOUNT_RATE).toBe(0.10);
  });

  it('getAnnualPrice returns 12 * monthly * (1 - 0.10) rounded', () => {
    const annualPro = getAnnualPrice('pro', 'pix');
    const monthlyPro = PRICING_MATRIX.pro.pix;
    expect(annualPro).toBe(Math.round(monthlyPro * 12 * (1 - 0.10)));
  });

  it('getAnnualPrice for gratuito is 0', () => {
    expect(getAnnualPrice('gratuito', 'pix')).toBe(0);
  });
});
