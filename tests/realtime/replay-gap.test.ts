/**
 * F28-E — Replay planner (Last-Event-ID resume + gap detection) contract
 * ============================================================================
 * Pure logic extracted from the SSE route. Proves:
 *  - continuous buffer → replay exactly the events after afterSeq
 *  - empty buffer after a real seq → gap (snapshot resync required)
 *  - buffer starting after afterSeq+1 → gap (events unrecoverable here)
 *  - buffer trimming at MAX_REPLAY_BUFFER_PER_TENANT
 *  - cross-instance scenario: client resyncs when landing on an instance
 *    whose buffer never saw the other instance's events
 * ============================================================================
 */

import { describe, expect, it } from 'vitest';
import { TenantReplayBuffer, MAX_REPLAY_BUFFER_PER_TENANT } from '@/lib/realtime/replay';
import type { TenantStateEvent } from '@/lib/realtime/redis-pubsub';

const ev = (seq: number, type: TenantStateEvent['type'] = 'pin:created'): TenantStateEvent => ({
  seq,
  type,
  tenantId: 't1',
  payload: { seq },
  timestamp: new Date().toISOString(),
});

describe('replay planner — continuous windows', () => {
  it('afterSeq=0 (fresh client) → nothing to replay, no gap', () => {
    const buf = new TenantReplayBuffer();
    [1, 2, 3].forEach((s) => buf.bufferEvent('t1', ev(s)));
    const plan = buf.planReplay('t1', 0);
    expect(plan).toEqual({ events: [], gap: false });
  });

  it('client at seq 1 with buffer 1..3 → replays 2,3', () => {
    const buf = new TenantReplayBuffer();
    [1, 2, 3].forEach((s) => buf.bufferEvent('t1', ev(s)));
    const plan = buf.planReplay('t1', 1);
    expect(plan.gap).toBe(false);
    expect(plan.events.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('client caught up (afterSeq = last) → empty replay, no gap', () => {
    const buf = new TenantReplayBuffer();
    [1, 2, 3].forEach((s) => buf.bufferEvent('t1', ev(s)));
    const plan = buf.planReplay('t1', 3);
    expect(plan.gap).toBe(false);
    expect(plan.events).toEqual([]);
  });

  it('only the requested tenant is touched', () => {
    const buf = new TenantReplayBuffer();
    buf.bufferEvent('t2', ev(1));
    expect(buf.planReplay('t1', 0).gap).toBe(false);
    expect(buf.planReplay('t1', 5).gap).toBe(true); // t1 has no buffer at all
  });
});

describe('replay planner — gap detection (F28-E core)', () => {
  it('real seq known but buffer empty (event lost/other instance) → gap', () => {
    const buf = new TenantReplayBuffer();
    const plan = buf.planReplay('t1', 42);
    expect(plan.gap).toBe(true);
    expect(plan.events).toEqual([]);
  });

  it('buffer starts after afterSeq+1 → gap (client would silently skip)', () => {
    const buf = new TenantReplayBuffer();
    [50, 51, 52].forEach((s) => buf.bufferEvent('t1', ev(s)));
    const plan = buf.planReplay('t1', 10);
    expect(plan.gap).toBe(true); // 11..49 unrecoverable here
    expect(plan.events).toEqual([]);
  });

  it('cross-instance: client moves A → B where B saw nothing → snapshot resync', () => {
    const instanceA = new TenantReplayBuffer();
    const instanceB = new TenantReplayBuffer();
    [1, 2, 3].forEach((s) => instanceA.bufferEvent('t1', ev(s))); // A published
    // client reconnects to B carrying Last-Event-ID 3 → B has no buffer:
    const plan = instanceB.planReplay('t1', 3);
    expect(plan.gap).toBe(true); // B answers with a fresh snapshot instead
  });

  it('NaN/negative afterSeq is treated as a fresh client', () => {
    const buf = new TenantReplayBuffer();
    expect(buf.planReplay('t1', Number.NaN)).toEqual({ events: [], gap: false });
    expect(buf.planReplay('t1', -5)).toEqual({ events: [], gap: false });
  });
});

describe('replay buffer — trimming', () => {
  it('keeps at most MAX_REPLAY_BUFFER_PER_TENANT events (oldest dropped)', () => {
    const buf = new TenantReplayBuffer();
    for (let s = 1; s <= MAX_REPLAY_BUFFER_PER_TENANT + 25; s++) {
      buf.bufferEvent('t1', ev(s));
    }
    const all = buf.get('t1');
    expect(all).toHaveLength(MAX_REPLAY_BUFFER_PER_TENANT);
    expect(all[0].seq).toBe(26); // 1..25 trimmed away
    expect(all[all.length - 1].seq).toBe(MAX_REPLAY_BUFFER_PER_TENANT + 25);
    // Buffer holds seqs 26..125. A client at 25 expects 26 next — present,
    // so continuity IS provable from 25 (events 26.. replayed):
    expect(buf.planReplay('t1', 25).gap).toBe(false);
    // A client at 24 expects 25 next — trimmed away → gap:
    expect(buf.planReplay('t1', 24).gap).toBe(true);
    expect(buf.planReplay('t1', 26).gap).toBe(false);
  });
});
