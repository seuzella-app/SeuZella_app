import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const source = readFileSync(
  resolve(root, 'src/app/api/ddc/locks/[id]/pins/route.ts'),
  'utf8',
);

describe('DDC Mobile lock/PIN security contract', () => {
  it('requires an authenticated tenant before listing or creating PINs', () => {
    expect(source).toContain('const tenantId = await resolveTenantId();');
    expect(source).toContain("if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });");
  });

  it('does not accept tenantId from the request body', () => {
    expect(source).not.toMatch(/body\.tenantId/);
    expect(source).not.toMatch(/const\s*\{[^}]*tenantId[^}]*\}\s*=\s*body/);
  });

  it('bounds request and PIN input', () => {
    expect(source).toContain('MAX_BODY_BYTES = 16 * 1024');
    expect(source).toContain('PAYLOAD_TOO_LARGE');
    expect(source).toContain('/^\\d{4,12}$/');
  });

  it('prevents caching of credential-bearing responses', () => {
    expect(source).toContain("Cache-Control': 'private, no-store'");
  });
});
