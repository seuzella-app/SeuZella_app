'use client';

/**
 * @deprecated Use `useTenantRealtimeState` instead.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️  DEPRECATED — This hook does NOT sync across devices.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURAL FLAW (kept for backward-compat, will be removed)
 * --------------------------------------------------------------
 * This hook uses BroadcastChannel + localStorage + CustomEvent, which only
 * sync across **tabs of the same browser** (same-origin). It does NOT sync
 * across devices — a phone and a laptop cannot exchange state through
 * localStorage.
 *
 * The correct replacement is `useTenantRealtimeState` in
 * `src/components/ddc/use-tenant-realtime-state.ts`, which:
 *   - Connects to `/api/ddc/realtime/tenant-state` (SSE)
 *   - Server pushes events to ALL subscribers of the same tenantId
 *   - Works across devices, networks, and browsers
 *   - Backed by PostgreSQL (single source of truth)
 *
 * Migration path
 * --------------
 *   // ❌ OLD (broken cross-device)
 *   import { useTenantStateSync } from '@/components/mobile/use-tenant-state-sync';
 *   const state = useTenantStateSync();
 *
 *   // ✅ NEW (real cross-device sync)
 *   import { useTenantRealtimeState } from '@/components/ddc/use-tenant-realtime-state';
 *   const { snapshot, lastEvent, connectionState } = useTenantRealtimeState();
 *
 * Removal scheduled
 * ----------------
 * This file will be deleted once all consumers migrate. Tests in
 * `tests/mobile/use-tenant-state-sync.test.ts` will also be removed.
 *
 * Original (now-corrected) docstring below for historical context.
 * ============================================================================
 *
 * useTenantStateSync — SAME-BROWSER cross-tab tenant state sync
 * ============================================================================
 *
 * PROBLEM (now solved by useTenantRealtimeState)
 * -------
 * The `TenantStateBridge` in `MobileDDCLiveBootstrap.tsx` dispatches a
 * `zella:tenant-state` CustomEvent whenever the tenant's live state updates
 * (e.g. tenant.name changes). But NO component listens to this event —
 * desktop DDC content uses hardcoded mock arrays, mobile SuperApps use
 * inline useState, so changes made on mobile never reach desktop and vice
 * versa.
 *
 * SOLUTION (limited to same-browser tabs only)
 * --------
 * This hook subscribes to THREE same-browser channels:
 *   1. BroadcastChannel API (modern browsers, real-time cross-tab)
 *   2. window.storage event (legacy fallback for older browsers/Safari)
 *   3. Custom `zella:tenant-state` event (same-tab only, instant)
 *
 * When any of these fires, the hook updates its internal state and re-renders
 * the consuming component. This means: change a room PIN on mobile → desktop
 * DDC content (in the same browser) updates within 1 frame.
 *
 * USAGE
 * -----
 *   const tenantState = useTenantStateSync();
 *   // tenantState.tenantName, tenantState.rooms, tenantState.lastUpdate
 *
 * GRACEFUL DEGRADATION
 * --------------------
 * If BroadcastChannel is unavailable (very old browsers), the hook falls
 * back to localStorage events only. If neither is available (SSR), it
 * returns null and the consumer renders its default state.
 */

import { useEffect, useState } from 'react';

export interface TenantStateSync {
  tenantName: string | null;
  rooms: unknown[] | null;
  lastUpdate: number | null;
  source: 'broadcast' | 'storage' | 'custom' | 'init';
}

const CHANNEL_NAME = 'zella-tenant-state';
const STORAGE_KEYS = ['zella_pousada_nome', 'zella_airbnb_imovel_nome', 'zella_pousada_rooms', 'zella_airbnb_rooms'];
const CUSTOM_EVENT = 'zella:tenant-state';

function readInitialState(): TenantStateSync {
  if (typeof window === 'undefined') {
    return { tenantName: null, rooms: null, lastUpdate: null, source: 'init' };
  }

  // Try to read from localStorage (best-effort — may be empty on first load).
  let tenantName: string | null = null;
  let rooms: unknown[] | null = null;

  for (const key of STORAGE_KEYS) {
    try {
      const value = window.localStorage.getItem(key);
      if (!value) continue;
      if (key.endsWith('_nome')) {
        tenantName = value;
      } else if (key.endsWith('_rooms')) {
        rooms = JSON.parse(value);
      }
    } catch {
      // localStorage may throw in incognito mode or with strict CSP.
    }
  }

  return { tenantName, rooms, lastUpdate: Date.now(), source: 'init' };
}

export function useTenantStateSync(): TenantStateSync {
  const [state, setState] = useState<TenantStateSync>(readInitialState);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel — modern cross-tab sync
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data && typeof event.data === 'object') {
          setState({
            tenantName: event.data.tenantName ?? null,
            rooms: event.data.rooms ?? null,
            lastUpdate: Date.now(),
            source: 'broadcast',
          });
        }
      };
    }

    // 2. window.storage event — legacy fallback
    const onStorage = (event: StorageEvent) => {
      if (!STORAGE_KEYS.includes(event.key || '')) return;
      try {
        const newValue = event.newValue ? JSON.parse(event.newValue) : null;
        setState((prev) => ({
          tenantName: event.key?.endsWith('_nome') ? (typeof newValue === 'string' ? newValue : event.newValue) : prev.tenantName,
          rooms: event.key?.endsWith('_rooms') ? (Array.isArray(newValue) ? newValue : prev.rooms) : prev.rooms,
          lastUpdate: Date.now(),
          source: 'storage',
        }));
      } catch {
        // Ignore malformed storage values.
      }
    };
    window.addEventListener('storage', onStorage);

    // 3. Custom event — same-tab instant sync (dispatched by TenantStateBridge)
    const onCustom = (event: Event) => {
      const {detail} = (event as CustomEvent);
      if (detail && typeof detail === 'object') {
        setState({
          tenantName: detail.name ?? detail.tenantName ?? null,
          rooms: detail.rooms ?? null,
          lastUpdate: Date.now(),
          source: 'custom',
        });
      }
    };
    window.addEventListener(CUSTOM_EVENT, onCustom);

    return () => {
      if (bc) {
        bc.close();
        bc = null;
      }
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CUSTOM_EVENT, onCustom);
    };
  }, []);

  return state;
}

/**
 * Broadcast a tenant state update to all listening tabs/devices.
 *
 * Used by:
 *   - TenantStateBridge (same-tab dispatch via CustomEvent)
 *   - Cross-tab changes (mobile PIN update → desktop re-render)
 */
export function broadcastTenantStateUpdate(payload: {
  tenantName?: string;
  rooms?: unknown[];
  niche?: 'pousada' | 'airbnb';
}): void {
  if (typeof window === 'undefined') return;

  // 1. Same-tab instant sync (custom event — listened by useTenantStateSync)
  window.dispatchEvent(new CustomEvent(CUSTOM_EVENT, { detail: payload }));

  // 2. Cross-tab sync (BroadcastChannel)
  if ('BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    } catch {
      // BroadcastChannel can fail in some iframe sandboxes.
    }
  }

  // 3. Persist to localStorage so future tabs pick it up on load
  if (payload.tenantName && payload.niche) {
    const key = payload.niche === 'pousada' ? 'zella_pousada_nome' : 'zella_airbnb_imovel_nome';
    try {
      window.localStorage.setItem(key, payload.tenantName);
    } catch {
      // localStorage may throw in incognito mode.
    }
  }
  if (payload.rooms && payload.niche) {
    const key = payload.niche === 'pousada' ? 'zella_pousada_rooms' : 'zella_airbnb_rooms';
    try {
      window.localStorage.setItem(key, JSON.stringify(payload.rooms));
    } catch {
      // localStorage may throw in incognito mode.
    }
  }
}
