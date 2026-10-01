/**
 * Canonical Redis configuration contract.
 *
 * Upstash REST credentials power serverless rate limiting and HTTP helpers.
 * BullMQ/ioredis requires a separate native Redis connection URL. A REST URL
 * must never be passed to ioredis, and a native password must never be logged.
 */

export interface RedisEnvironment {
  NODE_ENV?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  REDIS_URL?: string;
  REDIS_CONNECTION_STRING?: string;
  REDIS_PASSWORD?: string;
  REDIS_TOKEN?: string;
}

export interface RedisConfigStatus {
  restConfigured: boolean;
  restPartiallyConfigured: boolean;
  nativeConfigured: boolean;
  nativePartiallyConfigured: boolean;
  production: boolean;
  errors: string[];
}

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export function getRedisConfigStatus(env: RedisEnvironment = process.env): RedisConfigStatus {
  const restUrl = present(env.UPSTASH_REDIS_REST_URL);
  const restToken = present(env.UPSTASH_REDIS_REST_TOKEN);
  const nativeUrl = present(env.REDIS_URL) || present(env.REDIS_CONNECTION_STRING);
  const nativeSecret = present(env.REDIS_PASSWORD) || present(env.REDIS_TOKEN);
  const production = env.NODE_ENV === 'production';
  const errors: string[] = [];

  if (restUrl !== restToken) {
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together');
  }
  if (nativeSecret && !nativeUrl) {
    errors.push('REDIS_PASSWORD/REDIS_TOKEN is present without REDIS_URL or REDIS_CONNECTION_STRING');
  }
  return {
    restConfigured: restUrl && restToken,
    restPartiallyConfigured: restUrl !== restToken,
    nativeConfigured: nativeUrl,
    // Native Redis credentials may be embedded in the URL, so a separate
    // password is optional when a URL is present.
    nativePartiallyConfigured: nativeSecret && !nativeUrl,
    production,
    errors,
  };
}

export function hasUpstashRestCredentials(env: RedisEnvironment = process.env): boolean {
  return getRedisConfigStatus(env).restConfigured;
}

export function hasNativeRedisCredentials(env: RedisEnvironment = process.env): boolean {
  return getRedisConfigStatus(env).nativeConfigured;
}

export function assertRedisConfigCoherent(env: RedisEnvironment = process.env): void {
  const status = getRedisConfigStatus(env);
  if (status.errors.length > 0) {
    throw new Error(`REDIS_CONFIGURATION_INVALID: ${status.errors.join('; ')}`);
  }
}

export function redisConfigurationSummary(env: RedisEnvironment = process.env): string {
  const status = getRedisConfigStatus(env);
  const mode = status.production ? 'production' : 'non-production';
  return [
    `mode=${mode}`,
    `upstash_rest=${status.restConfigured ? 'configured' : 'missing'}`,
    `native_redis=${status.nativeConfigured ? 'configured' : 'missing'}`,
    `errors=${status.errors.length}`,
  ].join(' ');
}
