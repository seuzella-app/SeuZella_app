/**
 * F28-A — PARCEIRO ZÉLLA COMMERCIAL CANONICALIZATION CONTRACT
 * ============================================================================
 * REGRA COMERCIAL CANÔNICA (não questionável):
 *   PARCEIRO ZÉLLA = R$247,00/mês · preço/contrato congelado por 24 meses ·
 *   paridade funcional com PRO. R$297 NÃO é preço válido de nenhum pacote.
 *
 * Este teste FALHA caso o preço do PARCEIRO volte a ser R$297 em qualquer
 * superfície comercial ativa, e garante a condição de 24 meses documentada.
 * ============================================================================
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PRICING_MATRIX, getPrice, isMethodAllowed } from '@/lib/payments/pricing';
import { PLAN_DISPLAY, tierLevel } from '@/lib/plan-features';
import { PLAN_QUOTAS, LITE_GUESTS_LIMIT, LITE_MESSAGES_LIMIT } from '@/lib/entitlements';
import { AMOUNT_TO_TIER } from '@/app/api/webhooks/payment/route';

const ACTIVE_COMMERCIAL_SURFACES = [
  'src/lib/payments/pricing.ts', // checkout authority
  'src/components/landing/PricingSection.tsx', // landing pricing cards
  'src/app/parceiro/page.tsx', // partner landing page
  'src/app/api/webhooks/payment/route.ts', // amount→tier fallback
];

describe('F28-A · PRICING_MATRIX canonical values', () => {
  it('PARCEIRO costs R$247 flat (PIX, card and boleto follow house rule)', () => {
    expect(PRICING_MATRIX.parceiro.pix).toBe(247);
    expect(PRICING_MATRIX.parceiro.cartao).toBe(247);
    expect(PRICING_MATRIX.parceiro.boleto).toBe(257); // boleto = pix + 10 (house rule)
  });

  it('quote for PARCEIRO via public API is 247 for every allowed method', () => {
    for (const method of ['pix', 'cartao', 'boleto'] as const) {
      if (isMethodAllowed('parceiro', method)) {
        expect(getPrice('parceiro', method).amount).toBe(method === 'boleto' ? 257 : 247);
      }
    }
  });

  it('other plans keep the catalog untouched (no invented prices)', () => {
    expect(PRICING_MATRIX.gratuito.pix).toBe(0);
    expect(PRICING_MATRIX.lite.pix).toBe(197);
    expect(PRICING_MATRIX.lite.cartao).toBe(247);
    expect(PRICING_MATRIX.lite.boleto).toBe(207);
    expect(PRICING_MATRIX.pro.pix).toBe(397);
    expect(PRICING_MATRIX.pro.cartao).toBe(397);
    expect(PRICING_MATRIX.max.pix).toBe(797);
  });

  it('PLAN_DISPLAY.parceiro stays 247 (display authority)', () => {
    expect(PLAN_DISPLAY.parceiro.price).toBe(247);
    expect(PLAN_DISPLAY.parceiro.priceLabel).toBe('R$247/mês');
  });
});

/**
 * Strips comments so the scan checks EXECUTABLE code / rendered strings only —
 * canonical documentation (e.g. "R$297 is not a valid price") must stay legal.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, ''); // line comments
}

describe('F28-A · NO R$297 in active commercial surfaces', () => {
  for (const surface of ACTIVE_COMMERCIAL_SURFACES) {
    it(`${surface} contains no legacy R$297 in executable code`, () => {
      const content = readFileSync(path.resolve(process.cwd(), surface), 'utf-8');
      expect(
        stripComments(content).includes('297'),
        `legacy 297 found in executable code of ${surface}`
      ).toBe(false);
    });
  }

  it('landing + partner page still advertise R$247 and the 24-month freeze', () => {
    const landing = readFileSync(path.resolve(process.cwd(), 'src/components/landing/PricingSection.tsx'), 'utf-8');
    const partner = readFileSync(path.resolve(process.cwd(), 'src/app/parceiro/page.tsx'), 'utf-8');
    expect(landing.includes('R$247')).toBe(true);
    expect(landing.includes('24 meses')).toBe(true);
    expect(partner.includes('R$ 247')).toBe(true);
    expect(partner.includes('24 meses')).toBe(true);
  });
});

describe('F28-A · webhook amount→tier fallback honors R$247 PARCEIRO', () => {
  it('bands: 197–246.99 → lite · 247–396.99 → parceiro', () => {
    const tierFor = (amount: number): string | undefined =>
      AMOUNT_TO_TIER.find((b) => amount >= b.minAmount && amount <= b.maxAmount)?.tier;

    expect(tierFor(0)).toBe('gratuito');
    expect(tierFor(197)).toBe('lite');
    expect(tierFor(207)).toBe('lite');
    expect(tierFor(246.99)).toBe('lite');
    expect(tierFor(247)).toBe('parceiro'); // THE canonical regression guard
    expect(tierFor(257)).toBe('parceiro'); // PARCEIRO boleto
    expect(tierFor(397)).toBe('pro');
    expect(tierFor(797)).toBe('max');
    expect(tierFor(247)).not.toBe('lite'); // the exact F28 bug this locks out
    // Legacy webhooks that still send the old wrong amount keep routing to
    // PARCEIRO (same plan as before) — no commercial side-effect.
    expect(tierFor(297)).toBe('parceiro');
  });
});

describe('F28-A · PARCEIRO = full PRO parity', () => {
  it('tier level parity (2 === 2) in the feature matrix', () => {
    expect(tierLevel('parceiro')).toBe(tierLevel('pro'));
  });

  it('quota parity: PARCEIRO unlimited like PRO', () => {
    expect(PLAN_QUOTAS.parceiro.guests.unlimited).toBe(true);
    expect(PLAN_QUOTAS.parceiro.messages.unlimited).toBe(true);
    expect(PLAN_QUOTAS.parceiro.guests.unlimited).toBe(PLAN_QUOTAS.pro.guests.unlimited);
  });

  it('LITE keeps its hard catalog limits (50 guests / 500 messages)', () => {
    expect(LITE_GUESTS_LIMIT).toBe(50);
    expect(LITE_MESSAGES_LIMIT).toBe(500);
    expect(PLAN_QUOTAS.lite.guests.monthlyLimit).toBe(50);
    expect(PLAN_QUOTAS.lite.messages.monthlyLimit).toBe(500);
  });
});
