/**
 * Distributed rate limiter.
 * Production is fail-closed: Redis/Upstash must be available for enforcement.
 * Development/test may use the bounded in-memory implementation.
 */

import { hasUpstashRestCredentials } from '@/lib/infra/redis-config';

let Ratelimit: any = null;
let Redis: any = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require for optional peer dep; runtime guarded by try/catch
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require for optional peer dep; runtime guarded by try/catch
  Ratelimit = require('@upstash/ratelimit').Ratelimit;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require for optional peer dep; runtime guarded by try/catch
  Redis = require('@upstash/redis').Redis;
} catch {
  // Optional in development; production fails closed below.
}

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REDIS_CONFIGURED = Boolean(hasUpstashRestCredentials() && Ratelimit && Redis);

let redisClient: any = null;
const ratelimiters: Record<string, any> = {};

function getRedis(): any | null {
  if (!IS_PRODUCTION || !REDIS_CONFIGURED) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
    return redisClient;
  } catch {
    return null;
  }
}

interface InMemoryBucket { count: number; resetAt: number; }
const inMemoryBuckets = new Map<string, InMemoryBucket>();

function inMemoryLimit(identifier: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  let bucket = inMemoryBuckets.get(identifier);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    inMemoryBuckets.set(identifier, bucket);
  }
  bucket.count += 1;
  return { success: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), reset: bucket.resetAt };
}

type LimitConfig = { limit: number; windowSeconds: number };
const LIMIT_CONFIGS: Record<string, LimitConfig> = {
  'auth-login': { limit: 5, windowSeconds: 60 },
  'auth-signup': { limit: 3, windowSeconds: 60 },
  'api-general': { limit: 100, windowSeconds: 60 },
  'api-write': { limit: 30, windowSeconds: 60 },
  'whatsapp-webhook': { limit: 1000, windowSeconds: 60 },
  'payment-gateway-webhook': { limit: 100, windowSeconds: 60 },
  'mercadopago-webhook': { limit: 100, windowSeconds: 60 },
  'public-form': { limit: 10, windowSeconds: 60 },
  'password-reset': { limit: 3, windowSeconds: 3600 },
};

function getRatelimiter(name: string): any | null {
  if (!IS_PRODUCTION || !REDIS_CONFIGURED) return null;
  if (ratelimiters[name]) return ratelimiters[name];
  const redis = getRedis();
  const config = LIMIT_CONFIGS[name];
  if (!redis || !config) return null;
  ratelimiters[name] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    prefix: `ratelimit:${name}`,
    analytics: true,
  });
  return ratelimiters[name];
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  provider: 'redis' | 'memory' | 'fail-closed';
}

export async function checkRateLimit(name: string, identifier: string): Promise<RateLimitResult> {
  const config = LIMIT_CONFIGS[name];
  if (!config) return { success: false, limit: 0, remaining: 0, reset: 0, provider: 'fail-closed' };

  if (IS_PRODUCTION) {
    const limiter = getRatelimiter(name);
    if (!limiter) {
      return { success: false, limit: config.limit, remaining: 0, reset: Date.now() + 60_000, provider: 'fail-closed' };
    }
    try {
      const result = await limiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: typeof result.reset === 'number' ? result.reset : Date.now() + config.windowSeconds * 1000,
        provider: 'redis',
      };
    } catch {
      return { success: false, limit: config.limit, remaining: 0, reset: Date.now() + 60_000, provider: 'fail-closed' };
    }
  }

  const result = inMemoryLimit(identifier, config.limit, config.windowSeconds);
  return { success: result.success, limit: config.limit, remaining: result.remaining, reset: result.reset, provider: 'memory' };
}

export async function enforceRateLimit(name: string, identifier: string): Promise<RateLimitResult> {
  return checkRateLimit(name, identifier);
}

export function buildIdentifier(ip?: string | null, tenantId?: string | null): string {
  return tenantId ? `t:${tenantId}:${ip || 'unknown'}` : `ip:${ip || 'unknown'}`;
}
