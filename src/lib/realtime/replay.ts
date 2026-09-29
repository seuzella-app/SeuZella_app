/**
 * SEUZELLA F28-E — Tenant event replay buffer + gap-aware replay planner
 * ============================================================================
 *
 * Extracted from the SSE route so the strategy is unit-testable in isolation.
 *
 * REPLAY CONTRACT (Last-Event-ID resume)
 * --------------------------------------
 * Clients send the highest `seq` they have seen (SSE `Last-Event-ID` header,
 * or `?afterSeq=` on manual reconnects). The planner decides:
 *
 *   - `gap: false` → buffer PROVES continuity (oldest buffered seq is
 *     exactly afterSeq+1 or before): replay every buffered event > afterSeq.
 *   - `gap: true`  → the buffer CANNOT prove continuity (empty, or it starts
 *     after afterSeq+1 — events were lost/trimmed/published on another
 *     instance whose buffer this instance never saw). Replaying a partial
 *     window would SILENTLY skip events, so the caller must resynchronize
 *     the client with a fresh snapshot instead.
 *
 * With the F28-E global seq (Redis INCR), seq values are comparable across
 * instances — which is what makes this gap detection REAL in production.
 *
 * ============================================================================
 */

import type { TenantStateEvent } from './redis-pubsub';

export const MAX_REPLAY_BUFFER_PER_TENANT = 100;

export interface ReplayPlan {
  /** Events safe to replay (empty when a gap forces a snapshot resync). */
  events: TenantStateEvent[];
  /** true → buffer cannot prove continuity; caller must send a snapshot. */
  gap: boolean;
}

export class TenantReplayBuffer {
  private buffers = new Map<string, TenantStateEvent[]>();

  bufferEvent(tenantId: string, event: TenantStateEvent): void {
    const buf = this.buffers.get(tenantId) ?? [];
    buf.push(event);
    if (buf.length > MAX_REPLAY_BUFFER_PER_TENANT) {
      buf.shift();
    }
    this.buffers.set(tenantId, buf);
  }

  get(tenantId: string): TenantStateEvent[] {
    return this.buffers.get(tenantId) ?? [];
  }

  /** Pure decision: what should be replayed for a client at `afterSeq`? */
  planReplay(tenantId: string, afterSeq: number): ReplayPlan {
    if (!Number.isFinite(afterSeq) || afterSeq <= 0) {
      return { events: [], gap: false };
    }
    const buf = this.get(tenantId);
    if (buf.length === 0) {
      // Nothing buffered on this instance → cannot prove continuity.
      return { events: [], gap: true };
    }
    const oldest = buf[0].seq;
    if (oldest > afterSeq + 1) {
      // Buffer starts AFTER what the client already has → the events in
      // (afterSeq, oldest) are unrecoverable here → gap.
      return { events: [], gap: true };
    }
    return { events: buf.filter((e) => e.seq > afterSeq), gap: false };
  }

  clear(): void {
    this.buffers.clear();
  }
}
