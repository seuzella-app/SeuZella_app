/**
 * RUN9-W1 — INVARIANTES DA ONDA DE EVIDÊNCIAS (Billing / Revenue / ASAAS)
 *
 * Estilo W1/W2 do RUN7 e W1/W2 do RUN8: provas ESTRUTURAIS (leitura de fs,
 * sem runtime/prisma/DB/rede). Este arquivo é ADITIVO: não altera código de
 * produção.
 *
 * Cobertura:
 *  - cadeia ...... fechadura do RUN8 (registro W2 presente e coerente) e
 *                  disciplina migrate herdada (nenhum `db push` em scripts)
 *  - 9A-9E ....... inventário RUN9_W1 gerado pelo recon desta onda é parseável
 *                  e estruturalmente consistente
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

describe('RUN9-W1 — fechaduras herdadas da cadeia RUN7+RUN8', () => {
  it('RUN8 fechado: registro do patch W2 existe e é consistente', () => {
    const latest = latestDir('99_AUDITS', /^RUN8_W2_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN8_W2_* — RUN8-W2 não rodou (cadeia quebrada)').toBeTruthy();
    const rec = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'W2_PATCH_RECORD.json'), 'utf8'));
    expect(rec.run).toBe('RUN8-W2 patches 8B');
    expect(rec.packageJsonValid).toBe(true);
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

describe('RUN9-W1 — evidência da onda (inventário recon de billing)', () => {
  it('RUN9_BILLING_INVENTORY.json existe, parseia e traz estrutura completa', () => {
    const latest = latestDir('99_AUDITS', /^RUN9_W1_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS com RUN9_W1 — recon não rodou').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN9_BILLING_INVENTORY.json'), 'utf8'));
    expect(inv.run).toContain('RUN9-W1');
    expect(inv.totals).toHaveProperty('billingRoutes');
    expect(inv.totals).toHaveProperty('webhookRoutes');
    expect(inv.totals).toHaveProperty('asaasFiles');
    expect(inv.totals).toHaveProperty('billingModels');
    expect(inv.totals.billingRoutes).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(inv.findings)).toBe(true);
    expect(Array.isArray(inv.webhookAnalysis)).toBe(true);
    expect(Array.isArray(inv.billingModels)).toBe(true);
    // coerência: cada análise de webhook carrega os 4 sinais booleanos
    for (const w of inv.webhookAnalysis) {
      expect(typeof w.signature).toBe('boolean');
      expect(typeof w.idempotency).toBe('boolean');
      expect(typeof w.transaction).toBe('boolean');
      expect(typeof w.rawBody).toBe('boolean');
    }
  });
});
