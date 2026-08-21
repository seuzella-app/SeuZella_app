import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('DDC Mobile tenant boundary', () => {
  it('does not send tenantId from the browser telemetry hook', () => {
    const source = read('src/components/mobile/useMobileDevicePing.ts');
    expect(source).toContain("TRACKING_ENDPOINT = '/api/mobile/devices-tracking-v2'");
    expect(source).not.toMatch(/body:\s*JSON\.stringify\([\s\S]*tenantId/);
  });

  it('resolves tenant identity server-side', () => {
    const source = read('src/app/api/mobile/devices-tracking-v2/route.ts');
    expect(source).toContain("import { requireTenantId } from '@/lib/security/tenant-context'");
    expect(source).toContain('const tenantId = await requireTenantId();');
    expect(source).not.toContain('const { tenantId');
  });

  it('never updates a device by deviceId alone', () => {
    const source = read('src/app/api/mobile/devices-tracking-v2/route.ts');
    expect(source).toContain('where: { deviceId, tenantId }');
    expect(source).toContain('where: { id: existing.id }');
  });

  it('bounds the telemetry payload and accepted strings', () => {
    const source = read('src/app/api/mobile/devices-tracking-v2/route.ts');
    expect(source).toContain('MAX_BODY_BYTES = 16_384');
    expect(source).toContain('deviceId.length > 128');
    expect(source).toContain('route.length > 256');
  });
});
