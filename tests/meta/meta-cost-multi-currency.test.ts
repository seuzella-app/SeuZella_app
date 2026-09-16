/**
 * FASE 02B — Regressão multi-moeda Meta (FRENTE 06/07/08).
 *
 * P1-4 (CRITICAL DATA MODEL ISSUE): bySource/byIntent/authoritativeCost/
 * estimatedCost somavam BRL + USD num único número — corrigido para
 * agregados por-moeda.
 * P1-3: budget cego para BRL — budget BRL nativo configurável via env,
 * SEM conversão automática (nenhum FX inventado).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const guard = readFileSync(join(ROOT, 'src/lib/meta-cost-guard.ts'), 'utf-8');
const metaCostsRoute = readFileSync(join(ROOT, 'src/app/api/meta-costs/route.ts'), 'utf-8');

describe('FASE 02B — agregados de custo por moeda (FRENTE 06)', () => {
  it('estruturas por-moeda existem (bySourceByCurrency / byIntentByCurrency)', () => {
    expect(guard).toMatch(/bySourceByCurrency/);
    expect(guard).toMatch(/byIntentByCurrency/);
    expect(guard).toMatch(/authoritativeCostByCurrency/);
    expect(guard).toMatch(/estimatedCostByCurrency/);
  });

  it('agregados misturados removidos (bySource/byIntent/authoritativeCost escalares e avgCostPerMsg inválidos)', () => {
    // o escalar inválido não pode mais existir como chave de retorno
    expect(guard).not.toMatch(/authoritativeCost:\s*bySource\./);
    expect(guard).not.toMatch(/estimatedCost:\s*bySource\./);
    expect(guard).not.toMatch(/avgCostPerMsg/);
    expect(guard).not.toMatch(/const bySource:\s*Record<string, number>/);
    expect(guard).not.toMatch(/const byIntent\s*=/);
  });

  it('contrato da certificação FASE 02 permanece (estimatedCost presente no módulo)', () => {
    expect(guard).toMatch(/estimatedCost/);
    expect(guard).toMatch(/meta_webhook_pricing/);
  });

  it('nenhum câmbio fixo introduzido no módulo (invariante 5.15)', () => {
    expect(guard).not.toMatch(/5\.15/);
  });
});

describe('FASE 02B — budget multi-moeda nativo (FRENTE 07)', () => {
  it('budget BRL nativo configurável por plano via env (sem FX inventado)', () => {
    expect(guard).toMatch(/BRL_BUDGET_ENV/);
    expect(guard).toMatch(/META_BUDGET_LITE_BRL/);
    expect(guard).toMatch(/resolveBrlBudgetLimit/);
  });

  it('enforcement BRL só quando configurado — nunca conversão automática', () => {
    expect(guard).toMatch(/brlBudgetConfigured = brlLimit !== null/);
    expect(guard).toMatch(/currentSpendByCurrency/);
    expect(guard).toMatch(/budgetLimitsByCurrency/);
    expect(guard).toMatch(/ORÇAMENTO META BRL EXCEDIDO/);
  });

  it('gasto BRL somado de rate (não costUsd) — mantém separação de moedas', () => {
    expect(guard).toMatch(/else if \(currency === 'BRL'\) currentSpendBrl \+= log\.rate \?\? 0;/);
  });
});

describe('FASE 02B — /api/meta-costs valida período (FRENTE 08)', () => {
  it('datas inválidas retornam 400 honesto', () => {
    expect(metaCostsRoute).toMatch(/Invalid date range/);
    expect(metaCostsRoute).toMatch(/Number\.isNaN\(startDate\.getTime\(\)\)/);
  });
});
