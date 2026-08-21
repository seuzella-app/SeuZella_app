import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('diagnostic surface regression', () => {
  it('diagnostic routes have an authorization or tenant boundary', () => {
    const candidates = [
      'src/app/api/diagnose/route.ts',
      'src/app/api/telemetry/route.ts',
      'src/app/api/brain/route.ts',
    ];
    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      const s = fs.readFileSync(p, 'utf8');
      expect(s).toMatch(/auth|authorization|tenant|internal|secret/i);
    }
  });
});
