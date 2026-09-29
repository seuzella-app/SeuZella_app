/**
 * Redis-backed Pub/Sub for cross-instance tenant state events
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous tenant-pubsub.ts used an in-memory EventEmitter — fine for a
 * single Vercel serverless instance, but BROKEN for multi-instance: events
 * published on instance A are invisible to subscribers on instance B.
 *
 * Vercel serverless spins up multiple warm instances for concurrent requests.
 * If Desktop DDC is connected to instance A and Mobile DDC to instance B,
 * in-memory pub/sub silently drops events between them.
 *
 * SOLUTION
 * --------
 * Use the same Redis instance already powering BullMQ (single infra, no new
 * service to provision). Each tenant has a Redis channel `tenant:${tenantId}`.
 *
 * Architecture:
 *
 *                   PostgreSQL (source of truth)
 *                            │
 *                     mutation + publish
 *                            │
 *                         Redis
 *                            │
 *              ┌─────────────┴─────────────┐
 *              ↓                           ↓
 *       Vercel Instance A           Vercel Instance B
 *              ↓                           ↓
 *           SSE                          SSE
 *              ↓                           ↓
 *          Desktop                      Mobile
 *
 * FALLBACK
 * --------
 * When Redis is unavailable (dev/test without REDIS_URL), the pub/sub
 * transparently falls back to in-memory EventEmitter. This keeps the dev
 * loop fast and lets tests run without a Redis dependency.
 *
 * SECURITY
 * --------
 * Channel name is `tenant:${tenantId}` — clients cannot subscribe to other
 * tenants' channels because the SSE endpoint resolves tenantId from the
 * NextAuth session, NOT from the request body.
 *
 * Subscribers are server-side only (SSE endpoint). The Redis channel is
 * never exposed to the client.
 */

import { EventEmitter } from 'node:events';
import { getRedisConnection } from '@/lib/queue/bullmq-queue';
import { logger } from '@/lib/logger';

// ── Public interface (must match the previous tenant-pubsub.ts) ────────────
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

type TenantEventListener = (event: TenantStateEvent) => void;

// ── In-memory fallback (used when Redis is unavailable) ────────────────────
const fallbackEmitter = new EventEmitter();
fallbackEmitter.setMaxListeners(1000);
const seqCounters = new Map<string, number>();

// ── Redis subscriber (one per process, lazy-initialized) ───────────────────
let redisSubscriber: ReturnType<typeof getRedisConnection> | null = null;
let redisPublisher: ReturnType<typeof getRedisConnection> | null = null;
let redisSubInitialized = false;

// In-process listeners that wrap Redis subscriptions.
// When Redis delivers a message, we dispatch via this emitter so the existing
// subscribeTenantEvents API doesn't change.
const dispatchEmitter = new EventEmitter();
dispatchEmitter.setMaxListeners(1000);

// Track which channels we've already SUBSCRIBEd to in Redis (avoid duplicate
// subscriptions when multiple SSE connections listen to the same tenant).
const subscribedChannels = new Set<string>();

// F28-E dedup watermark (per tenant, monotonic global seq): the publishing
// instance delivers locally at publish time; the Redis echo of its own message
// must not double-deliver to the same in-process listeners.
const dispatchWatermarks = new Map<string, number>();

function channelName(tenantId: string): string {
  return `tenant:${tenantId}`;
}

function nextSeq(tenantId: string): number {
  const current = seqCounters.get(tenantId) ?? 0;
  const next = current + 1;
  seqCounters.set(tenantId, next);
  return next;
}

function isRedisAvailable(): boolean {
  return getRedisConnection() !== null;
}

/**
 * Initialize the Redis subscriber connection. Idempotent.
 * Falls back silently to in-memory if Redis is unavailable.
 */
function ensureRedisSubscriber(): void {
  if (redisSubInitialized) return;
  redisSubInitialized = true;

  // BullMQ's getRedisConnection returns a shared connection. For subscribing
  // we need a separate connection because once a connection enters subscriber
  // mode it can no longer issue regular commands. We duplicate the shared
  // connection so the publisher connection isn't blocked.
  try {
    const conn = getRedisConnection();
    if (!conn) return;

    // ioredis allows subscribe on the same connection, but it's a best practice
    // to use a duplicate for subscriptions so the publisher connection isn't
    // blocked. We duplicate the shared connection.
    redisSubscriber = conn.duplicate();
    redisSubscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message) as TenantStateEvent;
        // F28-E dedup: skip the echo of an event this instance already
        // delivered locally (same monotonic global seq watermark).
        const watermark = dispatchWatermarks.get(event.tenantId) ?? 0;
        if (event.seq > 0 && event.seq <= watermark) return;
        if (event.seq > 0) dispatchWatermarks.set(event.tenantId, event.seq);
        // Dispatch to in-process listeners (SSE connections).
        dispatchEmitter.emit(channel, event);
        // Also dispatch on the global audit channel.
        dispatchEmitter.emit('tenant:any', event);
      } catch (err) {
        logger.error('[RedisPubSub] Failed to parse message', {
          channel,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    });
    redisSubscriber.on('error', (err) => {
      logger.error('[RedisPubSub] Subscriber error', { error: err.message });
    });

    // Publisher reuses the shared connection (no need to duplicate).
    redisPublisher = conn;

    logger.info('[RedisPubSub] Subscriber initialized — multi-instance sync active');
  } catch (err) {
    logger.warn('[RedisPubSub] Failed to initialize Redis subscriber, using in-memory fallback', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    redisSubscriber = null;
    redisPublisher = null;
  }
}

function dispatchLocal(channel: string, event: TenantStateEvent): void {
  const watermark = dispatchWatermarks.get(event.tenantId) ?? 0;
  if (event.seq > 0 && event.seq <= watermark) return;
  if (event.seq > 0) dispatchWatermarks.set(event.tenantId, event.seq);
  dispatchEmitter.emit(channel, event);
  dispatchEmitter.emit('tenant:any', event);
}

/**
 * Publish a tenant state event. Called by API route handlers AFTER the
 * PostgreSQL write succeeds.
 *
 * - If Redis is available: assigns a GLOBAL per-tenant sequence via Redis
 *   INCR (F28-E — seq values are comparable across instances, enabling real
 *   client gap detection) and publishes to `tenant:${tenantId}`. All Vercel
 *   instances with subscribers on that channel receive the event.
 * - If Redis is unavailable (dev/test): falls back to in-memory EventEmitter
 *   with an in-process sequence.
 *
 * Delivery to in-process subscribers happens once the global seq is known
 * (microtask) so local and remote subscribers observe the SAME seq value.
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

  const base = {
    type,
    tenantId,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (isRedisAvailable()) {
    ensureRedisSubscriber();
    const channel = channelName(tenantId);
    try {
      void Promise.resolve()
        .then(async () => {
          const seq = Number((await redisPublisher?.incr(`tenant:seq:${tenantId}`)) ?? 0);
          const event: TenantStateEvent = { ...base, seq };
          try {
            await redisPublisher?.publish(channel, JSON.stringify(event));
          } catch (err) {
            logger.error('[RedisPubSub] publish() failed — delivering locally only', {
              channel,
              error: err instanceof Error ? err.message : 'unknown',
            });
          }
          dispatchLocal(channel, event);
        })
        .catch((err) => {
          logger.error('[RedisPubSub] publish pipeline failed — local fallback', {
            error: err instanceof Error ? err.message : 'unknown',
          });
          dispatchLocal(channel, { ...base, seq: nextSeq(tenantId) });
        });
      return;
    } catch (err) {
      logger.error('[RedisPubSub] publish threw, falling back to in-memory', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // In-memory fallback (dev/test or Redis failure).
  // Use ONLY the dispatchEmitter for delivery — SSE connections listen on
  // dispatchEmitter regardless of transport. Emitting on fallbackEmitter
  // too would cause double-delivery when subscribers are on dispatchEmitter.
  const event: TenantStateEvent = { ...base, seq: nextSeq(tenantId) };
  dispatchLocal(channelName(tenantId), event);
}

/**
 * Subscribe to tenant state events for a specific tenantId.
 * Returns an unsubscribe function.
 *
 * - If Redis is available: subscribes to `tenant:${tenantId}` channel
 *   (idempotent — multiple subscribers on the same instance share one
 *   Redis subscription).
 * - If Redis is unavailable: subscribes via in-memory EventEmitter.
 */
export function subscribeTenantEvents(
  tenantId: string,
  listener: TenantEventListener,
): () => void {
  const channel = channelName(tenantId);

  if (isRedisAvailable()) {
    ensureRedisSubscriber();

    // Subscribe to Redis channel if not already (idempotent).
    if (!subscribedChannels.has(channel) && redisSubscriber) {
      try {
        void redisSubscriber.subscribe(channel).catch((err) => {
          logger.warn('[RedisPubSub] subscribe() failed, using in-memory only', {
            channel,
            error: err instanceof Error ? err.message : 'unknown',
          });
        });
        subscribedChannels.add(channel);
      } catch (err) {
        logger.warn('[RedisPubSub] subscribe threw, using in-memory only', {
          channel,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    // Always register the in-process listener on dispatchEmitter —
    // publishTenantEvent dispatches via dispatchEmitter regardless of
    // transport (Redis or in-memory fallback).
    dispatchEmitter.on(channel, listener);
    return () => {
      dispatchEmitter.off(channel, listener);
      // Note: we do NOT unsubscribe from Redis here because other listeners
      // on this instance may still be subscribed. Redis SUBSCRIBE is refcounted
      // at the dispatchEmitter level via .on()/.off().
    };
  }

  // In-memory fallback — only dispatchEmitter is used (publishTenantEvent
  // emits only on dispatchEmitter in this path).
  dispatchEmitter.on(channel, listener);
  return () => {
    dispatchEmitter.off(channel, listener);
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
  listener: TenantEventListener,
): () => void {
  // 'tenant:any' is the global audit channel on dispatchEmitter.
  // publishTenantEvent dispatches via dispatchEmitter only — registering on
  // fallbackEmitter too would cause double-delivery.
  dispatchEmitter.on('tenant:any', listener);
  return () => {
    dispatchEmitter.off('tenant:any', listener);
  };
}

/**
 * Returns the count of active in-process subscribers for a given tenant.
 * Does NOT count subscribers on other Vercel instances.
 */
export function getSubscriberCount(tenantId: string): number {
  const channel = channelName(tenantId);
  return dispatchEmitter.listenerCount(channel);
}

/**
 * Returns the active transport mode for telemetry/debugging.
 * - 'redis' — multi-instance sync active
 * - 'memory' — single-instance fallback (dev/test)
 */
export function getActiveTransport(): 'redis' | 'memory' {
  return isRedisAvailable() && redisSubscriber ? 'redis' : 'memory';
}

/**
 * Reset all subscribers and seq counters. Test-only — never call in prod.
 */
export function __resetForTests(): void {
  fallbackEmitter.removeAllListeners();
  dispatchEmitter.removeAllListeners();
  seqCounters.clear();
  subscribedChannels.clear();
  dispatchWatermarks.clear();
  // Don't close the Redis connection — it's shared with BullMQ and may be
  // used by other tests. Just reset the in-process state.
  redisSubInitialized = false;
}
