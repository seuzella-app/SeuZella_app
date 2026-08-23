import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/readiness/route.ts', 'utf8');

describe('readiness security contract', () => {
  it('returns only readiness state and disables caching', () => {
    expect(source).toContain('{ ready, status: health.status }');
    expect(source).toContain("'Cache-Control': 'no-store'");
    expect(source).toContain("'X-Content-Type-Options': 'nosniff'");
    expect(source).not.toContain('return NextResponse.json(health');
  });
});
