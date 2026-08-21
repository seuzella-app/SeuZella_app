import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/cron/cerebro-cleanup/route.ts', 'utf8');

describe('cron cleanup security contract', () => {
  it('returns a generic failure without exposing exception details', () => {
    expect(source).toContain("error: 'Cleanup unavailable'");
    expect(source).toContain('status: 503');
    expect(source).not.toContain("error: error instanceof Error ? error.message");
    expect(source).toContain("'Cache-Control': 'no-store'");
  });
});
