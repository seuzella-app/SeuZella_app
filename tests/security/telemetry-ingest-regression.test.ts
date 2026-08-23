import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/telemetry/ingest/route.ts', 'utf8');

describe('telemetry ingest security contract', () => {
  it('binds events to the authenticated DDC tenant and fails closed', () => {
    expect(source).toContain('requireDDCTenantId');
    expect(source).toContain('body.tenantId !== tenantId');
    expect(source).toContain('Tenant mismatch');
    expect(source).toContain('Tenant unavailable');
    expect(source).toContain('status: 503');
    expect(source).toContain('MAX_BODY_BYTES');
  });
});
