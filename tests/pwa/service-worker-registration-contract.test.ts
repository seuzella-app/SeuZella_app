import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA registration contract', () => {
  it('registers the canonical service worker only in production', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/pwa/ServiceWorkerRegistrar.tsx'), 'utf8');
    expect(source).toContain("navigator.serviceWorker.register('/sw.js', { scope: '/' })");
    expect(source).toContain("process.env.NODE_ENV !== 'production'");
  });

  it('mounts the registrar from the root application shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(source).toContain("@/components/pwa/ServiceWorkerRegistrar");
    expect(source).toContain('<ServiceWorkerRegistrar />');
  });
});
