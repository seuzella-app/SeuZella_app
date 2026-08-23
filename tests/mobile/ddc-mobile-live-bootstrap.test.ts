import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const bootstrap = path.resolve(process.cwd(), 'src/components/mobile/MobileDDCLiveBootstrap.tsx');
const pousada = path.resolve(process.cwd(), 'src/app/ddc/pousada/DDCPousadaClientContent.tsx');
const airbnb = path.resolve(process.cwd(), 'src/app/ddc/airbnb/DDCAirbnbClientContent.tsx');

describe('DDC Mobile live bootstrap integration', () => {
  it('resolves tenant state through the shared live-state hook', () => {
    // The live-state hook is invoked by MobileDDCLiveProvider (in
    // MobileDDCLiveContext.tsx) — MobileDDCLiveBootstrap wires that provider
    // into both niches via the TenantStateBridge that consumes tenant.name.
    const bootstrapSrc = fs.readFileSync(bootstrap, 'utf8');
    const contextSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileDDCLiveContext.tsx'),
      'utf8'
    );
    expect(bootstrapSrc).toContain('MobileDDCLiveProvider');
    expect(bootstrapSrc).toContain('TenantStateBridge');
    expect(bootstrapSrc).toContain('data.tenant.name');
    expect(contextSrc).toContain('useDDCMobileLiveState(true)');
    expect(bootstrapSrc).not.toContain('__ZELLA_TENANT_ID');
  });

  it('is mounted by both mobile niches', () => {
    const pousadaSource = fs.readFileSync(pousada, 'utf8');
    const airbnbSource = fs.readFileSync(airbnb, 'utf8');
    expect(pousadaSource).toContain('MobileDDCLiveBootstrap niche="pousada"');
    expect(airbnbSource).toContain('MobileDDCLiveBootstrap niche="airbnb"');
  });
});
