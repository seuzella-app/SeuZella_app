/**
 * Semantic Cache for ZaosNeuroRouter
 *
 * In-memory LRU cache with TTL support for caching LLM responses.
 * Cache keys are derived from a hash of (provider + prompt + params).
 * Maximum 1000 entries with LRU eviction.
 *
 * Features:
 *   - TTL-based expiry (default: 1 hour)
 *   - LRU eviction when max capacity is reached
 *   - Cache hit/miss statistics
 *   - Selective invalidation by key prefix
 */

export interface CacheEntry<T = string> {
  /** The cached response value */
  value: T;
  /** Number of input tokens in the original response */
  inputTokens: number;
  /** Number of output tokens in the original response */
  outputTokens: number;
  /** ISO timestamp when this entry was created */
  createdAt: number;
  /** TTL in milliseconds */
  ttlMs: number;
  /** Provider that generated this response */
  provider: string;
}

export interface CacheStats {
  /** Total number of entries currently in the cache */
  size: number;
  /** Maximum capacity */
  maxSize: number;
  /** Total number of cache hits since creation/reset */
  hits: number;
  /** Total number of cache misses since creation/reset */
  misses: number;
  /** Hit rate as a ratio between 0 and 1 */
  hitRate: number;
  /** Total number of evictions due to capacity */
  evictions: number;
  /** Total number of entries expired by TTL */
  expirations: number;
}

export interface SemanticCacheConfig {
  /** Maximum number of entries in the cache (default: 1000) */
  maxSize: number;
  /** Default TTL in milliseconds (default: 3_600_000 = 1 hour) */
  defaultTtlMs: number;
}

const DEFAULT_CONFIG: SemanticCacheConfig = {
  maxSize: 1000,
  defaultTtlMs: 3_600_000,
};

/**
 * Simple deterministic string hash using FNV-1a algorithm.
 * Fast and provides good distribution for cache keys.
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime (32-bit): 0x01000193
    // Use Math.imul for 32-bit integer multiplication
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Normalize text by lowercasing, removing punctuation, collapsing whitespace, and trimming.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a cache key from provider, prompt, optional parameters, tenantId, and systemPrompt.
 * Incorporates tenantId to prevent any Cross-Tenant Cache Leakage between different pousadas.
 */
export function buildCacheKey(
  provider: string,
  prompt: string,
  params?: Record<string, unknown>,
  tenantId?: string,
  systemPrompt?: string
): string {
  const normalizedPrompt = normalizeText(prompt);
  const paramStr = params ? JSON.stringify(params) : '';
  const tenantStr = tenantId || 'global';
  const sysStr = systemPrompt ? normalizeText(systemPrompt) : '';
  const raw = `${tenantStr}::${provider}::${normalizedPrompt}::${sysStr}::${paramStr}`;
  return fnv1aHash(raw);
}

export class SemanticCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // For LRU tracking
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private readonly config: SemanticCacheConfig;

  constructor(config: Partial<SemanticCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Retrieve a cached entry if it exists and has not expired.
   *
   * @param key - The cache key (use `buildCacheKey` or provide your own)
   * @returns The cached entry or `null` on miss/expiry
   */
  get<T = string>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.createdAt > entry.ttlMs) {
      // Expired — remove and count
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.expirations++;
      this.misses++;
      return null;
    }

    // Cache hit — move to end of access order (most recently used)
    this.hits++;
    this.touchAccessOrder(key);
    return entry as CacheEntry<T>;
  }

  /**
   * Store a value in the cache.
   *
   * If the cache is full, the least recently used entry is evicted.
   *
   * @param key - The cache key
   * @param value - The value to cache
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param provider - Provider ID that generated the response
   * @param ttlMs - Optional TTL override (defaults to configured default)
   */
  set<T = string>(
    key: string,
    value: T,
    inputTokens: number,
    outputTokens: number,
    provider: string,
    ttlMs?: number,
  ): void {
    // If key already exists, remove it first (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      inputTokens,
      outputTokens,
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.config.defaultTtlMs,
      provider,
    };

    this.cache.set(key, entry as CacheEntry);
    this.accessOrder.push(key);
  }

  /**
   * Invalidate a specific cache entry by key.
   *
   * @returns `true` if the entry existed and was removed
   */
  invalidate(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Invalidate all cache entries that have a key starting with the given prefix.
   *
   * @returns The number of entries invalidated
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all entries from the cache. Resets statistics.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  /**
   * Get cache statistics for observability.
   */
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 10_000) / 10_000 : 0,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }

  /**
   * Remove all expired entries from the cache.
   *
   * @returns The number of entries purged
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttlMs) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        purged++;
        this.expirations++;
      }
    }

    return purged;
  }

  /**
   * Get the number of entries currently in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /* ------------------------------------------------------------------ */
  /* Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Evict the least recently used entry */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
    this.evictions++;
  }

  /** Move a key to the end of the access order (most recently used) */
  private touchAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  /** Remove a key from the access order tracking */
  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }
}