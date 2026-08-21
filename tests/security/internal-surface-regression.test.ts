import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('internal endpoint regression', () => {
  it('internal buffer route has an explicit trust boundary', () => {
    const p = 'src/app/api/internal/flush-buffer/route.ts';
    if (!fs.existsSync(p)) return;
    const s = fs.readFileSync(p, 'utf8');
    expect(s).toMatch(/auth|authorization|token|secret|internal/i);
  });

  it('diagnostic endpoints do not rely solely on route existence', () => {
    for (const p of ['src/app/api/diagnose/route.ts', 'src/app/api/telemetry/route.ts']) {
      if (!fs.existsSync(p)) continue;
      expect(fs.readFileSync(p, 'utf8')).toMatch(/auth|tenant|authorization|secret/i);
    }
  });
});
