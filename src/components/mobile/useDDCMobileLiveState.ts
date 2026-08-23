'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MobileState = {
  tenant: {
    id: string;
    name: string;
    niche: string;
    plan: string;
    domain: string | null;
  };
  reservations: Array<{
    id: string;
    guest: { id: string; name: string; phone: string | null } | null;
    room: { id: string; name: string } | null;
    checkIn: string;
    checkOut: string;
    status: string;
    totalPrice: unknown;
    source: string;
  }>;
  generatedAt: string;
};

/** Shared live-data adapter for the Mobile DDC. */
export function useDDCMobileLiveState(enabled = true) {
  const [data, setData] = useState<MobileState | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ddc/mobile/state', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`MOBILE_STATE_${response.status}`);
      const payload = (await response.json()) as { success?: boolean; data?: MobileState };
      if (!payload.success || !payload.data) throw new Error('MOBILE_STATE_INVALID');
      setData(payload.data);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'MOBILE_STATE_UNAVAILABLE');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    return () => requestRef.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
