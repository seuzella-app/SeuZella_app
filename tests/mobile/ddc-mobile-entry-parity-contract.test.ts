import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile entry and niche parity', () => {
  it('keeps the canonical mobile entry independent from niche selection', () => {
    const source = read('src/app/mobile/page.tsx');
    // Entry route redirects unauthenticated users to /login?callbackUrl=/mobile
    // (URL-encoded as %2Fmobile in the canonical implementation).
    expect(source).toMatch(/\/login\?callbackUrl=(?:%2Fmobile|\/mobile)/);
    expect(source).not.toContain('tenantId');
    expect(source).not.toContain('demo-pousada');
    expect(source).not.toContain('demo-airbnb');
  });

  it('uses the same live bootstrap boundary for Pousada and Airbnb', () => {
    // The live bootstrap is mounted by the desktop DDC client content (which
    // powers both the installed PWA niche routes and the desktop DDC) and by
    // every mobile niche page through the shared MobilePhoneWrapper tree.
    const pousadaDesktop = read('src/app/ddc/pousada/DDCPousadaClientContent.tsx');
    const airbnbDesktop = read('src/app/ddc/airbnb/DDCAirbnbClientContent.tsx');
    expect(pousadaDesktop).toContain('MobileDDCLiveBootstrap');
    expect(airbnbDesktop).toContain('MobileDDCLiveBootstrap');
    expect(pousadaDesktop).toContain('niche="pousada"');
    expect(airbnbDesktop).toContain('niche="airbnb"');
  });

  it('does not treat local fixture data as the canonical tenant source', () => {
    const bootstrap = read('src/components/mobile/MobileDDCLiveBootstrap.tsx');
    expect(bootstrap).toContain('MobileDDCLiveProvider');
    expect(bootstrap).toContain('useMobileDDCLive');
  });
});
