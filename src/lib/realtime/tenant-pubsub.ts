/**
 * Tenant Pub/Sub — public entry point
 * ============================================================================
 *
 * This file re-exports the Redis-backed pub/sub from redis-pubsub.ts.
 *
 * ARCHITECTURE
 * ------------
 * Single source of truth: PostgreSQL (via Prisma).
 * Transport: Redis pub/sub (multi-instance) OR in-memory EventEmitter (dev).
 *
 * See redis-pubsub.ts for the full architecture diagram and rationale.
 *
 * WHY A RE-EXPORT FILE?
 * ---------------------
 * Existing consumers (the SSE endpoint, tests) import from
 * '@/lib/realtime/tenant-pubsub'. Keeping this file as a re-export means
 * the Redis migration is non-breaking — no consumer needs to change its
 * import path.
 */

export {
  publishTenantEvent,
  subscribeTenantEvents,
  subscribeAllTenantEvents,
  getSubscriberCount,
  getActiveTransport,
  __resetForTests,
  type TenantStateEvent,
} from './redis-pubsub';
