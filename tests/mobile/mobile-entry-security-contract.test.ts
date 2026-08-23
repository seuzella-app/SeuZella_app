import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const source = readFileSync(resolve(root, 'src/app/mobile/page.tsx'), 'utf8');

describe('canonical mobile entry security', () => {
  it('does not accept a browser-supplied tenant as routing authority', () => {
    expect(source).not.toMatch(/searchParams.*tenantId|params.*tenantId/i);
    expect(source).not.toContain('localStorage');
  });

  it('returns unauthenticated users to login with the canonical mobile callback', () => {
    expect(source).toMatch(/redirect\(['\"]\/login\?callbackUrl=(?:%2Fmobile|\/mobile)['\"]\)/);
  });

  it('keeps authenticated routing neutral until server-side identity is known', () => {
    expect(source).not.toContain("redirect('/mobile/pousada')");
    expect(source).not.toContain("redirect('/mobile/anfitriao')");
  });
});
