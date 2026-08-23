import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guard = fs.readFileSync(path.join(root, 'src/components/ddc/DDCStaleShellGuard.tsx'), 'utf8');
const versionRoute = fs.readFileSync(path.join(root, 'src/app/api/ddc/runtime-version/route.ts'), 'utf8');
const pousadaPage = fs.readFileSync(path.join(root, 'src/app/ddc/pousada/page.tsx'), 'utf8');
const pousadaClient = fs.readFileSync(path.join(root, 'src/app/ddc/pousada/DDCPousadaClientContent.tsx'), 'utf8');
const airbnbPage = fs.readFileSync(path.join(root, 'src/app/ddc/airbnb/page.tsx'), 'utf8');
const airbnbClient = fs.readFileSync(path.join(root, 'src/app/ddc/airbnb/DDCAirbnbClientContent.tsx'), 'utf8');

const ddcGuardContract = (source: string) => {
  expect(source).toContain("fetch('/api/ddc/runtime-version'");
  expect(source).toContain("cache: 'no-store'");
  expect(source).toContain("url.searchParams.set('__ddc_build'");
  expect(source).toContain("navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1");
};

describe('DDC iPad stale-shell protection', () => {
  it('uses a server-authoritative uncached deployment identity', () => {
    expect(versionRoute).toContain('VERCEL_GIT_COMMIT_SHA');
    expect(versionRoute).toContain("Cache-Control");
    expect(versionRoute).toContain('no-store');
    expect(versionRoute).toContain('force-dynamic');
  });

  it('detects modern iPadOS Safari without affecting desktop/mobile', () => {
    ddcGuardContract(guard);
    expect(guard).toContain("/iPad/i.test(navigator.userAgent)");
  });

  it('is wired into both DDC niches', () => {
    expect(pousadaPage).toContain('VERCEL_GIT_COMMIT_SHA');
    expect(pousadaClient).toContain('DDCStaleShellGuard');
    expect(airbnbPage).toContain('VERCEL_GIT_COMMIT_SHA');
    expect(airbnbClient).toContain('DDCStaleShellGuard');
  });

  it('does not use a desktop/mobile device redirect', () => {
    expect(guard).not.toContain("window.location.href = '/mobile'");
    expect(guard).not.toContain("window.location.href = '/ddc'");
  });
});
