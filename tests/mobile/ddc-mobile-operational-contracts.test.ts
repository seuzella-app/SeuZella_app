import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile operational contracts', () => {
  it('has the canonical /mobile entrypoint', () => {
    expect(existsSync(resolve(root, 'src/app/mobile/page.tsx'))).toBe(true);
    expect(read('src/app/mobile/page.tsx')).toMatch(/redirect\(['\"]\/login\?callbackUrl=(?:%2Fmobile|\/mobile)['\"]\)/);
  });

  it('keeps service worker PWA v3 contracts', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain('seuzella-pwa-v4');
    expect(sw).toContain("OFFLINE_URL = '/offline.html'");
    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
  });

  it('keeps mobile operational state server-derived', () => {
    const api = read('src/app/api/ddc/mobile/state/route.ts');
    expect(api).toContain('requireTenantId');
    expect(api).toContain('prisma.reservation.findMany');
    expect(api).not.toContain('tenantId: searchParams');
  });
});
