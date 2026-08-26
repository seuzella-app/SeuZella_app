import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bulk WhatsApp tenant isolation', () => {
  it('scopes templates and leads to the authenticated tenant', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/bulk-whatsapp/route.ts'), 'utf8');

    expect(source).toContain('where: { id: templateId, tenantId }');
    expect(source).toMatch(/db\.lead\.updateMany\(\{[\s\S]*?tenantId,[\s\S]*?status:/);
    expect(source).toContain('const tenantId = await requireDDCTenantId()');
  });
});
