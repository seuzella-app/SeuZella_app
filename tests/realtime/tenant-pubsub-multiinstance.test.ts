/**
 * F28-E — Multi-instance realtime pub/sub contract (simulated 2 instances)
 * ============================================================================
 * Uses a shared FakeRedis bus to simulate a REAL Redis server between two
 * freshly-loaded copies of the pub/sub module (= two Vercel instances).
 *
 * Proves:
 *  1. publish on instance A reaches subscribers on instance B (cross-instance)
 *  2. the seq is GLOBAL (Redis INCR) — same value observed on A and B
 *  3. NO double-delivery on the publishing instance (watermark dedup)
 *  4. tenant isolation: tenant-x events never reach tenant-y subscribers
 *  5. without Redis: memory fallback works with in-process seq
 *
 * F28-v2 ROBUSTNESS: waits are DETERMINISTIC — waitFor() polls a predicate
 * with a hard deadline instead of a blind sleep, so the contract holds under
 * heavy machine load (CI, macOS dev box running the full 326-file suite).
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantStateEvent } from '@/lib/realtime/tenant-pubsub';

// ── Fake Redis bus (behaves like a real server: delivers to ALL subscribers,
//    including those on the publishing instance) ─────────────────────────────
class FakeHub {
  private subs = new Map<string, Set<FakeRedis>>();
  private counters = new Map<string, number>();
  addSubscriber(channel: string, client: FakeRedis): void {
    const set = this.subs.get(channel) ?? new Set<FakeRedis>();
    set.add(client);
    this.subs.set(channel, set);
  }
  deliver(channel: string, message: string): void {
    for (const client of this.subs.get(channel) ?? []) client.receive(channel, message);
  }
  incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return Promise.resolve(next);
  }
}

class FakeRedis {
  private handlers = new Map<string, (...args: unknown[]) => void>();
  constructor(private hub: FakeHub, private label: string) {}
  on(evt: string, fn: (...args: unknown[]) => void): this {
    this.handlers.set(evt, fn);
    return this;
  }
  duplicate(): FakeRedis {
    return new FakeRedis(this.hub, `${this.label}:dup`);
  }
  async subscribe(channel: string): Promise<void> {
    this.hub.addSubscriber(channel, this);
  }
  async publish(channel: string, message: string): Promise<void> {
    this.hub.deliver(channel, message);
  }
  async incr(key: string): Promise<number> {
    return this.hub.incr(key);
  }
  receive(channel: string, message: string): void {
    this.handlers.get('message')?.(channel, message);
  }
}

const hub = new FakeHub();
let fakeConn: FakeRedis | null = null;

vi.mock('@/lib/queue/bullmq-queue', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRedisConnection: (): any => fakeConn,
}));

const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic wait: polls `cond()` every stepMs until truthy or deadline.
 * Replaces blind sleeps so the test never fails merely because the machine
 * is slow — and never waits longer than the deadline (test timeout safety).
 */
async function waitFor(cond: () => boolean, what: string, timeoutMs = 3000, stepMs = 10): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) {
      throw new Error(`waitFor(${what}): condition not met within ${timeoutMs}ms`);
    }
    await settle(stepMs);
  }
}

async function loadFreshInstance(): Promise<typeof import('@/lib/realtime/redis-pubsub')> {
  vi.resetModules();
  return import('@/lib/realtime/redis-pubsub');
}

beforeEach(() => {
  hub['subs'].clear();
  hub['counters'].clear();
  fakeConn = null;
});

describe('F28-E · multi-instance (Redis transport, 2 simulated instances)', () => {
  it('publish on A reaches B with the SAME global seq — and A is not double-delivered', async () => {
    fakeConn = new FakeRedis(hub, 'shared');
    const A = await loadFreshInstance();
    const B = await loadFreshInstance();

    const gotA: TenantStateEvent[] = [];
    const gotB: TenantStateEvent[] = [];
    A.subscribeTenantEvents('tenant-x', (e) => gotA.push(e));
    B.subscribeTenantEvents('tenant-x', (e) => gotB.push(e));

    A.publishTenantEvent('tenant-x', 'pin:created', { pin: '123456' });

    // Deterministic: wait until BOTH instances observed the event.
    await waitFor(() => gotA.length >= 1 && gotB.length >= 1, 'delivery on A and B');
    // Short settle: give any (buggy) duplicate delivery time to show up
    // before asserting the dedup watermark contract.
    await settle(50);

    expect(gotA).toHaveLength(1); // dedup: publish-echo must not double-deliver
    expect(gotB).toHaveLength(1); // cross-instance delivery
    expect(gotB[0].seq).toBe(gotA[0].seq); // GLOBAL seq (Redis INCR)
    expect(gotA[0].seq).toBe(1);
    expect(gotB[0].type).toBe('pin:created');
    expect(gotB[0].payload).toEqual({ pin: '123456' });
  });

  it('two publishes → strictly increasing global seq observed on both instances', async () => {
    fakeConn = new FakeRedis(hub, 'shared');
    const A = await loadFreshInstance();
    const B = await loadFreshInstance();

    const gotB: TenantStateEvent[] = [];
    B.subscribeTenantEvents('tenant-y', (e) => gotB.push(e));

    A.publishTenantEvent('tenant-y', 'room:updated', { room: 1 });
    await waitFor(() => gotB.length >= 1, 'first delivery on B');
    A.publishTenantEvent('tenant-y', 'room:updated', { room: 2 });
    await waitFor(() => gotB.length >= 2, 'second delivery on B');
    await settle(50);

    expect(gotB).toHaveLength(2);
    expect(gotB[0].seq).toBe(1);
    expect(gotB[1].seq).toBe(2);
  });

  it('tenant isolation: tenant-x events NEVER reach tenant-y subscribers', async () => {
    fakeConn = new FakeRedis(hub, 'shared');
    const A = await loadFreshInstance();
    const B = await loadFreshInstance();

    const gotY: TenantStateEvent[] = [];
    let canaryXCount = 0;
    B.subscribeTenantEvents('tenant-y', (e) => gotY.push(e));
    // Canary on the PUBLISHED channel proves the pipeline actually ran —
    // so "gotY stayed empty" is an active proof, not a timing guess.
    A.subscribeTenantEvents('tenant-x', () => {
      canaryXCount += 1;
    });

    A.publishTenantEvent('tenant-x', 'guest:updated', { secret: 'x-data' });
    A.publishTenantEvent('tenant-x', 'pin:created', { pin: 'x-pin' });

    await waitFor(() => canaryXCount >= 2, 'canary received both tenant-x events');
    await settle(50);

    expect(gotY).toHaveLength(0);
  });
});

describe('F28-E · without Redis → memory fallback (dev/test only)', () => {
  it('transport is memory and in-process delivery works with local seq', async () => {
    fakeConn = null;
    const M = await loadFreshInstance();

    expect(M.getActiveTransport()).toBe('memory');

    const got: TenantStateEvent[] = [];
    M.subscribeTenantEvents('tenant-dev', (e) => got.push(e));
    M.publishTenantEvent('tenant-dev', 'reservation:created', { id: 'r1' });

    await waitFor(() => got.length >= 1, 'memory delivery');
    await settle(50);

    expect(got).toHaveLength(1);
    expect(got[0].seq).toBe(1);
  });

  it('publish without tenantId is ignored (no crash, no event)', async () => {
    fakeConn = null;
    const M = await loadFreshInstance();
    const got: TenantStateEvent[] = [];
    M.subscribeTenantEvents('tenant-z', (e) => got.push(e));
    M.publishTenantEvent('', 'room:updated', {});
    await settle(100); // absence cannot be proven — sample a generous window
    expect(got).toHaveLength(0);
  });
});
