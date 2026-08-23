import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('Mobile offline safety', () => {
  it('keeps the current service-worker version and offline shell', () => {
    expect(sw).toContain('seuzella-pwa-v4');
    expect(sw).toContain("OFFLINE_URL = '/offline.html'");
  });

  it('does not use the non-standard IndexedDB transaction completion property', () => {
    expect(sw).not.toContain('tx.done');
  });

  it('does not delete queued actions before a successful replay', () => {
    expect(sw).toContain('response.ok');
  });
});
