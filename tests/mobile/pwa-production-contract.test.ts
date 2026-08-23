import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('production PWA contracts', () => {
  it('uses the canonical mobile route', () => {
    const manifest = read('src/app/manifest.ts');
    expect(manifest).toContain("start_url: '/mobile'");
    expect(manifest).toContain("id: '/mobile'");
  });

  it('keeps the service worker offline-safe', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("OFFLINE_URL = '/offline.html'");
    expect(sw).not.toContain('tx.done');
    expect(sw).toContain('seuzella-pwa-v4');
  });
});
