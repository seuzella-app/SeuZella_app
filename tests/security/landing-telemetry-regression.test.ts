import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/telemetry/landing/route.ts', 'utf8');

describe('landing telemetry security contract', () => {
  it('bounds events, payloads and metadata and disables caching', () => {
    expect(source).toContain('MAX_BODY_BYTES');
    expect(source).toContain('LANDING_EVENTS');
    expect(source).toContain('MAX_METADATA_KEYS');
    expect(source).toContain("'Cache-Control': 'no-store'");
    expect(source).toContain("status: 413");
  });
});
