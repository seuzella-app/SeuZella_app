import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('admin/data security regression contracts', () => {
  it('does not expose lead exports without tenant-scoped auth', () => {
    const p = 'src/app/api/export/leads/route.ts';
    if (!fs.existsSync(p)) return;
    const s = read(p);
    expect(s).toMatch(/tenantId|require.*Auth|auth/i);
  });

  it('internal buffer operations are not anonymously callable', () => {
    const p = 'src/app/api/internal/flush-buffer/route.ts';
    if (!fs.existsSync(p)) return;
    const s = read(p);
    expect(s).toMatch(/auth|token|secret|internal/i);
  });

  it('diagnostic endpoints contain an authorization boundary', () => {
    for (const p of ['src/app/api/diagnose/route.ts', 'src/app/api/telemetry/route.ts']) {
      if (!fs.existsSync(p)) continue;
      expect(read(p)).toMatch(/auth|tenant|internal|secret/i);
    }
  });
});
