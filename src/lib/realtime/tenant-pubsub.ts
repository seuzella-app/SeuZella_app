/**
 * Tenant State Pub/Sub — in-memory channel per tenantId
 * ============================================================================
 *
 * ARCHITECTURE
 * ------------
 * Single source of truth: PostgreSQL (via Prisma).
 * When a tenant mutation happens (PIN created, room updated, reservation
 * changed), the API route handler:
 *   1. Writes the change to PostgreSQL
 *   2. Calls publishTenantEvent(tenantId, eventType, payload)
 *
 * The publish function notifies all in-process subscribers via a simple
 * EventEmitter keyed by tenantId. Subscribers are SSE connections opened
 * by Desktop DDC and Mobile DDC clients.
 *
 * WHY IN-MEMORY (FOR NOW)
 * -----------------------
 * Vercel serverless functions are single-instance per request, so in-memory
 * pub/sub does NOT sync across multiple warm instances. For full multi-
 * instance sync, replace the EventEmitter with Redis pub/sub:
 *
 *   import { createClient } from 'redis';
 *   const pub = createClient({ url: process.env.REDIS_URL });
 *   const sub = pub.duplicate();
 *   await pub.connect();
 *   await sub.connect();
 *   sub.subscribe(`tenant:${tenantId}`, (msg) => cb(JSON.parse(msg)));
 *   pub.publish(`tenant:${tenantId}`, JSON.stringify({ eventType, payload }));
 *
 * The EventEmitter interface below is designed so the swap is mechanical.
 *
 * MULTI-INSTANCE NOTE
 * -------------------
 * On Vercel, each warm serverless instance has its own EventEmitter.
 * Two clients connected to different instances will NOT see each other's
 * events. This is acceptable for v1 (single-instance is the common case
 * for low-traffic pousadas). For production scale, swap to Redis.
 *
 * SECURITY
 * --------
 * - Channel key is `tenant:${tenantId}` — never accept tenantId from the
 *   client without verifying it matches the authenticated session.
 * - Event payloads are NOT encrypted. They contain operational data
 *   (room numbers, PIN metadata without the PIN itself). NEVER publish
 *   raw PINs, passwords, or PII via this channel.
 * - The SSE endpoint re-validates the session on every connection.
 */

import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(1000); // each SSE connection = 1 listener

export interface TenantStateEvent {
  type:
    | 'pin:created'
    | 'pin:revoked'
    | 'pin:updated'
    | 'room:updated'
    | 'reservation:created'
    | 'reservation:updated'
    | 'reservation:cancelled'
    | 'guest:updated'
    | 'lock:status_changed'
    | 'tenant:metadata_updated';
  tenantId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  /** Monotonic sequence number per tenant — used by clients to detect gaps. */
  seq: number;
}

const seqCounters = new Map<string, number>();

function nextSeq(tenantId: string): number {
  const current = seqCounters.get(tenantId) ?? 0;
  const next = current + 1;
  seqCounters.set(tenantId, next);
  return next;
}

function channelName(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/**
 * Publish a tenant state event. Called by API route handlers AFTER the
 * PostgreSQL write succeeds. The event is broadcast to all in-process
 * subscribers (SSE connections for the same tenantId).
 *
 * Idempotent: if no subscribers are listening, the event is silently
 * dropped (no error). The PostgreSQL write is the source of truth —
 * clients can reconcile by re-fetching state on reconnect.
 */
export function publishTenantEvent(
  tenantId: string,
  type: TenantStateEvent['type'],
  payload: Record<string, unknown>,
): void {
  if (!tenantId) {
    console.warn('[TenantPubSub] publishTenantEvent called without tenantId — ignoring');
    return;
  }

  const event: TenantStateEvent = {
    type,
    tenantId,
    payload,
    timestamp: new Date().toISOString(),
    seq: nextSeq(tenantId),
  };

  emitter.emit(channelName(tenantId), event);
  emitter.emit('tenant:any', event);
}

/**
 * Subscribe to tenant state events for a specific tenantId.
 * Returns an unsubscribe function.
 *
 * Used by the SSE endpoint to forward events to the client.
 */
export function subscribeTenantEvents(
  tenantId: string,
  listener: (event: TenantStateEvent) => void,
): () => void {
  const channel = channelName(tenantId);
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
}

/**
 * Subscribe to ALL tenant events (across all tenants). Used for audit,
 * debugging, and the ZCC admin "live activity" feed.
 *
 * SECURITY: This bypasses tenant isolation — only call from authenticated
 * admin (system_admin) contexts.
 */
export function subscribeAllTenantEvents(
  listener: (event: TenantStateEvent) => void,
): () => void {
  emitter.on('tenant:any', listener);
  return () => {
    emitter.off('tenant:any', listener);
  };
}

/**
 * Returns the count of active subscribers for a given tenant.
 * Useful for telemetry and for the "are there any clients listening?"
 * short-circuit (no point in publishing if no one is listening).
 */
export function getSubscriberCount(tenantId: string): number {
  return emitter.listenerCount(channelName(tenantId));
}

/**
 * Reset all subscribers and seq counters. Test-only — never call in prod.
 */
export function __resetForTests(): void {
  emitter.removeAllListeners();
  seqCounters.clear();
}
