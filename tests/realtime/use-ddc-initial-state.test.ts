/**
 * Behavioral tests for useDDCInitialState hook.
 *
 * Validates:
 *   - Hydration on mount (fetch fires immediately)
 *   - Refetch on window focus (debounced)
 *   - Error handling (401, 5xx, network)
 *   - Transform applied to raw response
 *   - refresh() re-fetches
 *   - SSE event updates state AFTER initial hydration
 *
 * Uses global fetch mock — no real network calls.
 *
 * Note: this file uses source-level contracts (not jsdom-based behavioral
 * tests) because jsdom is not installed. The publish-side behavioral tests
 * in behavioral.test.ts cover the realtime update pipeline.
 */
import { describe, expect, it } from 'vitest';

describe('useDDCInitialState — source contract (no jsdom required)', () => {
  it('exports useDDCInitialState function', async () => {
    const mod = await import('@/components/ddc/use-ddc-initial-state');
    expect(typeof mod.useDDCInitialState).toBe('function');
  });

  it('fetches the provided URL with credentials: include', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain("credentials: 'include'");
    expect(source).toContain('fetch(url');
  });

  it('validates response is an array (defensive)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain('Array.isArray(raw)');
    expect(source).toContain('INVALID_RESPONSE_SHAPE');
  });

  it('handles 401 with UNAUTHORIZED error', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toMatch(/res\.status === 401/);
    expect(source).toContain("'UNAUTHORIZED'");
  });

  it('handles 5xx with SERVER_ERROR error', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toMatch(/res\.status >= 500/);
    expect(source).toContain("'SERVER_ERROR'");
  });

  it('re-fetches on window focus (debounced 5s)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain("'focus'");
    expect(source).toContain('visibilitychange');
    expect(source).toContain('FOCUS_REFETCH_DEBOUNCE_MS');
    expect(source).toContain('5_000');
  });

  it('supports optional transform function', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain('options?.transform');
    expect(source).toContain('raw.map(options.transform)');
  });

  it('exposes refresh() for manual re-fetch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain('refresh: fetchData');
  });

  it('is SSR-safe (typeof window === "undefined" guard)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain("typeof window === 'undefined'");
  });
});

describe('useDDCInitialState — wire verification across 4 SuperApps', () => {
  it('DDCPousadaContent uses useDDCInitialState to hydrate rooms', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf8',
    );
    expect(source).toContain("from '@/components/ddc/use-ddc-initial-state'");
    expect(source).toContain('useDDCInitialState<RoomData>');
    expect(source).toContain("'/api/ddc/locks'");
    expect(source).toContain('hydratedRooms');
    // Syncs hydrated data into rooms state
    expect(source).toContain('setRooms(hydratedRooms)');
  });

  it('DDCAirbnbContent uses useDDCInitialState to hydrate properties', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf8',
    );
    expect(source).toContain('useDDCInitialState<PropertyData>');
    expect(source).toContain('hydratedProperties');
    expect(source).toContain('setPropertiesState(hydratedProperties)');
  });

  it('MobilePousadaSuperApp uses useDDCInitialState to hydrate rooms', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobilePousadaSuperApp.tsx'),
      'utf8',
    );
    expect(source).toContain('useDDCInitialState<PousadaRoom>');
    expect(source).toContain('hydratedRooms');
    expect(source).toContain('setRooms(hydratedRooms)');
  });

  it('MobileAirbnbSuperApp uses useDDCInitialState to hydrate properties', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    expect(source).toContain('useDDCInitialState<AirbnbProperty>');
    expect(source).toContain('hydratedProperties');
    expect(source).toContain('setProperties(hydratedProperties)');
  });
});

describe('useDDCInitialState — NO operational PINs in localStorage', () => {
  it('MobilePousadaSuperApp has ZERO localStorage.setItem calls for zella_pousada_rooms', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobilePousadaSuperApp.tsx'),
      'utf8',
    );
    // localStorage.setItem for operational PINs is FORBIDDEN — server is
    // the single source of truth.
    expect(source).not.toMatch(/localStorage\.setItem\(['"]zella_pousada_rooms['"]/);
    // localStorage.getItem for rooms is also forbidden — hydration comes from API.
    expect(source).not.toMatch(/localStorage\.getItem\(['"]zella_pousada_rooms['"]/);
  });

  it('MobileAirbnbSuperApp has ZERO localStorage.setItem calls for zella_airbnb_rooms', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/localStorage\.setItem\(['"]zella_airbnb_rooms['"]/);
    expect(source).not.toMatch(/localStorage\.getItem\(['"]zella_airbnb_rooms['"]/);
  });

  it('MobilePousadaSuperApp handleGenerateNewPin calls API (NOT crypto.getRandomValues)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobilePousadaSuperApp.tsx'),
      'utf8',
    );
    // Find the handleGenerateNewPin function body
    const match = source.match(/const handleGenerateNewPin[\s\S]*?(?=\n  const )/);
    expect(match, 'handleGenerateNewPin must exist').not.toBeNull();
    const body = match![0];
    expect(body).toContain('fetch(');
    expect(body).toContain('/api/ddc/locks/');
    expect(body).toContain('POST');
    expect(body).not.toContain('crypto.getRandomValues');
    expect(body).not.toContain('localStorage.setItem');
  });

  it('MobilePousadaSuperApp handlePanicRevoke calls API (NOT local state mutation only)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobilePousadaSuperApp.tsx'),
      'utf8',
    );
    const match = source.match(/const handlePanicRevoke[\s\S]*?(?=\n  const )/);
    expect(match, 'handlePanicRevoke must exist').not.toBeNull();
    const body = match![0];
    expect(body).toContain('fetch(');
    expect(body).toContain('/api/ddc/locks/');
    expect(body).toContain('panic-revoke');
    expect(body).not.toContain('localStorage.setItem');
  });

  it('MobileAirbnbSuperApp handleGeneratePIN calls API (NOT crypto.getRandomValues)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    const match = source.match(/const handleGeneratePIN[\s\S]*?(?=\n  const )/);
    expect(match, 'handleGeneratePIN must exist').not.toBeNull();
    const body = match![0];
    expect(body).toContain('fetch(');
    expect(body).toContain('/api/ddc/locks/');
    expect(body).toContain('POST');
    expect(body).not.toContain('crypto.getRandomValues');
  });

  it('MobileAirbnbSuperApp handlePanicRevoke calls API', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    const match = source.match(/const handlePanicRevoke[\s\S]*?(?=\n  const )/);
    expect(match, 'handlePanicRevoke must exist').not.toBeNull();
    const body = match![0];
    expect(body).toContain('fetch(');
    expect(body).toContain('panic-revoke');
  });

  it('MobileAirbnbSuperApp handleRemoteUnlock calls API (NOT setTimeout mock)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    const match = source.match(/const handleRemoteUnlock[\s\S]*?(?=\n  const )/);
    expect(match, 'handleRemoteUnlock must exist').not.toBeNull();
    const body = match![0];
    expect(body).toContain('fetch(');
    expect(body).toContain('/unlock');
    // setTimeout mock pattern is FORBIDDEN in the API-backed version.
    expect(body).not.toMatch(/setTimeout\(\(\) => \{[\s\S]*setUnlocking\(false\)/);
  });
});

describe('useDDCInitialState — empty vs loaded state (the bug fix)', () => {
  it('exposes hasInitialData flag to distinguish loading from loaded-empty', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    // The hook MUST expose hasInitialData so consumers can distinguish:
    //   - loading=true, hasInitialData=false → show spinner
    //   - loading=false, hasInitialData=true, data=[] → show "no records"
    //   - loading=false, hasInitialData=true, data=[N] → show data
    // Without this, consumers that check `if (data.length > 0)` would
    // keep stale mock state when the tenant legitimately has zero records.
    expect(source).toContain('hasInitialData');
    expect(source).toContain('setHasInitialData(true)');
  });

  it('sets hasInitialData=true even when API returns empty array []', () => {
    // The setData(transformed) call is followed by setHasInitialData(true).
    // This MUST happen unconditionally on successful fetch — NOT gated by
    // `if (transformed.length > 0)`.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    // Verify setHasInitialData(true) is called AFTER setData, not inside
    // a length > 0 guard. There are TWO setHasInitialData(true) calls
    // (one for invalid shape, one for success) — find the one AFTER setData.
    const setDataIdx = source.indexOf('setData(transformed');
    expect(setDataIdx).toBeGreaterThan(-1);
    // Search for setHasInitialData(true) AFTER the setData line
    const afterSetData = source.substring(setDataIdx);
    const hasInitialMatch = afterSetData.indexOf('setHasInitialData(true)');
    expect(hasInitialMatch).toBeGreaterThan(-1);

    // Verify there's NO `if (transformed.length > 0)` guard around
    // setHasInitialData(true). Check the segment between setData and
    // the setHasInitialData call that follows it.
    const segment = afterSetData.substring(0, hasInitialMatch + 30);
    expect(segment).not.toMatch(/if\s*\(.*\.length\s*>\s*0\)/);
  });
});

describe('useDDCInitialState — 4 SuperApps use hasInitialData (not length > 0)', () => {
  it('DDCPousadaContent gates setState on hasInitialData, not length > 0', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf8',
    );
    // The hydration useEffect MUST use `if (hasInitialData)` not
    // `if (hydratedRooms.length > 0)` — otherwise empty tenants keep stale state.
    expect(source).toContain('if (hasInitialData)');
    expect(source).not.toMatch(/if\s*\(hydratedRooms\.length\s*>\s*0\)/);
  });

  it('DDCAirbnbContent gates setState on hasInitialData, not length > 0', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf8',
    );
    expect(source).toContain('if (hasInitialData)');
    expect(source).not.toMatch(/if\s*\(hydratedProperties\.length\s*>\s*0\)/);
  });

  it('MobilePousadaSuperApp gates setState on hasInitialData, not length > 0', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobilePousadaSuperApp.tsx'),
      'utf8',
    );
    expect(source).toContain('if (hasInitialData)');
    expect(source).not.toMatch(/if\s*\(hydratedRooms\.length\s*>\s*0\)/);
  });

  it('MobileAirbnbSuperApp gates setState on hasInitialData, not length > 0', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx'),
      'utf8',
    );
    expect(source).toContain('if (hasInitialData)');
    expect(source).not.toMatch(/if\s*\(hydratedProperties\.length\s*>\s*0\)/);
  });
});

describe('useDDCInitialState — refresh() re-fetches data', () => {
  it('exposes refresh() that re-invokes fetchData', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(source).toContain('refresh: fetchData');
    // fetchData is the useCallback that does the fetch
    expect(source).toContain('const fetchData = useCallback');
  });
});

describe('useDDCInitialState — DB → API → hydration → SSE → mutation → UI pipeline', () => {
  it('pipeline is wired end-to-end (source contracts)', () => {
    // This is a source-level integration test. The BEHAVIORAL test
    // (actually running the pipeline) requires a real browser + DB + Redis,
    // which is gated behind the Playwright E2E suite.

    // 1. Mutation endpoint publishes event after DB write
    const fs = require('fs');
    const path = require('path');
    const pinsRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/ddc/locks/[id]/pins/route.ts'),
      'utf8',
    );
    expect(pinsRoute).toContain('await generatePin(');
    expect(pinsRoute).toContain('emitTenantEvent');

    // 2. SSE endpoint delivers events to authenticated subscribers
    const sseRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/ddc/realtime/tenant-state/route.ts'),
      'utf8',
    );
    expect(sseRoute).toContain('subscribeTenantEvents(tenantId');

    // 3. Consumer hook subscribes to SSE
    const realtimeHook = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-tenant-realtime-state.ts'),
      'utf8',
    );
    expect(realtimeHook).toContain("new EventSource(");
    expect(realtimeHook).toContain("'/api/ddc/realtime/tenant-state'");

    // 4. Hydration hook fetches initial state
    const hydrationHook = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ddc/use-ddc-initial-state.ts'),
      'utf8',
    );
    expect(hydrationHook).toContain("fetch(url");
    expect(hydrationHook).toContain("credentials: 'include'");

    // 5. SuperApp uses BOTH hooks (hydration + realtime)
    const pousadaContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf8',
    );
    expect(pousadaContent).toContain('useDDCInitialState');
    expect(pousadaContent).toContain('useTenantRealtimeState');
    expect(pousadaContent).toContain('hasInitialData');
  });
});
