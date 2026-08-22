'use client';

/**
 * useDDCInitialState — Authenticated initial state hydration for DDC
 * ============================================================================
 *
 * REPLACES the previous pattern of starting with `useState<Room[]>([])`
 * and waiting for realtime events. Users opening the DDC for the first
 * time saw an empty screen until the first event arrived — broken UX.
 *
 * ARCHITECTURE
 * ------------
 *   1. Component mounts → useDDCInitialState() fires
 *   2. fetch('/api/ddc/locks') with credentials: 'include'
 *   3. Server resolves tenantId from NextAuth session (NEVER from query)
 *   4. Returns real devices from PostgreSQL
 *   5. Component renders with REAL data
 *   6. useTenantRealtimeState() subscribes to SSE for live updates
 *   7. Mutations publish events → SSE → component updates incrementally
 *
 * REFRESH / RELOGIN
 * -----------------
 * On window focus (user returns to tab) or visibilitychange, the hook
 * re-hydrates. This catches changes made while the tab was inactive
 * (e.g. host created a PIN on mobile while desktop tab was idle).
 *
 * ERROR HANDLING
 * --------------
 * If fetch fails (network error, 401, 5xx), the hook returns:
 *   { data: [], loading: false, error: <reason> }
 * The UI shows an empty state with a retry button. It does NOT crash.
 *
 * SECURITY
 * --------
 * - All fetches use credentials: 'include' (NextAuth cookie).
 * - Server resolves tenantId from session — client cannot inject another
 *   tenant's data.
 * - Responses are validated to be arrays before being stored.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface HydrationState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the data (e.g. after user clicks "retry"). */
  refresh: () => Promise<void>;
  /** Last successful fetch timestamp — useful for telemetry. */
  lastFetch: number | null;
}

const FOCUS_REFETCH_DEBOUNCE_MS = 5_000; // don't refetch more than every 5s on focus

/**
 * Hydrate initial state from an authenticated API endpoint.
 *
 * @param url The API URL to fetch (e.g. '/api/ddc/locks').
 * @param options.optional When true, errors are silent (data stays as previous).
 * @param options.transform Optional transform applied to the response data.
 */
export function useDDCInitialState<T = unknown>(
  url: string,
  options?: {
    transform?: (raw: unknown) => T;
    enabled?: boolean;
  },
): HydrationState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const lastFocusFetchRef = useRef<number>(0);

  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('UNAUTHORIZED');
        } else if (res.status >= 500) {
          setError('SERVER_ERROR');
        } else {
          setError(`HTTP_${res.status}`);
        }
        setLoading(false);
        return;
      }

      const json = await res.json();
      // Server returns { success, data } or { error }
      const raw = json?.data ?? json?.items ?? [];
      if (!Array.isArray(raw)) {
        console.warn('[useDDCInitialState] Response data is not an array:', raw);
        setData([]);
        setError('INVALID_RESPONSE_SHAPE');
        setLoading(false);
        return;
      }

      const transformed = options?.transform ? raw.map(options.transform) : raw;
      setData(transformed as T[]);
      setError(null);
      setLastFetch(Date.now());
    } catch (err) {
      console.error('[useDDCInitialState] fetch failed:', err);
      setError(err instanceof Error ? err.message : 'NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  }, [url, enabled, options?.transform]);

  // Initial fetch on mount
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Re-fetch on window focus (with debounce to avoid spamming)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusFetchRef.current < FOCUS_REFETCH_DEBOUNCE_MS) return;
      lastFocusFetchRef.current = now;
      void fetchData();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    lastFetch,
  };
}
