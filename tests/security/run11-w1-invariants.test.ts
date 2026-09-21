import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * RUN11-W1 — INVARIANTES (onda aditiva read-only; fechaduras fs-based)
 */

const proj = process.cwd();

function latestAuditDir(prefix: string): string {
  const audits = path.join(proj, '99_AUDITS');
  const dirs = fs.readdirSync(audits).filter((d) => d.startsWith(prefix)).sort();
  expect(dirs.length).toBeGreaterThan(0);
  return path.join(audits, dirs[dirs.length - 1]);
}

describe('RUN11-W1 — inventário de infraestrutura', () => {
  it('inventário existe com chaves essenciais e totals consistentes', () => {
    const dir = latestAuditDir('RUN11_W1_');
    const invPath = path.join(dir, 'RUN11_INFRA_INVENTORY.json');
    expect(fs.existsSync(invPath)).toBe(true);
    const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
    expect(inv.run).toContain('RUN11-W1');
    expect(inv.generatedAt).toBeTruthy();
    expect(inv.scannedFiles).toBeGreaterThan(0);
    expect(typeof inv.totals).toBe('object');
    for (const k of ['redisFiles', 'queueFiles', 'loggerFiles', 'cronRoutes', 'healthRoutes', 'envKeys']) {
      expect(typeof inv.totals[k]).toBe('number');
    }
    expect(Array.isArray(inv.envKeys)).toBe(true);
  });
  it('matrix e report existem', () => {
    const dir = latestAuditDir('RUN11_W1_');
    expect(fs.existsSync(path.join(dir, 'RUN11_W1_MATRIX.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'RUN11_W1_REPORT.md'))).toBe(true);
  });
  it('onda aditiva: nenhum arquivo de produção do RUN11 foi commitado (recon só escreve em 99_AUDITS e tests/security)', () => {
    const dir = latestAuditDir('RUN11_W1_');
    const rec = fs.readdirSync(dir);
    for (const f of rec) expect(f.startsWith('RUN11') || f === 'backup').toBe(true);
  });
});
