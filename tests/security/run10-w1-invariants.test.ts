/**
 * RUN10-W1 — INVARIANTES DA ONDA DE EVIDÊNCIAS (IA / CÉREBRO / MACHINE LEARNING)
 *
 * Estilo W1/W2 do RUN7, W1/W2 do RUN8 e W1 do RUN9: provas ESTRUTURAIS (leitura
 * de fs, sem runtime/prisma/DB/rede). Este arquivo é ADITIVO: não altera código
 * de produção.
 *
 * Cobertura:
 *  - cadeia ...... fechadura do RUN8 (registro W2) + RUN9-W1 executado
 *                  (inventário de billing) + disciplina migrate herdada (8B)
 *  - 10A-10E ..... inventário RUN10_AI_INVENTORY.json gerado pelo recon desta
 *                  onda é parseável e estruturalmente consistente
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

const latestDir = (base: string, re: RegExp): string | null => {
  const abs = join(root, base);
  if (!existsSync(abs)) return null;
  const dirs = readdirSync(abs).filter((d) => re.test(d)).sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
};

describe('RUN10-W1 — fechaduras herdadas da cadeia RUN7+RUN8+RUN9', () => {
  it('RUN8 fechado: registro do patch W2 existe e é consistente', () => {
    const latest = latestDir('99_AUDITS', /^RUN8_W2_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN8_W2_* — RUN8-W2 não rodou (cadeia quebrada)').toBeTruthy();
    const rec = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'W2_PATCH_RECORD.json'), 'utf8'));
    expect(rec.run).toBe('RUN8-W2 patches 8B');
    expect(rec.packageJsonValid).toBe(true);
  });

  it('RUN9-W1 executado: inventário de billing presente e parseável', () => {
    const latest = latestDir('99_AUDITS', /^RUN9_W1_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN9_W1_* — RUN9-W1 não rodou (cadeia quebrada)').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN9_BILLING_INVENTORY.json'), 'utf8'));
    expect(inv.run).toContain('RUN9-W1');
    expect(inv.totals).toHaveProperty('billingRoutes');
  });

  it('onda RUN9-W1 instalada: suíte de invariantes presente em tests/security', () => {
    expect(existsSync(join(root, 'tests/security/run9-w1-invariants.test.ts')),
      'tests/security/run9-w1-invariants.test.ts ausente — RUN9-W1 não instalou a suíte').toBe(true);
  });

  it('disciplina migrate herdada: nenhum `db push` em scripts npm (8B)', () => {
    const pkg = JSON.parse(read('package.json'));
    const offenders = Object.entries(pkg.scripts || {})
      .filter(([, v]) => /\bdb\s+push\b/.test(String(v)))
      .map(([k]) => k);
    expect(offenders, 'scripts ainda com db push: ' + offenders.join(', ')).toEqual([]);
  });

  it('schema segue postgresql (8A herdado)', () => {
    const schema = read('prisma/schema.prisma');
    const ds = schema.match(/datasource\s+\w+\s*\{([^}]*)\}/)!;
    expect(ds[1]).toMatch(/provider\s*=\s*["']postgresql["']/);
  });
});

describe('RUN10-W1 — evidência da onda (inventário recon de IA/ML)', () => {
  it('RUN10_AI_INVENTORY.json existe, parseia e traz estrutura completa', () => {
    const latest = latestDir('99_AUDITS', /^RUN10_W1_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS com RUN10_W1 — recon não rodou').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN10_AI_INVENTORY.json'), 'utf8'));
    expect(inv.run).toContain('RUN10-W1');
    expect(inv.totals).toHaveProperty('aiRoutes');
    expect(inv.totals).toHaveProperty('llmCallSites');
    expect(inv.totals).toHaveProperty('sdkImportFiles');
    expect(inv.totals).toHaveProperty('aiModels');
    expect(inv.totals).toHaveProperty('secretHits');
    expect(inv.totals.aiRoutes).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(inv.findings)).toBe(true);
    expect(Array.isArray(inv.aiRoutes)).toBe(true);
    expect(Array.isArray(inv.aiModels)).toBe(true);
    expect(Array.isArray(inv.secretScan)).toBe(true);
  });

  it('coerência: cada entrada de rota de IA carrega os 3 sinais booleanos', () => {
    const latest = latestDir('99_AUDITS', /^RUN10_W1_\d{8}_\d{6}$/);
    expect(latest).toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN10_AI_INVENTORY.json'), 'utf8'));
    for (const a of inv.aiRouteAnalysis) {
      expect(typeof a.rateLimit).toBe('boolean');
      expect(typeof a.tokenOrTimeoutBound).toBe('boolean');
      expect(typeof a.authSignal).toBe('boolean');
    }
  });

  it('coerência: segredo reportado como hardcoded tem linha positiva e nenhum valor exposto no inventário', () => {
    const latest = latestDir('99_AUDITS', /^RUN10_W1_\d{8}_\d{6}$/);
    expect(latest).toBeTruthy();
    const raw = readFileSync(join(root, '99_AUDITS', latest!, 'RUN10_AI_INVENTORY.json'), 'utf8');
    const inv = JSON.parse(raw);
    for (const s of inv.secretScan) {
      if (s.hardcodedKey) {
        expect(s.hardcodedLine).toBeGreaterThan(0);
      }
    }
    // NENHUM valor de segredo pode ter vazado para o JSON de evidência
    expect(raw).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    expect(raw).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
  });
});
