/**
 * RUN8-W1 — INVARIANTES DA ONDA DE EVIDÊNCIAS (PostgreSQL / Prisma / Reservas)
 *
 * Estilo W1/W2 do RUN7: provas ESTRUTURAIS (leitura de fs, sem runtime/prisma/DB).
 * Este arquivo é ADITIVO: não altera nenhum código de produção e não toca no banco.
 *
 * Cobertura:
 *  - herdado ..... fechaduras do RUN7 (matriz final 7D/7H sem UNKNOWN aberto)
 *  - 8A .......... schema Prisma parseável, provider postgresql, model de reserva
 *  - 8B .......... migrations com lock postgresql (disciplina migrate, não db push)
 *  - evidência ... inventário RUN8_W1 gerado pelo recon desta onda
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const listDir = (p: string): string[] => readdirSync(join(root, p));

describe('RUN8-W1 — fechaduras herdadas do RUN7', () => {
  it('7D/7H — matriz final do RUN7-W2 existe e não tem UNKNOWN aberto', () => {
    const audits = join(root, '99_AUDITS');
    expect(existsSync(audits), '99_AUDITS inexistente').toBe(true);
    const dirs = readdirSync(audits).filter((d) => /^RUN7_W2_\d{8}_\d{6}$/.test(d)).sort();
    const latest = dirs[dirs.length - 1];
    expect(latest, 'nenhum 99_AUDITS com RUN7_W2 — triagem W2 não rodou').toBeTruthy();
    const matrix = JSON.parse(readFileSync(join(audits, latest!, 'RUN7_TENANT_MATRIX_FINAL.json'), 'utf8'));
    expect(matrix.totals.final_unknown_open, 'matriz final com UNKNOWN aberto').toBe(0);
  });
});

describe('RUN8-W1 — 8A/8B: forma do schema e disciplina de migrations', () => {
  const schema = read('prisma/schema.prisma');

  it('datasource provider é postgresql', () => {
    expect(schema).toMatch(/datasource\s+\w+\s*\{/);
    const ds = schema.match(/datasource\s+\w+\s*\{([^}]*)\}/)!;
    expect(ds[1]).toMatch(/provider\s*=\s*["']postgresql["']/);
  });

  it('existe ao menos um model de reserva (8A)', () => {
    const names = [...schema.matchAll(/\bmodel\s+([A-Za-z0-9_]+)\s*\{/g)].map((m) => m[1]);
    expect(names.length, 'nenhum model no schema').toBeGreaterThan(0);
    expect(
      names.some((n) => /reserv|booking|agenda|schedul|stay|hosped|acomod/i.test(n)),
      'nenhum model de reserva/booking detectado no schema'
    ).toBe(true);
  });

  it('migrations existem com lock postgresql (8B — disciplina migrate)', () => {
    const migDir = join(root, 'prisma', 'migrations');
    expect(existsSync(migDir), 'prisma/migrations ausente — projeto usa db push?').toBe(true);
    // NB: readdirSync direto — migDir já é absoluto; listDir() re-faria join(root, ...)
    const entries = readdirSync(migDir).filter((d) => /^\d{14}_/.test(d));
    expect(entries.length, 'nenhuma migration versionada').toBeGreaterThan(0);
    const lock = read('prisma/migrations/migration_lock.toml');
    expect(lock).toMatch(/provider\s*=\s*"postgresql"/);
  });
});

describe('RUN8-W1 — evidência da onda (inventário recon)', () => {
  it('RUN8_PRISMA_INVENTORY.json existe, parseia e traz findings estruturados', () => {
    const audits = join(root, '99_AUDITS');
    const dirs = readdirSync(audits).filter((d) => /^RUN8_W1_\d{8}_\d{6}$/.test(d)).sort();
    const latest = dirs[dirs.length - 1];
    expect(latest, 'nenhum 99_AUDITS com RUN8_W1 — recon não rodou').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(audits, latest!, 'RUN8_PRISMA_INVENTORY.json'), 'utf8'));
    expect(inv.datasource.provider).toBe('postgresql');
    expect(inv.totals.models).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(inv.findings)).toBe(true);
    expect(Array.isArray(inv.reservationModelNames)).toBe(true);
    expect(inv.reservationModelNames.length).toBeGreaterThanOrEqual(1);
    expect(inv.transactions).toHaveProperty('files');
    expect(typeof inv.overlapExcludeConstraint).toBe('boolean');
  });
});
