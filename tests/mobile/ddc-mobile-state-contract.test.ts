import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const routePath = path.resolve(process.cwd(), 'src/app/api/ddc/mobile/state/route.ts');

describe('DDC Mobile canonical state boundary', () => {
  const source = fs.readFileSync(routePath, 'utf8');

  it('resolves tenant from authenticated server context', () => {
    expect(source).toContain('requireTenantId()');
    expect(source).not.toContain('searchParams.get(\'tenantId\')');
    expect(source).not.toContain('body.tenantId');
  });

  it('never exposes cacheable operational state', () => {
    expect(source).toContain("'Cache-Control': 'private, no-store'");
    expect(source).toContain("'X-Content-Type-Options': 'nosniff'");
  });

  it('caps reservation fan-out for mobile payloads', () => {
    expect(source).toContain('take: MAX_RESERVATIONS');
    expect(source).toContain('const MAX_RESERVATIONS = 20');
  });

  it('returns a generic production error instead of internal exception details', () => {
    expect(source).toContain("error: 'MOBILE_STATE_UNAVAILABLE'");
    expect(source).not.toContain('error: error.message');
  });
});
