/**
 * FASE 02B — Regressão de honestidade DDC (FRENTE 10/12/33/55).
 *
 * Padrão da casa: source-assertion. Garante que endpoints DDC operacionais
 * NUNCA retornem dados demo/fabricados com aparência real — caminhos
 * degradados devem ser zeros/flag honesta (degraded + source).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe('FASE 02B — ddc/deliveries sem fabricação financeira', () => {
  const source = read('src/app/api/ddc/deliveries/route.ts');

  it('não existe mais demoData (Maria Silva, R$15.870, metaShield 79.2%)', () => {
    expect(source).not.toMatch(/demoData/);
    expect(source).not.toContain('Maria Silva');
    expect(source).not.toContain('12.345.678/0001-90');
    expect(source).not.toContain('15870');
    expect(source).not.toContain('105800');
  });

  it('sem sessão = 401 honesto (não dados financeiros demo)', () => {
    expect(source).toMatch(/if \(!tenantId\) \{\s*\n\s*\/\/ FASE 02B: sem sessão = 401 honesto/);
  });

  it('caminhos degradados = zeros + flags degraded/source', () => {
    expect(source).toMatch(/emptyDeliveries\(\)/);
    expect(source).toMatch(/source: 'database_unavailable', degraded: true/);
    expect(source).toMatch(/source: 'fallback-zeros',\s*\n\s*degraded: true/);
    expect(source).not.toMatch(/'demo-no-auth'|'fallback-demo'|source: 'demo'/);
  });

  it('estimativas de FX 5.15 ficam marcadas como ESTIMATIVA (FRENTE 07)', () => {
    expect(source).toMatch(/ESTIMATIVA com FX de refer/);
  });
});

describe('FASE 02B — ddc/ai-status sem status verde fabricado', () => {
  const source = read('src/app/api/ddc/ai-status/route.ts');

  it('DB indisponível = offline honesto (não online com números demo)', () => {
    expect(source).not.toMatch(/activeConversations: 5/);
    expect(source).not.toMatch(/totalToday: 24/);
    expect(source).not.toMatch(/overallConfidence: 87\.3/);
    expect(source).toMatch(/status: 'offline' as const/);
    expect(source).toMatch(/source: 'database_unavailable', degraded: true/);
  });

  it('erro de runtime não mantém status online', () => {
    expect(source).toMatch(/status: 'error' as const/);
  });
});

describe('FASE 02B — ddc/conversations sem seed demo em produção', () => {
  const source = read('src/app/api/ddc/conversations/route.ts');

  it('auto-seeder bloqueado em produção (booking PIX fake não polui receita)', () => {
    expect(source).toMatch(
      /count === 0 && process\.env\.NODE_ENV !== 'production'/
    );
  });

  it('DB indisponível = lista vazia honesta + flag', () => {
    expect(source).toMatch(/source: 'database_unavailable', degraded: true/);
  });

  it('constante demoConversations morta foi removida', () => {
    expect(source).not.toMatch(/const demoConversations = \[/);
  });
});

describe('FASE 02B — ddc/bookings sem demo financeiro', () => {
  const source = read('src/app/api/ddc/bookings/route.ts');

  it('DB indisponível = lista vazia honesta + flag', () => {
    expect(source).toMatch(/source: 'database_unavailable', degraded: true/);
  });

  it('constante demoBookings morta foi removida', () => {
    expect(source).not.toMatch(/const demoBookings = \[/);
    expect(source).not.toContain('Maria Silva');
  });
});
