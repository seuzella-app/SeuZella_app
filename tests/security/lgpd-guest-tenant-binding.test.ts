import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('LGPD guest erasure tenant binding', () => {
  it('does not trust a caller-supplied tenant without binding it to the guest', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/lgpd/forget-guest/route.ts'), 'utf8');

    expect(source).toContain("db.guest.findFirst({ where: { id: guestId, tenantId: requestedTenantId");
    expect(source).toContain("if (!guest) {");
    expect(source).toContain('const tenantId = guest.tenantId');
    expect(source).toContain('db.guestMessage.updateMany({');
  });
});
