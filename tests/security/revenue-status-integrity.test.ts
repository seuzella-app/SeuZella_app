/**
 * FASE 02B — Regressão de integridade de receita (FRENTE 09/10/11/12/14/55).
 *
 * Padrão da casa: source-assertion (sandbox sem PostgreSQL real).
 * Garante que nenhuma calculadora de receita some status não-receita,
 * que o snapshot diário não fabrique KPIs e que caminhos degradados
 * sejam honestos (zeros + flag), nunca demo com aparência real.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

const REVENUE_STATUSES = /confirmed[\s\S]{0,40}checked_in[\s\S]{0,40}checked_out/;

describe('FASE 02B — cron/metrics-snapshot (snapshot diário honesto)', () => {
  const source = read('src/app/api/cron/metrics-snapshot/route.ts');

  it('totalRevenue soma APENAS status de receita real (sem pending/cancelled)', () => {
    expect(source).toMatch(/REVENUE_BOOKING_STATUSES/);
    expect(source).toMatch(REVENUE_STATUSES);
  });

  it('não persiste mais KPIs fabricados (|| 12, || 4.2, || 65, || 85, 1.5)', () => {
    expect(source).not.toMatch(/conversionRate\s*\|\|\s*12/);
    expect(source).not.toMatch(/guestSatisfaction\s*\|\|\s*4\.2/);
    expect(source).not.toMatch(/occupancyRate\s*\|\|\s*65/);
    expect(source).not.toMatch(/aiAutonomy\s*\|\|\s*85/);
    expect(source).not.toMatch(/:\s*1\.5\s*;/);
  });

  it('janela é DIÁRIA (incremento do dia) — não month-to-date somável N×', () => {
    expect(source).toMatch(/startOfToday/);
    expect(source).not.toMatch(/startOfMonth/);
  });
});

describe('FASE 02B — ddc/metrics (raw path + estados semânticos)', () => {
  const source = read('src/app/api/ddc/metrics/route.ts');

  it('receita do raw path filtra status de receita real', () => {
    expect(source).toMatch(/isRevenueStatus/);
    expect(source).toMatch(REVENUE_STATUSES);
  });

  it('não existe mais demoMetrics com receita fabricada', () => {
    expect(source).not.toMatch(/demoMetrics/);
    expect(source).not.toMatch(/12 ?450|87 ?230|345 ?670/);
  });

  it('DB indisponível = zeros honestos com flag degraded + source', () => {
    expect(source).toMatch(/source:\s*'database_unavailable'/);
    expect(source).toMatch(/degraded:\s*true/);
  });

  it('estados semânticos de fonte presentes (snapshot/database/fallback-zeros)', () => {
    expect(source).toMatch(/source:\s*'snapshot'/);
    expect(source).toMatch(/source:\s*'database'/);
    expect(source).toMatch(/source:\s*'fallback-zeros'/);
  });
});

describe('FASE 02B — ddc/revenue-details (PIX hoje = receita real)', () => {
  const source = read('src/app/api/ddc/revenue-details/route.ts');

  it('query PIX exclui pending/cancelled (filtro de status)', () => {
    expect(source).toMatch(/status:\s*\{\s*in:\s*\['confirmed',\s*'checked_in',\s*'checked_out'\]\s*\}/);
  });

  it('mantém honestidade da FASE 02 (degraded/source sem fabricação)', () => {
    expect(source).toMatch(/degraded:\s*transactions\.length === 0/);
    // txId nunca gerado por Math.random (ocorrência permitida: comentário histórico).
    expect(source).not.toMatch(/const\s+txId\s*=\s*Math\.random/);
    expect(source).toMatch(/const txId = booking\.id;/);
  });
});
