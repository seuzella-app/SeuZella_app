import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Mobile production security contracts', () => {
  it('requires server-side tenant resolution for mobile state', () => {
    const source = read('src/app/api/ddc/mobile/state/route.ts');
    expect(source).toContain('requireTenantId');
    expect(source).not.toMatch(/tenantId\s*[:=].*searchParams/i);
  });

  it('keeps mobile live context authenticated and non-cacheable', () => {
    const source = read('src/components/mobile/useDDCMobileLiveState.ts');
    expect(source).toContain('credentials: \'same-origin\'');
    expect(source).toContain("cache: 'no-store'");
  });
});
