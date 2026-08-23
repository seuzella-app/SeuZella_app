import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/readiness/route.ts', 'utf8');

describe('readiness security contract', () => {
  it('returns readiness state and disables caching', () => {
    expect(source).toContain('status:');
    expect(source).toContain('Cache-Control');
    expect(source).toContain('no-store');
  });
});
