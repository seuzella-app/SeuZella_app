// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * Redis Rate Limiter — distribuído com fallback in-memory
 * ============================================================================
 *
 * Para produção: configurar Upstash Redis (UPSTASH_REDIS_REST_URL).
 * Para desenvolvimento: usa in-memory Map (não recomendado para produção).
 *
 * Limite distribuído por IP + tenantId, evitando que atacante faça 100×
 * mais requisições (problema do Map em Vercel serverless multi-lambda).
 * ============================================================================
 */

// Dynamic imports — só carrega @upstash/* se disponível e configurado
let Ratelimit: any = null;
let Redis: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Ratelimit = require('@upstash/ratelimit').Ratelimit;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Redis = require('@upstash/redis').Redis;
} catch {
  // Pacotes não instalados — usa fallback in-memory
  console.warn('[RATE_LIMIT] @upstash/ratelimit e @upstash/redis não instalados — usando fallback in-memory');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' && UPSTASH_REDIS_REST_URL;

// ─────────────────────────────────────────────────────────────────────────────
// REDIS CLIENT (singleton)
// ─────────────────────────────────────────────────────────────────────────────
let redisClient: Redis | null = null;
let ratelimiters: Record<string, Ratelimit> = {};

function getRedis(): Redis | null {
  if (!IS_PRODUCTION) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  } catch (err) {
    console.error('[RATE_LIMIT] Redis init falhou, usando fallback in-memory:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK IN-MEMORY (apenas dev)
// ─────────────────────────────────────────────────────────────────────────────
interface InMemoryBucket {
  count: number;
  resetAt: number;
}

const inMemoryBuckets = new Map<string, InMemoryBucket>();

function inMemoryLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const key = `${identifier}`;
  let bucket = inMemoryBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    inMemoryBuckets.set(key, bucket);
  }

  bucket.count += 1;
  const success = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);

  return {
    success,
    remaining,
    reset: bucket.resetAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS POR CONTEXTO
// ─────────────────────────────────────────────────────────────────────────────
type LimitConfig = {
  limit: number;
  windowSeconds: number;
};

const LIMIT_CONFIGS: Record<string, LimitConfig> = {
  'auth-login': { limit: 5, windowSeconds: 60 },       // 5 login/min
  'auth-signup': { limit: 3, windowSeconds: 60 },      // 3 signup/min
  'api-general': { limit: 100, windowSeconds: 60 },    // 100 req/min
  'api-write': { limit: 30, windowSeconds: 60 },       // 30 writes/min
  'whatsapp-webhook': { limit: 1000, windowSeconds: 60 }, // 1000 webhooks/min (Meta)
  'stripe-webhook': { limit: 100, windowSeconds: 60 },
  'mercadopago-webhook': { limit: 100, windowSeconds: 60 },
  'public-form': { limit: 10, windowSeconds: 60 },    // 10 form/min (lead capture)
  'password-reset': { limit: 3, windowSeconds: 3600 }, // 3/hora
};

function getRatelimiter(name: string): Ratelimit | null {
  if (!IS_PRODUCTION) return null;
  if (ratelimiters[name]) return ratelimiters[name];

  const redis = getRedis();
  if (!redis) return null;

  const config = LIMIT_CONFIGS[name];
  if (!config) return null;

  ratelimiters[name] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    prefix: `ratelimit:${name}`,
    analytics: true,
  });

  return ratelimiters[name];
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;  // timestamp ms
  provider: 'redis' | 'memory';
}

export async function checkRateLimit(
  name: string,
  identifier: string,
): Promise<RateLimitResult> {
  const config = LIMIT_CONFIGS[name];
  if (!config) {
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      provider: 'memory',
    };
  }

  // Tenta Redis primeiro (produção)
  const limiter = getRatelimiter(name);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Date.now() + (result.reset || 0),
        provider: 'redis',
      };
    } catch (err) {
      console.error('[RATE_LIMIT] Redis falhou, fallback in-memory:', err);
    }
  }

  // Fallback in-memory (dev)
  const result = inMemoryLimit(identifier, config.limit, config.windowSeconds);
  return {
    success: result.success,
    limit: config.limit,
    remaining: result.remaining,
    reset: result.reset,
    provider: 'memory',
  };
}

/**
 * Helper para uso em API routes Next.js.
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const ip = req.headers.get('x-forwarded-for') || 'unknown';
 *   const limit = await enforceRateLimit('api-write', ip);
 *   if (!limit.success) {
 *     return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'X-RateLimit-Reset': String(limit.reset) } });
 *   }
 *   // ... lógica da rota
 * }
 */
export async function enforceRateLimit(
  name: string,
  identifier: string,
): Promise<RateLimitResult> {
  const result = await checkRateLimit(name, identifier);

  if (!result.success) {
    console.warn(`[RATE_LIMIT] BLOQUEADO: ${name} | id=${identifier} | limit=${result.limit}`);
  }

  return result;
}

/**
 * Helper para combinar IP + tenantId (rate limit mais granular).
 */
export function buildIdentifier(
  ip?: string | null,
  tenantId?: string | null,
): string {
  if (tenantId) return `t:${tenantId}:${ip || 'unknown'}`;
  return `ip:${ip || 'unknown'}`;
}
