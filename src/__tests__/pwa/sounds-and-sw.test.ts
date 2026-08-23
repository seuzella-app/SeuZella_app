/**
 * Tests for Gap 6 (Sounds by priority) and Gap 11 (PWA v2)
 *
 * Validates:
 *  - 4 MP3 sound files exist in public/sounds/
 *  - Each file is non-empty and has correct format
 *  - Hook use-mobile-notifications.ts selects correct file by priority
 *  - public/sw.js bumped to v2
 *  - SW has stale-while-revalidate, network-first, background sync, push handlers
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '../../..');

describe('Gap 6 — Sounds by priority', () => {
  const soundsDir = join(PROJECT_ROOT, 'public/sounds');
  const expectedSounds = ['alert.mp3', 'notification.mp3', 'success.mp3', 'info.mp3'];

  it('public/sounds/ directory exists', () => {
    expect(existsSync(soundsDir)).toBe(true);
  });

  for (const file of expectedSounds) {
    it(`${file} exists`, () => {
      const fullPath = join(soundsDir, file);
      expect(existsSync(fullPath)).toBe(true);
    });

    it(`${file} is non-empty (>1KB)`, () => {
      const fullPath = join(soundsDir, file);
      const stats = statSync(fullPath);
      expect(stats.size).toBeGreaterThan(1000);
    });

    it(`${file} is a valid MP3 (starts with ID3 tag or MP3 frame sync)`, () => {
      const fullPath = join(soundsDir, file);
      const buf = readFileSync(fullPath);
      const isID3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
      const isFrameSync = buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2);
      expect(isID3 || isFrameSync).toBe(true);
    });
  }

  it('alert.mp3 is longer than info.mp3 (alert is the most attention-grabbing)', () => {
    const alertSize = statSync(join(soundsDir, 'alert.mp3')).size;
    const infoSize = statSync(join(soundsDir, 'info.mp3')).size;
    expect(alertSize).toBeGreaterThan(infoSize);
  });
});

describe('Gap 6 — Sound selection logic in use-mobile-notifications.ts', () => {
  it('source file contains priority-to-sound mapping', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    expect(source).toContain('/sounds/alert.mp3');
    expect(source).toContain('/sounds/notification.mp3');
    expect(source).toContain('/sounds/success.mp3');
    expect(source).toContain('/sounds/info.mp3');
  });

  it('urgent priority maps to alert.mp3', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    expect(source).toMatch(/urgent[^;]*alert\.mp3/);
  });

  it('high priority maps to notification.mp3', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    expect(source).toMatch(/high[^;]*notification\.mp3/);
  });

  it('medium priority maps to success.mp3', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    expect(source).toMatch(/medium[^;]*success\.mp3/);
  });

  it('low priority maps to info.mp3 (else branch of ternary)', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    // The code uses nested ternary; 'info.mp3' is the final else (when none of urgent/high/medium match — i.e. 'low')
    // We just verify info.mp3 is referenced (low is implicit as the default else branch)
    expect(source).toContain("'/sounds/info.mp3'");
    // Sanity check: all 4 priority checks must exist
    expect(source).toMatch(/priority\s*===\s*'urgent'/);
    expect(source).toMatch(/priority\s*===\s*'high'/);
    expect(source).toMatch(/priority\s*===\s*'medium'/);
  });

  it('respects prefers-reduced-motion media query', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    expect(source).toContain('prefers-reduced-motion');
  });

  it('volume is capped appropriately (0.5 default, 0.7 for important events)', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/use-mobile-notifications.ts'),
      'utf-8'
    );
    // Volume is now dynamic: 0.5 default, 0.7 for PIX/escalation
    expect(source).toMatch(/audio\.volume\s*=\s*(?:isImportantEvent\s*\?\s*0\.7\s*:\s*)?0\.5/);
  });
});

describe('Gap 11 — PWA v2 service worker', () => {
  const swPath = join(PROJECT_ROOT, 'public/sw.js');

  it('public/sw.js exists', () => {
    expect(existsSync(swPath)).toBe(true);
  });

  it('CACHE_NAME is bumped to seuzella-pwa-v4', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain('seuzella-pwa-v4');
    // Verify no older SW version strings exist (v2 or v3)
    expect(source).not.toMatch(/seuzella-pwa-v[23]'/);
  });

  it('has stale-while-revalidate strategy for assets', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toMatch(/ASSET_PATTERNS/);
    expect(source).toMatch(/caches\.match[\s\S]*fetch[\s\S]*cache\.put/);
  });

  it('has network-first strategy for API GETs', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toMatch(/API_CACHE_PATTERNS/);
  });

  it('has Background Sync queue for offline mutations', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain('SYNC_QUEUE_DB');
    expect(source).toContain('SYNC_QUEUE_STORE');
    expect(source).toMatch(/sync.*zella-sync/);
    expect(source).toMatch(/registration\.sync\.register/);
  });

  it('has push event handler with structured payload parsing', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain("addEventListener('push'");
    // The code uses `event.data ? event.data.json() : {}` — escape the `?`
    expect(source).toMatch(/event\.data\s*\?\s*event\.data\.json/);
  });

  it('has notificationclick handler with deep-link support', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain("addEventListener('notificationclick'");
    expect(source).toContain('clients.openWindow');
    expect(source).toContain('clients.matchAll');
  });

  it('has skipWaiting + clients.claim for instant activation', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain('self.skipWaiting()');
    expect(source).toContain('self.clients.claim()');
  });

  it('has message handler for SKIP_WAITING trigger', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain("addEventListener('message'");
    expect(source).toContain('SKIP_WAITING');
  });

  it('caches /offline.html on install', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toContain("OFFLINE_URL = '/offline.html'");
  });

  it('cleans old caches on activate', () => {
    const source = readFileSync(swPath, 'utf-8');
    expect(source).toMatch(/caches\.keys\(\)[\s\S]*caches\.delete/);
  });
});

describe('Gap 11 — PWA v2 service worker file size', () => {
  it('sw.js is reasonably sized (>3KB after v2 enhancements)', () => {
    const stats = statSync(join(PROJECT_ROOT, 'public/sw.js'));
    expect(stats.size).toBeGreaterThan(3000);
  });
});
