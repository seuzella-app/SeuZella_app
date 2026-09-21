/**
 * SEUZELLA RUN11-W2 — cache com fallback local (cronograma 11A).
 *
 * Contrato: cache NUNCA derruba a aplicação. Degradação = miss + WARN
 * estruturado (contado), nunca exceção para o chamador.
 *
 * - REDIS_URL ausente ................. LocalCache (in-memory, TTL + LRU).
 * - REDIS_URL presente + ioredis ok ... RedisCache (conexão preguiçosa).
 * - REDIS_URL presente, sem pacote .... LocalCache + WARN explícito (uma vez).
 *
 * Sem segredos em strings (invariante AST da suíte run11-w2).
 */
import { importOptional, warnOnce } from './optional-require';

export interface CacheDriver {
  readonly name: 'local' | 'redis';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  stats(): CacheStats;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  degraded: boolean;
}

const WARN_STATE = new Map<string, boolean>();

/* ------------------------------------------------------------------ local */

interface LocalEntry {
  value: string;
  expiresAt: number;
}

export class LocalCache implements CacheDriver {
  readonly name = 'local' as const;
  private store = new Map<string, LocalEntry>();
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxEntries?: number) {
    const fromEnv = Number(process.env.CACHE_LOCAL_MAX ?? '');
    const parsed = Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : NaN;
    this.maxEntries = maxEntries ?? (Number.isNaN(parsed) ? 1000 : parsed);
  }

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit) {
      this.misses += 1;
      return null;
    }
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key); // expirado = miss; entrada removida na leitura
      this.misses += 1;
      return null;
    }
    // LRU: re-inserir move a chave para o fim da ordem de iteração
    this.store.delete(key);
    this.store.set(key, hit);
    this.hits += 1;
    return hit.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) {
        this.store.delete(oldest.value);
        this.evictions += 1;
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  stats(): CacheStats {
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      degraded: false,
    };
  }
}

/* ------------------------------------------------------------------ redis */

interface MinimalRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  connect(): Promise<unknown>;
  on(event: string, fn: (...a: unknown[]) => void): unknown;
}

export class RedisCache implements CacheDriver {
  readonly name = 'redis' as const;
  private degraded = false;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private client: MinimalRedis) {
    client.on('error', () => {
      this.degraded = true;
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      const v = await this.client.get(key);
      this.degraded = false;
      if (v === null) this.misses += 1;
      else this.hits += 1;
      return v;
    } catch {
      this.degraded = true;
      this.misses += 1;
      return null; // degradação = miss; nunca exceção
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    try {
      await this.client.set(key, value, 'PX', Math.ceil(ttlMs));
      this.degraded = false;
    } catch {
      this.degraded = true; // write-best-effort
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      this.degraded = true;
    }
  }

  stats(): CacheStats {
    return { entries: -1, hits: this.hits, misses: this.misses, evictions: this.evictions, degraded: this.degraded };
  }
}

/* ------------------------------------------------------------- singleton */

let cachePromise: Promise<CacheDriver> | null = null;

/** Reset apenas para testes. */
export function __resetCacheForTests(): void {
  cachePromise = null;
  WARN_STATE.delete('cache.redis');
}

export function getCache(): Promise<CacheDriver> {
  if (!cachePromise) cachePromise = buildCache();
  return cachePromise;
}

async function buildCache(): Promise<CacheDriver> {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '') return new LocalCache();

  const mod = await importOptional<{ default?: unknown } | unknown>('ioredis');
  if (mod) {
    try {
      const Ctor = ((mod as { default?: unknown }).default ?? mod) as new (
        url: string,
        opts?: Record<string, unknown>,
      ) => MinimalRedis;
      const client = new Ctor(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
      });
      await client.connect();
      return new RedisCache(client);
    } catch {
      // cai no fallback abaixo com WARN
    }
  }
  warnOnce(
    'cache.redis',
    'REDIS_URL configurado mas driver redis indisponivel (pacote ausente ou conexao falhou) — fallback local ativo',
    WARN_STATE,
  );
  return new LocalCache();
}
