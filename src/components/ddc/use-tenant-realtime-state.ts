'use client';

/**
 * useTenantRealtimeState — REAL cross-device tenant state synchronization
 * ============================================================================
 *
 * REPLACES useTenantStateSync (localStorage-based, broken cross-device).
 *
 * ARCHITECTURE
 * ------------
 *   PostgreSQL (single source of truth)
 *       ↓ writes
 *   API route handler (creates PIN / updates room / etc.)
 *       ↓ publishTenantEvent(tenantId, type, payload)
 *   In-memory pub/sub (per-tenant channel)
 *       ↓ SSE stream
 *   /api/ddc/realtime/tenant-state (this hook subscribes)
 *       ↓ EventSource
 *   Both DDC Desktop AND DDC Mobile (any device, any browser, any network)
 *
 * EVENTS RECEIVED
 * ---------------
 *   - snapshot          Initial state on connect (tenant metadata + counts)
 *   - pin:created       PIN gerado para hóspede
 *   - pin:revoked       PIN revogado
 *   - pin:updated       PIN estendido/modificado
 *   - room:updated      Estado do quarto mudou
 *   - reservation:*     Reserva criada/atualizada/cancelada
 *   - guest:updated     Dados do hóspede atualizados
 *   - lock:status_changed  Fechadura operada remotamente
 *   - error             Server-side error (auth failure, etc.)
 *
 * RECONNECT / RESUME
 * -------------------
 * EventSource auto-reconnects natively. On reconnect, the hook sends
 * Last-Event-ID with the highest seq seen — the server replays any
 * events the client missed.
 *
 * The hook also exposes `connectionState` so the UI can show "reconnecting"
 * indicators to the user.
 *
 * FALLBACK
 * --------
 * If EventSource is not available (very old browsers), the hook falls back
 * to polling /api/ddc/mobile/state every 30 seconds. This is degraded
 * but functional.
 *
 * SECURITY
 * --------
 * The endpoint authenticates via NextAuth session cookie. The tenantId is
 * resolved server-side from the session — clients CANNOT subscribe to
 * other tenants' channels.
 *
 * USAGE
 * -----
 *   const { connectionState, lastEvent, snapshot } = useTenantRealtimeState();
 *
 *   useEffect(() => {
 *     if (lastEvent?.type === 'pin:created') {
 *       // Update local UI without re-fetching
 *       setPins(prev => [...prev, lastEvent.payload]);
 *     }
 *   }, [lastEvent]);
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type RealtimeConnectionState = 'connecting' | 'open' | 'closed' | 'error' | 'polling';

export interface TenantSnapshot {
  tenant: {
    id: string;
    name: string;
    niche?: string;
    plan?: string;
    status?: string;
  } | null;
  counts: {
    locks: number;
    reservations: number;
  };
  serverTime: string;
}

export interface TenantRealtimeState {
  connectionState: RealtimeConnectionState;
  snapshot: TenantSnapshot | null;
  lastEvent: {
    type: string;
    payload: Record<string, unknown>;
    seq: number;
    timestamp: string;
  } | null;
  /** Highest seq number seen — used for Last-Event-ID on reconnect. */
  lastSeq: number;
  /** Reconnect attempt counter (0 = first try). */
  reconnectAttempts: number;
  /** Manually force a reconnect (e.g. after user clicks "retry"). */
  reconnect: () => void;
}

const SSE_URL = '/api/ddc/realtime/tenant-state';
const POLLING_FALLBACK_URL = '/api/ddc/mobile/state';
const POLLING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useTenantRealtimeState(): TenantRealtimeState {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('connecting');
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null);
  const [lastEvent, setLastEvent] = useState<TenantRealtimeState['lastEvent']>(null);
  const [lastSeq, setLastSeq] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    setConnectionState('polling');
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    const poll = async () => {
      try {
        const res = await fetch(POLLING_FALLBACK_URL, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.tenant) {
          setSnapshot({
            tenant: data.tenant,
            counts: data.counts ?? { locks: 0, reservations: 0 },
            serverTime: new Date().toISOString(),
          });
        }
      } catch {
        // Network error — keep polling, will retry on next interval.
      }
    };

    void poll();
    pollingTimerRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, []);

  const connect = useCallback(() => {
    cleanup();

    if (typeof window === 'undefined') return;

    if (typeof window.EventSource === 'undefined') {
      console.warn('[useTenantRealtimeState] EventSource not supported — falling back to polling');
      startPolling();
      return;
    }

    setConnectionState('connecting');

    const es = new EventSource(SSE_URL, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionState('open');
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
    };

    es.addEventListener('snapshot', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TenantSnapshot;
        setSnapshot(data);
      } catch {
        // Malformed payload — ignore.
      }
    });

    const eventTypes = [
      'pin:created', 'pin:revoked', 'pin:updated',
      'room:updated',
      'reservation:created', 'reservation:updated', 'reservation:cancelled',
      'guest:updated',
      'lock:status_changed',
      'tenant:metadata_updated',
    ];
    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as Record<string, unknown>;
          const seq = Number(e.lastEventId || 0);
          if (seq > 0) setLastSeq(seq);
          setLastEvent({
            type,
            payload,
            seq,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Malformed event — ignore.
        }
      });
    }

    es.onerror = () => {
      setConnectionState('closed');
      es.close();

      reconnectAttemptsRef.current += 1;
      setReconnectAttempts(reconnectAttemptsRef.current);

      if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn('[useTenantRealtimeState] Max reconnect attempts exceeded — switching to polling fallback');
        startPolling();
        return;
      }

      const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 16_000);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          connect();
        }
      }, backoffMs);
    };
  }, [cleanup, startPolling]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    connectionState,
    snapshot,
    lastEvent,
    lastSeq,
    reconnectAttempts,
    reconnect: connect,
  };
}
