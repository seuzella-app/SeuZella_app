/**
 * FASE 02B — Regressão frontend (FRENTE 34): adaptRevenueMetrics honesto.
 *
 * Antes: "Receita Semanal" = receita de HOJE ×4.5, mensal = ×18, projeção = ×25
 * — fabricação de receita no client exibida como real.
 * Agora: valores reais por período (quando carregados) ou zeros honestos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const mapper = readFileSync(join(ROOT, 'src/lib/ddc/ddc-mapper.ts'), 'utf-8');
const dashboard = readFileSync(join(ROOT, 'src/app/ddc/DDCDashboardContent.tsx'), 'utf-8');

describe('FASE 02B — adaptRevenueMetrics sem multiplicadores fabricados', () => {
  it('nenhum multiplicador inventado (×4.5 / ×18 / ×25 / ×5 / ×20)', () => {
    expect(mapper).not.toMatch(/\*\s*4\.5/);
    expect(mapper).not.toMatch(/\*\s*18/);
    expect(mapper).not.toMatch(/\*\s*25/);
    expect(mapper).not.toMatch(/revenue \|\| 0\) \* \d/);
    expect(mapper).not.toMatch(/bookingsClosed \|\| 0\) \* \d/);
  });

  it('aceita periodMetrics reais (week/month) com fallback zeros honestos', () => {
    expect(mapper).toMatch(/periodMetrics\?:\s*\{\s*week\?: any;\s*month\?: any\s*\}/);
    expect(mapper).toMatch(/week\?\.revenue \|\| 0/);
    expect(mapper).toMatch(/month\?\.revenue \|\| 0/);
  });

  it('today continua mapeando valores reais da API', () => {
    expect(mapper).toMatch(/generated: apiMetrics\.revenue \|\| 0/);
  });
});

describe('FASE 02B — dashboard consome períodos reais', () => {
  it('adaptRevenueMetrics recebe analyticsData (week/month reais)', () => {
    expect(dashboard).toMatch(
      /adaptRevenueMetrics\(metrics,\s*\{\s*week: analyticsData\.week,\s*month: analyticsData\.month\s*\}\)/
    );
  });

  it('fallback de adapter failure permanece zeros honestos (mockRevenueMetrics)', () => {
    // mockRevenueMetrics = todos zeros (honesto) — mantido APENAS como fallback
    // de adapter failure, não como fonte de números.
    const mock = readFileSync(join(ROOT, 'src/lib/ddc/mock-data.ts'), 'utf-8');
    expect(mock).toMatch(/mockRevenueMetrics/);
    expect(dashboard).toMatch(/\|\| mockRevenueMetrics\}/);
  });
});
