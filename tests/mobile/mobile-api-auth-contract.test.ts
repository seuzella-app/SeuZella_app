import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const source = readFileSync(resolve(root, 'src/app/api/ddc/mobile/state/route.ts'), 'utf8');

describe('DDC Mobile API authorization', () => {
  it('resolves tenant identity server-side', () => {
    expect(source).toContain('requireTenantId');
    expect(source).not.toMatch(/tenantId\s*=\s*(searchParams|body|request|headers)/i);
  });

  it('queries operational reservations through Prisma', () => {
    expect(source).toContain('prisma.reservation.findMany');
    expect(source).toContain('tenantId');
  });
});
