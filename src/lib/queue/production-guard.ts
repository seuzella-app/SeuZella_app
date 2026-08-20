import { logger } from '@/lib/logger';

/** Production must never silently fall back to an in-process queue. */
export function assertProductionQueueConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    logger.error('[DELIVERY_QUEUE] CRITICAL: persistent Redis configuration missing in production');
    throw new Error('QUEUE_NOT_CONFIGURED_FOR_PRODUCTION');
  }
}

export function isPersistentQueueConfigured(): boolean {
  return Boolean(
    (process.env.REDIS_URL && (process.env.REDIS_TOKEN || process.env.REDIS_PASSWORD)) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}
