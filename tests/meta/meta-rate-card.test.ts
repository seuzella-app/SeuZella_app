// ==============================================================================
// Meta Rate Card & Billing Semantics — Fase 6/7/8 (unit tests)
// ==============================================================================
// Regras sob teste:
//  - Janela 24h = regra de ENVIO ≠ regra de COBRANÇA (nunca misturar)
//  - 01/10/2026: service passa a ser cobrado
//  - Categoria UNKNOWN: nunca precificada, nunca assumida
//  - Rate card por market/currency/category/effectiveFrom/Until
// ==============================================================================
import { describe, it, expect } from 'vitest';
import {
  isCustomerServiceWindowOpen,
  isMetaMessageBillable,
  estimateMetaCost,
  resolveRateCardEntry,
  getServiceWindowRemainingHours,
} from '@/lib/meta/meta-rate-card';

describe('📋 Meta Rate Card — janela de atendimento (ENVIO)', () => {
  const NOW = new Date('2026-09-16T12:00:00Z');

  it('janela aberta dentro de 24h da última mensagem do guest', () => {
    const last = new Date(NOW.getTime() - 2 * 60 * 60 * 1000); // 2h atrás
    expect(isCustomerServiceWindowOpen(last, NOW)).toBe(true);
  });

  it('janela fechada após 24h', () => {
    const last = new Date(NOW.getTime() - 25 * 60 * 60 * 1000); // 25h atrás
    expect(isCustomerServiceWindowOpen(last, NOW)).toBe(false);
  });

  it('sem última mensagem do guest → janela fechada (fail-safe)', () => {
    expect(isCustomerServiceWindowOpen(null, NOW)).toBe(false);
    expect(isCustomerServiceWindowOpen(undefined, NOW)).toBe(false);
  });

  it('horas restantes decrescem e nunca são negativas', () => {
    const last = new Date(NOW.getTime() - 23.5 * 60 * 60 * 1000);
    expect(getServiceWindowRemainingHours(last, NOW)).toBeGreaterThan(0);
    const old = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);
    expect(getServiceWindowRemainingHours(old, NOW)).toBe(0);
  });
});

describe('💰 Meta Rate Card — cobrança (COBRANÇA ≠ ENVIO)', () => {
  const BEFORE_OCT = new Date('2026-09-15T12:00:00Z');
  const AFTER_OCT = new Date('2026-10-02T12:00:00Z');

  it('service ANTES de 01/10/2026 dentro da janela: não billable', () => {
    expect(
      isMetaMessageBillable({ category: 'service', withinServiceWindow: true, at: BEFORE_OCT })
    ).toBe(false);
  });

  it('service A PARTIR de 01/10/2026: billable (mudança Meta 2026)', () => {
    expect(
      isMetaMessageBillable({ category: 'service', withinServiceWindow: true, at: AFTER_OCT })
    ).toBe(true);
    expect(
      isMetaMessageBillable({ category: 'service', withinServiceWindow: false, at: AFTER_OCT })
    ).toBe(true);
  });

  it('utility template dentro da janela: billable (janela nunca foi grátis)', () => {
    expect(
      isMetaMessageBillable({ category: 'utility', withinServiceWindow: true, at: BEFORE_OCT })
    ).toBe(true);
  });

  it('marketing/authentication: sempre billable quando enviados', () => {
    expect(
      isMetaMessageBillable({ category: 'marketing', withinServiceWindow: true, at: BEFORE_OCT })
    ).toBe(true);
    expect(
      isMetaMessageBillable({ category: 'authentication', withinServiceWindow: false, at: AFTER_OCT })
    ).toBe(true);
  });

  it('categoria UNKNOWN: NUNCA assumida como billable ou grátis', () => {
    expect(
      isMetaMessageBillable({ category: 'UNKNOWN', withinServiceWindow: true, at: AFTER_OCT })
    ).toBe(false);
  });
});

describe('🏷️ Meta Rate Card — rate card configurável (dados, não lógica)', () => {
  it('entrada vigente respeita effectiveFrom/effectiveUntil', () => {
    const preOct = resolveRateCardEntry({
      market: 'BR',
      category: 'service',
      at: new Date('2026-09-15T00:00:00Z'),
    });
    expect(preOct?.effectiveUntil).toBe('2026-09-30');

    const postOct = resolveRateCardEntry({
      market: 'BR',
      category: 'service',
      at: new Date('2026-10-05T00:00:00Z'),
    });
    expect(postOct?.effectiveUntil).toBeNull();
  });

  it('UNKNOWN não tem entrada no rate card (nunca preço inventado)', () => {
    expect(resolveRateCardEntry({ market: 'BR', category: 'UNKNOWN' })).toBeNull();
  });

  it('estimativa sempre marcada estimated=true (custo real só da Meta)', () => {
    const est = estimateMetaCost({
      market: 'BR',
      category: 'marketing',
      withinServiceWindow: false,
    });
    expect(est).not.toBeNull();
    expect(est!.estimated).toBe(true);
    expect(est!.billable).toBe(true);
    expect(est!.currency).toBe('BRL');
  });

  it('estimativa de categoria não billable → custo 0', () => {
    const est = estimateMetaCost({
      market: 'BR',
      category: 'service',
      withinServiceWindow: true,
      at: new Date('2026-09-15T00:00:00Z'),
    });
    expect(est).not.toBeNull();
    expect(est!.cost).toBe(0);
    expect(est!.billable).toBe(false);
  });

  it('UNKNOWN retorna null (nunca inventa preço)', () => {
    expect(
      estimateMetaCost({ market: 'BR', category: 'UNKNOWN', withinServiceWindow: true })
    ).toBeNull();
  });
});
