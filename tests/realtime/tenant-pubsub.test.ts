import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  publishTenantEvent,
  subscribeTenantEvents,
  subscribeAllTenantEvents,
  getSubscriberCount,
  __resetForTests,
  type TenantStateEvent,
} from '@/lib/realtime/tenant-pubsub';

describe('Tenant Pub/Sub — per-tenant event channel', () => {
  beforeEach(() => {
    __resetForTests();
  });

  it('publishes events only to subscribers of the same tenantId', () => {
    const tenantAListener = vi.fn();
    const tenantBListener = vi.fn();

    const unsubA = subscribeTenantEvents('tenant_a', tenantAListener);
    const unsubB = subscribeTenantEvents('tenant_b', tenantBListener);

    publishTenantEvent('tenant_a', 'pin:created', { deviceId: 'dev_1' });

    expect(tenantAListener).toHaveBeenCalledTimes(1);
    expect(tenantBListener).not.toHaveBeenCalled();

    unsubA();
    unsubB();
  });

  it('delivers events with monotonic per-tenant seq numbers', () => {
    const listener = vi.fn();
    const unsub = subscribeTenantEvents('tenant_seq', listener);

    publishTenantEvent('tenant_seq', 'pin:created', { id: 1 });
    publishTenantEvent('tenant_seq', 'pin:revoked', { id: 2 });
    publishTenantEvent('tenant_seq', 'room:updated', { id: 3 });

    expect(listener).toHaveBeenCalledTimes(3);
    const events = listener.mock.calls.map((call) => call[0] as TenantStateEvent);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
    expect(events[2].seq).toBe(3);
    expect(events[0].type).toBe('pin:created');
    expect(events[2].type).toBe('room:updated');

    unsub();
  });

  it('isolates seq counters per tenant (tenant A seq does not affect tenant B)', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = subscribeTenantEvents('tenant_iso_a', listenerA);
    const unsubB = subscribeTenantEvents('tenant_iso_b', listenerB);

    publishTenantEvent('tenant_iso_a', 'pin:created', {});
    publishTenantEvent('tenant_iso_a', 'pin:revoked', {});
    publishTenantEvent('tenant_iso_b', 'pin:created', {});

    const eventA2 = listenerA.mock.calls[1][0] as TenantStateEvent;
    const eventB1 = listenerB.mock.calls[0][0] as TenantStateEvent;

    expect(eventA2.seq).toBe(2);
    expect(eventB1.seq).toBe(1);

    unsubA();
    unsubB();
  });

  it('includes ISO timestamp in every event', () => {
    const listener = vi.fn();
    const unsub = subscribeTenantEvents('tenant_ts', listener);

    publishTenantEvent('tenant_ts', 'pin:created', {});

    const event = listener.mock.calls[0][0] as TenantStateEvent;
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(event.timestamp).getTime()).not.toBeNaN();

    unsub();
  });

  it('subscribeAllTenantEvents receives events from ALL tenants', () => {
    const auditListener = vi.fn();
    const unsub = subscribeAllTenantEvents(auditListener);

    publishTenantEvent('tenant_x', 'pin:created', {});
    publishTenantEvent('tenant_y', 'pin:revoked', {});

    expect(auditListener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('unsubscribe stops further events from reaching the listener', () => {
    const listener = vi.fn();
    const unsub = subscribeTenantEvents('tenant_unsub', listener);

    publishTenantEvent('tenant_unsub', 'pin:created', {});
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();

    publishTenantEvent('tenant_unsub', 'pin:revoked', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getSubscriberCount returns the correct count per tenant', () => {
    expect(getSubscriberCount('tenant_count')).toBe(0);

    const unsub1 = subscribeTenantEvents('tenant_count', () => {});
    expect(getSubscriberCount('tenant_count')).toBe(1);

    const unsub2 = subscribeTenantEvents('tenant_count', () => {});
    expect(getSubscriberCount('tenant_count')).toBe(2);

    unsub1();
    expect(getSubscriberCount('tenant_count')).toBe(1);

    unsub2();
    expect(getSubscriberCount('tenant_count')).toBe(0);
  });

  it('silently drops events when there are no subscribers (no error)', () => {
    expect(() => {
      publishTenantEvent('tenant_nolistener', 'pin:created', { test: true });
    }).not.toThrow();
  });

  it('ignores calls with empty tenantId (defensive)', () => {
    const listener = vi.fn();
    const unsub = subscribeAllTenantEvents(listener);

    publishTenantEvent('', 'pin:created', {});
    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it('supports many concurrent subscribers per tenant (100+)', () => {
    const listeners = Array.from({ length: 100 }, () => vi.fn());
    const unsubs = listeners.map((l) => subscribeTenantEvents('tenant_many', l));

    publishTenantEvent('tenant_many', 'pin:created', { broadcast: true });

    for (const l of listeners) {
      expect(l).toHaveBeenCalledTimes(1);
    }

    unsubs.forEach((u) => u());
  });
});

describe('Tenant Pub/Sub — security contracts', () => {
  beforeEach(() => {
    __resetForTests();
  });

  it('never delivers tenant A events to tenant B subscribers (isolation)', () => {
    const listenerA = vi.fn();
    const unsubA = subscribeTenantEvents('tenant_isolation_a', listenerA);

    publishTenantEvent('tenant_isolation_b', 'pin:created', { secret: 'should_not_leak' });

    expect(listenerA).not.toHaveBeenCalled();

    unsubA();
  });

  it('event payload is passed verbatim (no mutation, no deep clone)', () => {
    const listener = vi.fn();
    const unsub = subscribeTenantEvents('tenant_payload', listener);

    const payload = { deviceId: 'dev_1', guestName: 'Maria', valid: true };
    publishTenantEvent('tenant_payload', 'pin:created', payload);

    const event = listener.mock.calls[0][0] as TenantStateEvent;
    expect(event.payload).toEqual(payload);
    expect(event.payload).toBe(payload);

    payload.guestName = 'Joana';
    expect(event.payload.guestName).toBe('Joana');

    unsub();
  });
});
