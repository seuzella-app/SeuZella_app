import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile live-state boundary', () => {
  it('exposes one shared provider for both niches', () => {
    const source = read('src/components/mobile/MobileDDCLiveContext.tsx');
    expect(source).toContain('MobileDDCLiveProvider');
    expect(source).toContain('useMobileDDCLive');
  });

  it('keeps the canonical API tenant-scoped server-side', () => {
    const source = read('src/app/api/ddc/mobile/state/route.ts');
    expect(source).toContain('requireTenantId()');
    expect(source).not.toContain('body.tenantId');
    expect(source).toContain("Cache-Control');
  });

  it('derives operational metrics from live reservations rather than fixtures', () => {
    const source = read('src/components/mobile/useDDCMobileOperationalSummary.ts');
    expect(source).toContain('data?.reservations');
    expect(source).not.toContain('Maria Silva');
    expect(source).not.toContain('849201');
  });
});
