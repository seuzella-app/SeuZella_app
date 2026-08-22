import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('useTenantRealtimeState — REAL cross-device sync hook', () => {
  it('is exported from the canonical path', async () => {
    const mod = await import('@/components/ddc/use-tenant-realtime-state');
    expect(typeof mod.useTenantRealtimeState).toBe('function');
  });

  it('connects to /api/ddc/realtime/tenant-state (SSE, NOT localStorage)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain("'/api/ddc/realtime/tenant-state'");
    // Must NOT use localStorage as a sync mechanism (only for fallback polling).
    expect(source).not.toContain('localStorage.setItem');
    expect(source).not.toContain('BroadcastChannel');
  });

  it('uses native EventSource (browser API for SSE)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain('new EventSource(');
    expect(source).toContain('withCredentials: true');
  });

  it('exposes connectionState so the UI can show reconnecting indicators', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toMatch(/connectionState.*'connecting'|'connecting'.*connectionState/);
    expect(source).toContain("'open'");
    expect(source).toContain("'closed'");
    expect(source).toContain("'polling'");
  });

  it('exposes lastEvent so consumers can update UI without re-fetching', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain('lastEvent');
    expect(source).toContain('setLastEvent');
  });

  it('exposes snapshot for initial state on connect', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain('snapshot');
    expect(source).toContain('setSnapshot');
  });

  it('subscribes to all canonical tenant event types', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    const expectedTypes = [
      'pin:created', 'pin:revoked', 'pin:updated',
      'room:updated',
      'reservation:created', 'reservation:updated', 'reservation:cancelled',
      'guest:updated',
      'lock:status_changed',
      'tenant:metadata_updated',
    ];
    for (const type of expectedTypes) {
      expect(source, `must subscribe to "${type}" event`).toContain(`'${type}'`);
    }
  });

  it('implements exponential backoff on reconnect (1s, 2s, 4s, 8s, 16s)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain('Math.pow(2');
    expect(source).toContain('MAX_RECONNECT_ATTEMPTS');
  });

  it('falls back to polling when EventSource is not supported (very old browsers)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain("typeof window.EventSource === 'undefined'");
    expect(source).toContain('startPolling');
    expect(source).toContain('POLLING_FALLBACK_URL');
  });

  it('falls back to polling after MAX_RECONNECT_ATTEMPTS exceeded', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toMatch(/reconnectAttemptsRef\.current > MAX_RECONNECT_ATTEMPTS/);
    expect(source).toContain('startPolling()');
  });

  it('cleans up EventSource and polling timers on unmount (no memory leaks)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain('cleanup');
    expect(source).toContain('eventSourceRef.current.close()');
    expect(source).toContain('clearInterval(pollingTimerRef.current)');
  });

  it('is SSR-safe (typeof window === "undefined" guard)', () => {
    const source = read('src/components/ddc/use-tenant-realtime-state.ts');
    expect(source).toContain("typeof window === 'undefined'");
  });
});

describe('useTenantRealtimeState — SSE endpoint integration contract', () => {
  it('SSE endpoint /api/ddc/realtime/tenant-state exists and is force-dynamic', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain("dynamic = 'force-dynamic'");
    expect(source).toContain("runtime = 'nodejs'");
    expect(source).toContain('text/event-stream');
  });

  it('SSE endpoint authenticates via resolveTenantId (NOT query param)', () => {
    // Critical: tenantId MUST come from the session, not from the URL.
    // Otherwise clients could subscribe to other tenants' channels.
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain('resolveTenantId()');
    expect(source).not.toContain('searchParams.get(\'tenantId\'');
    expect(source).not.toContain('request.headers.get(\'x-tenant-id\'');
  });

  it('SSE endpoint rejects unauthenticated requests with 401', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain("status: 401");
    expect(source).toContain("'UNAUTHORIZED'");
  });

  it('SSE endpoint sends heartbeat every 30s (keep-alive)', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain('HEARTBEAT_INTERVAL_MS');
    expect(source).toContain('30_000');
    expect(source).toContain(':heartbeat');
  });

  it('SSE endpoint supports Last-Event-ID for resume on reconnect', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain("Last-Event-ID");
    expect(source).toContain('getReplayEvents');
    expect(source).toContain('MAX_BUFFER_PER_TENANT');
  });

  it('SSE endpoint sends initial snapshot event on connect', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    // The string 'snapshot' appears as an SSE event name in the route source.
    expect(source).toMatch(/snapshot/);
    expect(source).toContain('initialState');
  });

  it('SSE endpoint closes stream on client abort (request.signal)', () => {
    const source = read('src/app/api/ddc/realtime/tenant-state/route.ts');
    expect(source).toContain('request.signal.addEventListener');
    expect(source).toContain("'abort'");
  });
});

describe('useTenantRealtimeState — replaces deprecated useTenantStateSync', () => {
  it('useTenantStateSync is marked @deprecated in its source file', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toContain('@deprecated');
    expect(source).toContain('useTenantRealtimeState');
  });

  it('useTenantStateSync docstring explicitly states it does NOT sync across devices', () => {
    const source = read('src/components/mobile/use-tenant-state-sync.ts');
    expect(source).toMatch(/does NOT sync across devices|sync across \*\*tabs of the same browser/i);
  });
});
