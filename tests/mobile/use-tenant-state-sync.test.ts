/**
 * useTenantStateSync — source-level contract tests.
 *
 * These tests validate the hook's source structure and exported API without
 * requiring a DOM environment (jsdom is not installed; vitest runs in node).
 * Behavioral tests are deferred to E2E (Playwright) which runs in a real
 * browser.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { broadcastTenantStateUpdate } from '@/components/mobile/use-tenant-state-sync';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('useTenantStateSync — exported API', () => {
  it('exports useTenantStateSync hook and broadcastTenantStateUpdate function', async () => {
    const mod = await import('@/components/mobile/use-tenant-state-sync');
    expect(typeof mod.useTenantStateSync).toBe('function');
    expect(typeof mod.broadcastTenantStateUpdate).toBe('function');
  });

  it('TenantStateSync interface includes all 4 required fields', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain('tenantName');
    expect(source).toContain('rooms');
    expect(source).toContain('lastUpdate');
    expect(source).toContain('source');
  });
});

describe('useTenantStateSync — 3-channel listener wiring', () => {
  it('subscribes to BroadcastChannel for modern cross-tab sync', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain("new BroadcastChannel(CHANNEL_NAME)");
    expect(source).toContain('CHANNEL_NAME =');
  });

  it('subscribes to window storage event for legacy fallback', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain("window.addEventListener('storage'");
  });

  it('subscribes to zella:tenant-state custom event for same-tab instant sync', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain("window.addEventListener(CUSTOM_EVENT");
    expect(source).toContain("CUSTOM_EVENT = 'zella:tenant-state'");
  });

  it('cleans up all listeners on unmount (no memory leaks)', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain('bc.close()');
    expect(source).toContain("window.removeEventListener('storage'");
    expect(source).toContain("window.removeEventListener(CUSTOM_EVENT");
  });

  it('gracefully handles SSR (typeof window === "undefined")', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    // The hook must check for SSR before accessing window — otherwise Next.js
    // server-side rendering crashes.
    expect(source).toContain("typeof window === 'undefined'");
  });
});

describe('broadcastTenantStateUpdate — 3-channel dispatch', () => {
  it('dispatches zella:tenant-state custom event for same-tab sync', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain('new CustomEvent(CUSTOM_EVENT');
    expect(source).toContain('window.dispatchEvent');
  });

  it('posts to BroadcastChannel for cross-tab sync', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain('new BroadcastChannel(CHANNEL_NAME)');
    expect(source).toContain('.postMessage(payload)');
  });

  it('persists to localStorage so future tabs pick up state on mount', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain("localStorage.setItem(key, payload.tenantName)");
    expect(source).toContain("localStorage.setItem(key, JSON.stringify(payload.rooms))");
  });

  it('uses niche-specific localStorage keys (pousada vs airbnb)', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain("'zella_pousada_nome'");
    expect(source).toContain("'zella_airbnb_imovel_nome'");
    expect(source).toContain("'zella_pousada_rooms'");
    expect(source).toContain("'zella_airbnb_rooms'");
  });

  it('wraps localStorage.setItem in try/catch (incognito mode safe)', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    // Both setItem calls must be wrapped — otherwise incognito mode crashes.
    const matches = source.match(/try \{[\s\S]*?localStorage\.setItem[\s\S]*?\} catch/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('is a no-op when window is undefined (SSR safe)', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toMatch(/typeof window === 'undefined'/);
  });
});

describe('useTenantStateSync — TenantStateBridge integration contract', () => {
  it('MobileDDCLiveBootstrap.tsx dispatches zella:tenant-state via TenantStateBridge', () => {
    const source = read('src/components/mobile/MobileDDCLiveBootstrap.tsx');
    expect(source).toContain('zella:tenant-state');
    expect(source).toContain('window.dispatchEvent');
    expect(source).toContain('new CustomEvent');
  });
});
