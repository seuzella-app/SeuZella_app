import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('PWA service worker v3 contracts', () => {
  it('uses versioned cache and offline fallback', () => {
    expect(source).toContain("CACHE_NAME = 'seuzella-pwa-v3'");
    expect(source).toContain("OFFLINE_URL = '/offline.html'");
  });

  it('uses native IndexedDB transaction completion instead of tx.done', () => {
    expect(source).not.toContain('tx.done');
    expect(source).not.toContain('deleteTx.done');
    expect(source).toContain('waitForTransaction');
  });

  it('retains failed queued actions instead of clearing the queue', () => {
    expect(source).toContain('queued action retained after failed replay');
    expect(source).toContain('.delete(keys[index])');
  });

  it('does not hardcode a placeholder brand asset for push notifications', () => {
    expect(source).not.toContain('/SeuZella_Logo_site.png');
    expect(source).toContain("data.icon ? { icon: data.icon } : {}");
  });

  it('opens notification deep-links from the canonical mobile entrypoint', () => {
    expect(source).toContain("data.url || data.actionUrl || '/mobile'");
    expect(source).toContain("|| '/mobile'");
  });
});
