import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Mobile niche parity', () => {
  it('keeps both niches on the same live-state boundary', () => {
    const boundary = read('src/components/mobile/MobileDDCDataBoundary.tsx');
    const context = read('src/components/mobile/MobileDDCLiveContext.tsx');
    expect(boundary).toContain('MobileDDCLiveProvider');
    expect(context).toContain('useDDCMobileLiveState(true)');
  });

  it('keeps operational summary based on reservations rather than fixtures', () => {
    const summary = read('src/components/mobile/useDDCMobileOperationalSummary.ts');
    expect(summary).toContain('data?.reservations');
    expect(summary).not.toMatch(/Maria Silva|João|849201|R\$\s*1\.2/);
  });
});
