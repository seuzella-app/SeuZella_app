import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile entry and niche parity', () => {
  it('keeps the canonical mobile entry independent from niche selection', () => {
    const source = read('src/app/mobile/page.tsx');
    expect(source).toContain('/mobile');
    expect(source).not.toContain('tenantId');
    expect(source).not.toContain('demo-pousada');
  });

  it('uses the same live bootstrap boundary for Pousada and Airbnb', () => {
    const pousada = read('src/app/mobile/pousada/page.tsx');
    const airbnb = read('src/app/mobile/airbnb/page.tsx');
    expect(pousada).toContain('MobileDDCLiveBootstrap');
    expect(airbnb).toContain('MobileDDCLiveBootstrap');
  });

  it('does not treat local fixture data as the canonical tenant source', () => {
    const bootstrap = read('src/components/mobile/MobileDDCLiveBootstrap.tsx');
    expect(bootstrap).toContain('MobileDDCLiveProvider');
    expect(bootstrap).toContain('useMobileDDCLive');
  });
});
