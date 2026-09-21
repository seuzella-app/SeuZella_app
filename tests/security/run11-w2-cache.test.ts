import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalCache, RedisCache, getCache, __resetCacheForTests } from '../../src/lib/infra/cache';

/**
 * RUN11-W2 — invariantes do cache (cronograma 11A).
 * Cache degrada para MISS, nunca quebra o chamador; fallback local explícito.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RUN11-W2 cache — LocalCache (TTL + LRU + stats)', () => {
  it('TTL: valor expira (miss) e é removido do store', async () => {
    const c = new LocalCache(10);
    await c.set('k', 'v', 5);
    expect(await c.get('k')).toBe('v');
    await sleep(15);
    expect(await c.get('k')).toBeNull();
    expect(c.stats().entries).toBe(0);
    expect(c.stats().misses).toBeGreaterThan(0);
  });

  it('LRU: acima do teto, a chave mais antiga (menos recente) é evicted', async () => {
    const c = new LocalCache(2);
    await c.set('a', '1', 60_000);
    await sleep(2);
    await c.set('b', '2', 60_000);
    await c.get('a'); // 'a' vira mais recente; 'b' vira candidata a eviction
    await sleep(2);
    await c.set('c', '3', 60_000); // excede teto -> evict 'b'
    expect(await c.get('b')).toBeNull();
    expect(await c.get('a')).toBe('1');
    expect(await c.get('c')).toBe('3');
    expect(c.stats().evictions).toBe(1);
  });

  it('del remove e ttl<=0 não grava', async () => {
    const c = new LocalCache();
    await c.set('x', '1', 60_000);
    await c.del('x');
    expect(await c.get('x')).toBeNull();
    await c.set('y', '1', 0);
    expect(await c.get('y')).toBeNull();
  });
});

describe('RUN11-W2 cache — Redis opcional e degradação', () => {
  let envBackup: string | undefined;
  beforeEach(() => {
    envBackup = process.env.REDIS_URL;
    __resetCacheForTests();
  });
  afterEach(() => {
    if (envBackup === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = envBackup;
    __resetCacheForTests();
    vi.restoreAllMocks();
  });

  it('REDIS_URL presente sem pacote redis: fallback local com WARN explícito (não silencioso)', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const driver = await getCache();
    expect(driver.name).toBe('local'); // fixture E2E não tem ioredis -> fallback
    const warn = logSpy.mock.calls.map((a) => String(a[0])).find((l) => l.includes('[SZ-INFRA][WARN] cache.redis'));
    expect(warn).toBeTruthy();
    // WARN é único por processo: chamadas subsequentes (singleton em cache) não reavisam
    await getCache();
    await getCache();
    const warnCount = logSpy.mock.calls.filter((a) => String(a[0]).includes('cache.redis')).length;
    expect(warnCount).toBe(1);
  });

  it('RedisCache em erro: get vira MISS, set/del engolem — nunca exceção', async () => {
    const broken = {
      get: async () => {
        throw new Error('conn refused');
      },
      set: async () => {
        throw new Error('conn refused');
      },
      del: async () => {
        throw new Error('conn refused');
      },
      connect: async () => undefined,
      on: () => undefined,
    };
    const rc = new RedisCache(broken as never);
    expect(await rc.get('k')).toBeNull();
    await expect(rc.set('k', 'v', 1000)).resolves.toBeUndefined();
    await expect(rc.del('k')).resolves.toBeUndefined();
    expect(rc.stats().degraded).toBe(true);
  });
});
