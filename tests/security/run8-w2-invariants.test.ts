/**
 * RUN8-W2 — INVARIANTES DO FECHAMENTO (PostgreSQL / Prisma / Reservas)
 *
 * Estilo W1/W2 do RUN7 e W1 do RUN8: provas ESTRUTURAIS (leitura de fs, sem
 * runtime/prisma/DB). Este arquivo é ADITIVO: não altera código de produção.
 *
 * Cobertura:
 *  - 8B (novo) ... package.json SEM nenhum `db push` (disciplina migrate deploy)
 *  - 8B (novo) ... registro do patch W2 existe, parseia e é consistente
 *  - 8A (herdado). schema parseável com provider postgresql
 *  - 8B (herdado). migrations versionadas com lock postgresql
 *  - 8D (herdado). constraint EXCLUDE de overlap presente em migrations
 *  - evidência .... inventário RUN8_W1 continua presente e parseável
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

describe('RUN8-W2 — 8B: disciplina migrate deploy (fechadura nova)', () => {
  const pkg = JSON.parse(read('package.json'));

  it('nenhum script npm contém `db push`', () => {
    const offenders = Object.entries(pkg.scripts || {})
      .filter(([, v]) => /\bdb\s+push\b/.test(String(v)))
      .map(([k]) => k);
    expect(offenders, 'scripts ainda com db push: ' + offenders.join(', ')).toEqual([]);
  });

  it('registro do patch W2 existe, parseia e é consistente', () => {
    const latest = latestDir('99_AUDITS', /^RUN8_W2_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN8_W2_* — patch W2 não rodou').toBeTruthy();
    const rec = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'W2_PATCH_RECORD.json'), 'utf8'));
    expect(rec.run).toBe('RUN8-W2 patches 8B');
    expect(rec.packageJsonValid).toBe(true);
    expect(Array.isArray(rec.patched)).toBe(true);
    expect(Array.isArray(rec.skipped)).toBe(true);
    expect(['RESOLVED_FALSE_POSITIVE', 'RESIDUAL_DOCUMENTED']).toContain(rec.p2.status);
    // coerência: o que o registro afirma bate com o package.json atual
    for (const p of rec.patched) {
      expect(String(pkg.scripts[p.key]), 'script ' + p.key + ' difere do registrado').toBe(p.after);
    }
  });
});

describe('RUN8-W2 — 8A/8B/8D: fechaduras herdadas do RUN8-W1', () => {
  const schema = read('prisma/schema.prisma');

  it('datasource provider é postgresql (8A)', () => {
    const ds = schema.match(/datasource\s+\w+\s*\{([^}]*)\}/)!;
    expect(ds[1]).toMatch(/provider\s*=\s*["']postgresql["']/);
  });

  it('migrations versionadas com lock postgresql (8B)', () => {
    const migDir = join(root, 'prisma', 'migrations');
    expect(existsSync(migDir), 'prisma/migrations ausente').toBe(true);
    const entries = readdirSync(migDir).filter((d) => /^\d{14}_/.test(d));
    expect(entries.length, 'nenhuma migration versionada').toBeGreaterThan(0);
    expect(read('prisma/migrations/migration_lock.toml')).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it('constraint EXCLUDE de overlap presente em migrations (8D)', () => {
    const migDir = join(root, 'prisma', 'migrations');
    const dirs = readdirSync(migDir).filter((d) => /^\d{14}_/.test(d));
    const hasExclude = dirs.some((d) => {
      const sql = join(migDir, d, 'migration.sql');
      if (!existsSync(sql)) return false;
      return /EXCLUDE\s+USING/i.test(readFileSync(sql, 'utf8'));
    });
    expect(hasExclude, 'nenhuma migration com EXCLUDE USING (overlap guard)').toBe(true);
  });
});

describe('RUN8-W2 — evidências encadeadas', () => {
  it('inventário RUN8_W1 continua presente e parseável', () => {
    const latest = latestDir('99_AUDITS', /^RUN8_W1_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN8_W1_*').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN8_PRISMA_INVENTORY.json'), 'utf8'));
    expect(inv.datasource.provider).toBe('postgresql');
    expect(Array.isArray(inv.findings)).toBe(true);
  });
});
