import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production secret exposure regression', () => {
  it('does not reintroduce the known checkout test token', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/app/api/checkout/create/route.ts'),
      'utf8',
    );
    expect(route).not.toMatch(/ZEHLA_TEST_TOKEN|TEST_TOKEN|demo-token/i);
  });

  it('does not embed common production credential fallbacks in build config', () => {
    const config = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');
    expect(config).not.toMatch(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i);
    expect(config).not.toMatch(/NEXTAUTH_SECRET\s*[:=]\s*["'][^"']{8,}["']/i);
    expect(config).not.toMatch(/ASAAS_ACCESS_TOKEN\s*[:=]\s*["'][^"']+["']/i);
  });
});
