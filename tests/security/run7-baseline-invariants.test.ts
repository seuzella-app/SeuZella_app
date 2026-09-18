/**
 * RUN 7-W1 — INVARIANTES DO BASELINE (SEUZELLA_BASELINE_CLOSURE_01 = 0cbc984c)
 *
 * Provas ESTRUTURAIS (leitura de fs, sem runtime/prisma/env) das propriedades
 * já certificadas na FASE 0. Objetivo: qualquer drift futuro no baseline quebra
 * esta suíte — o baseline deixa de poder apodrecer em silêncio.
 *
 * Este arquivo é ADITIVO: não altera nenhum código de produção.
 * Escopo W1: só afirmações JÁ PROVADAS (verde garantido sobre o baseline).
 * As afirmações que expõem GAPS (7A..7H) entram no W2, junto dos patches.
 *
 * Cobertura por frente do RUN7 (mapeamento):
 *  - 7E Push/Capability ....... removePushSubscription com tenantId (RUN6B)
 *  - PULSE preserved ........... randomBytes em pulse-socket-server (proteção)
 *  - 7C/7D/7H .................. cadeia run6* e run6b* presente (8+ suítes)
 *  - 7A Session/Middleware ..... arquivo de middleware presente (alvo W2)
 *  - RUN8 contrato ............. provider postgresql + migration de overlap
 *  - 7F LGPD / 4B .............. suítes lgpd-isolation e pat-vault presentes
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do projeto ancorada no PROPRIO arquivo (tests/security/*.test.ts -> dois
// niveis acima), independente do cwd de invocacao do vitest.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const listDir = (p: string): string[] => readdirSync(join(root, p));

describe('RUN7-W1 — invariantes estruturais do baseline', () => {
  it('7E Push — removePushSubscription exige tenantId (fechamento RUN6B no baseline)', () => {
    const src = read('src/lib/push/push-service.ts');
    const idx = src.indexOf('export async function removePushSubscription');
    expect(idx).toBeGreaterThanOrEqual(0);
    const sig = src.slice(idx, idx + 400);
    expect(sig).toContain('tenantId');
  });

  it('PULSE preserved — import randomBytes presente em pulse-socket-server', () => {
    const src = read('src/lib/pulse-socket-server.ts');
    expect(src).toMatch(/import\s+.*randomBytes.*crypto/);
  });

  it('7C/7D/7H — cadeia RUN6/RUN6B presente: 8+ suítes run6* em tests/security', () => {
    const files = listDir('tests/security').filter((f) => /^run6.*\.test\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('7A Session/Middleware — arquivo de middleware presente (alvo W2)', () => {
    const candidates = ['src/middleware.ts', 'middleware.ts', 'src/proxy.ts'];
    const found = candidates.filter((p) => existsSync(join(root, p)));
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('RUN8 contrato — Prisma provider postgresql (schema.prisma)', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it('RUN8 contrato — exclusão de overlap de reservas no BANCO (migration presente)', () => {
    const migrations = listDir('prisma/migrations').filter((d) => /overlap/i.test(d));
    expect(migrations.length).toBeGreaterThanOrEqual(1);
  });

  it('7F LGPD + RUN4B — suítes de regressão obrigatórias presentes', () => {
    const files = listDir('tests/security');
    expect(files.some((f) => /run4-wave4b-pat-vault/.test(f))).toBe(true);
    expect(files.some((f) => /run6b-lgpd-isolation/.test(f))).toBe(true);
  });

  it('Auto-invariante — esta suíte está no diretório canônico tests/security', () => {
    expect(existsSync(join(root, 'tests', 'security', 'run7-baseline-invariants.test.ts'))).toBe(true);
  });
});
