import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile shared data boundary', () => {
  it('uses one provider for both mobile niches', () => {
    const source = read('src/components/mobile/MobileDDCDataBoundary.tsx');
    expect(source).toContain('MobileDDCLiveProvider');
    expect(source).not.toContain('tenantId');
  });

  it('keeps the live context authenticated and canonical', () => {
    const source = read('src/components/mobile/MobileDDCLiveContext.tsx');
    expect(source).toContain('useDDCMobileLiveState(true)');
    expect(source).toContain('MobileDDCLiveContext.Provider');
  });
});
