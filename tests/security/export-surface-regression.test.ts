import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('export surface regression', () => {
  it('requires tenant/auth boundaries for lead export', () => {
    const p = 'src/app/api/export/leads/route.ts';
    if (!fs.existsSync(p)) return;
    const s = fs.readFileSync(p, 'utf8');
    expect(s).toMatch(/tenantId/i);
    expect(s).toMatch(/auth|session|require/i);
    expect(s).not.toMatch(/findMany\(\{\s*where:\s*\{\s*\}\s*\}\)/i);
  });
});
