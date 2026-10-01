import { describe, expect, it } from 'vitest';
import {
  assertRedisConfigCoherent,
  getRedisConfigStatus,
  hasNativeRedisCredentials,
  hasUpstashRestCredentials,
  redisConfigurationSummary,
} from '@/lib/infra/redis-config';

describe('Phase 3 — Redis configuration contract', () => {
  it('reports honest BLOCKED-by-infra state when no provider credentials exist', () => {
    const status = getRedisConfigStatus({ NODE_ENV: 'production' });

    expect(status.production).toBe(true);
    expect(status.restConfigured).toBe(false);
    expect(status.nativeConfigured).toBe(false);
    expect(status.errors).toEqual([]);
    expect(redisConfigurationSummary({ NODE_ENV: 'production' })).toContain('upstash_rest=missing');
  });

  it('rejects a partial Upstash REST credential pair', () => {
    const env = {
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.invalid',
    };

    const status = getRedisConfigStatus(env);
    expect(status.restPartiallyConfigured).toBe(true);
    expect(status.restConfigured).toBe(false);
    expect(() => assertRedisConfigCoherent(env)).toThrow('REDIS_CONFIGURATION_INVALID');
  });

  it('accepts complete REST credentials and a native URL independently', () => {
    const env = {
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.invalid',
      UPSTASH_REDIS_REST_TOKEN: 'redacted-test-token',
      REDIS_URL: 'redacted-native-redis-url',
    };

    expect(hasUpstashRestCredentials(env)).toBe(true);
    expect(hasNativeRedisCredentials(env)).toBe(true);
    expect(getRedisConfigStatus(env).errors).toEqual([]);
    expect(() => assertRedisConfigCoherent(env)).not.toThrow();
  });

  it('does not mistake a REST URL for a native BullMQ URL', () => {
    const env = {
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.invalid',
      UPSTASH_REDIS_REST_TOKEN: 'redacted-test-token',
    };

    const status = getRedisConfigStatus(env);
    expect(status.restConfigured).toBe(true);
    expect(status.nativeConfigured).toBe(false);
  });

  it('rejects an orphan native password without a connection URL', () => {
    const env = { NODE_ENV: 'production', REDIS_PASSWORD: 'redacted-test-password' };
    const status = getRedisConfigStatus(env);

    expect(status.nativePartiallyConfigured).toBe(true);
    expect(() => assertRedisConfigCoherent(env)).toThrow('REDIS_CONFIGURATION_INVALID');
  });
});
