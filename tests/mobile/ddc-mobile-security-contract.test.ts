import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('DDC Mobile security contract', () => {
  const hook = readFileSync(
    resolve(process.cwd(), 'src/components/mobile/useMobileDevicePing.ts'),
    'utf8',
  );

  it('must never send tenantId from the browser telemetry payload', () => {
    expect(hook).not.toMatch(/body:\s*JSON\.stringify\([\s\S]*tenantId/);
    expect(hook).not.toContain('tenantId,');
  });

  it('must use same-origin credentials for authenticated tenant resolution', () => {
    expect(hook).toContain("credentials: 'same-origin'");
  });

  it('must use an ephemeral session device identifier', () => {
    expect(hook).toContain('sessionStorage');
    expect(hook).toContain('crypto.randomUUID()');
  });
});
