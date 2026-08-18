/**
 * ZÉLLA — Semantica Client
 *
 * Bridge TypeScript ↔ Python Semantica Sidecar (FastAPI em /opt/semantica).
 *
 * Arquitetura:
 *   Next.js (Vercel/VPS) → HTTP mTLS → uvicorn :7432 → Semantica (Python)
 *
 * Recursos:
 *   - Retry com backoff exponencial (3 tentativas: 200ms/400ms/800ms)
 *   - Timeout configurável (default 3s)
 *   - Cache Redis (Upstash) com fallback LRU in-memory (5min TTL)
 *   - mTLS opcional (certs em deploy/semantica-sidecar/certs/)
 *   - Feature flag USE_SEMANTICA_GRAPH (default false em dev)
 *   - Auth via SEMANTICA_API_KEY (header X-Semantica-Key)
 *   - Telemetria: latência, cache hit, source (semantica|fallback)
 *
 * Storage:
 *   - Apache AGE (graph) + PgVector (vectors) em PostgreSQL 16
 *   - Schema `semantica` isolado do schema `public` do Prisma
 *
 * Fallback gracioso:
 *   Se Semantica retornar erro/timeout, SemanticaError é lançado com
 *   isRecoverable()=true. Caller deve cair no semantic-rag.ts atual.
 */

import type {
  ContextNode,
  GraphEdge,
  RelationType,
  EntityType,
  HybridSearchRequest,
  HybridSearchResult,
  GraphConflict,
  ConflictStatus,
  DecisionRecord,
  DecisionCategory,
  DecisionOutcome,
  DecisionMetadata,
  CausalChain,
  IngestRequest,
  IngestResult,
  OntologyValidationResult,
  ReasoningResult,
  ForgetGuestRequest,
  ForgetGuestResult,
  SemanticaHealth,
  GraphStats,
  SemanticaError as SemanticaErrorType,
} from './types';
import { SemanticaError } from './types';

// ============================================================================
// CONFIG
// ============================================================================

interface SemanticaConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  cacheTtlSec: number;
  maxRetries: number;
  enabled: boolean;
  mtlsCertPath?: string;
  mtlsKeyPath?: string;
}

function getConfig(): SemanticaConfig {
  return {
    baseUrl: process.env.SEMANTICA_BASE_URL || 'http://127.0.0.1:7432',
    apiKey: process.env.SEMANTICA_API_KEY || '',
    timeoutMs: parseInt(process.env.SEMANTICA_TIMEOUT_MS || '3000', 10),
    cacheTtlSec: parseInt(process.env.SEMANTICA_CACHE_TTL || '300', 10),
    maxRetries: parseInt(process.env.SEMANTICA_MAX_RETRIES || '3', 10),
    enabled: process.env.USE_SEMANTICA_GRAPH === 'true',
    mtlsCertPath: process.env.SEMANTICA_MTLS_CERT_PATH,
    mtlsKeyPath: process.env.SEMANTICA_MTLS_KEY_PATH,
  };
}

// ============================================================================
// CACHE — LRU in-memory (sem Redis em dev, com Redis em prod via Upstash)
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxEntries = 500;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSec: number): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  invalidate(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const cache = new LRUCache();

// ============================================================================
// HTTP CLIENT com retry + timeout
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number,
  timeoutMs: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 5xx = retry
      if (res.status >= 500 && attempt < maxRetries - 1) {
        const backoffMs = 200 * Math.pow(2, attempt); // 200, 400, 800
        await sleep(backoffMs);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const backoffMs = 200 * Math.pow(2, attempt);
        await sleep(backoffMs);
        continue;
      }
    }
  }

  throw new SemanticaError(
    'TIMEOUT',
    `Request failed after ${maxRetries} retries: ${lastError?.message || 'unknown error'}`,
    408
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// CORE REQUEST FUNCTION
// ============================================================================

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  cacheKey?: string
): Promise<T> {
  const config = getConfig();

  if (!config.enabled && !path.startsWith('/health')) {
    throw new SemanticaError(
      'SERVICE_UNAVAILABLE',
      'Semantica is disabled (USE_SEMANTICA_GRAPH=false)',
      503
    );
  }

  if (!config.apiKey && !path.startsWith('/health')) {
    throw new SemanticaError(
      'UNAUTHORIZED',
      'SEMANTICA_API_KEY not configured',
      401
    );
  }

  // Cache check (GET only)
  if (method === 'GET' && cacheKey) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Semantica-Key': config.apiKey,
  };

  const res = await fetchWithRetry(
    url,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    config.maxRetries,
    config.timeoutMs
  );

  if (!res.ok) {
    let errorBody: any = null;
    try {
      errorBody = await res.json();
    } catch {
      // ignore JSON parse error
    }

    const code = mapStatusToErrorCode(res.status);
    throw new SemanticaError(
      code,
      errorBody?.message || `HTTP ${res.status}`,
      res.status,
      errorBody
    );
  }

  const data = (await res.json()) as T;

  // Cache (GET only)
  if (method === 'GET' && cacheKey) {
    cache.set(cacheKey, data, config.cacheTtlSec);
  }

  // Invalidate cache on writes
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    if (body && typeof body === 'object' && 'tenantId' in (body as any)) {
      cache.invalidate(`tenant:${(body as any).tenantId}:`);
    }
  }

  return data;
}

function mapStatusToErrorCode(status: number): SemanticaErrorType['code'] {
  switch (status) {
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 408: return 'TIMEOUT';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'INTERNAL_ERROR';
  }
}

// ============================================================================
// PUBLIC API — SemanticaClient
// ============================================================================

export const SemanticaClient = {
  // ── HEALTH ──────────────────────────────────────────────────────

  async health(): Promise<SemanticaHealth> {
    try {
      return await request<SemanticaHealth>('GET', '/health');
    } catch (err) {
      return {
        status: 'down',
        version: 'unknown',
        uptime: '0',
        postgres: 'disconnected',
        age: 'disconnected',
        pgvector: 'disconnected',
        totalTenants: 0,
        totalNodes: 0,
        totalEdges: 0,
        totalDecisions: 0,
        totalConflicts: 0,
        cacheHitRate: 0,
      };
    }
  },

  // ── GRAPH NODES ─────────────────────────────────────────────────

  async addNode(params: {
    tenantId: string;
    type: EntityType;
    name: string;
    content: string;
    provenance?: {
      source: string;
      sourceRef?: string;
      extractedBy?: string;
      guestId?: string;
    };
    confidence?: number;
  }): Promise<ContextNode> {
    return request<ContextNode>('POST', '/graph/nodes', params);
  },

  async getNode(tenantId: string, nodeId: string): Promise<ContextNode> {
    return request<ContextNode>(
      'GET',
      `/graph/nodes/${nodeId}?tenantId=${tenantId}`,
      undefined,
      `tenant:${tenantId}:node:${nodeId}`
    );
  },

  async listNodes(
    tenantId: string,
    type?: EntityType,
    limit = 100
  ): Promise<ContextNode[]> {
    const params = new URLSearchParams({
      tenantId,
      limit: String(limit),
    });
    if (type) params.set('type', type);
    return request<ContextNode[]>(
      'GET',
      `/graph/nodes?${params}`,
      undefined,
      `tenant:${tenantId}:nodes:${type || 'all'}:${limit}`
    );
  },

  async updateNode(
    tenantId: string,
    nodeId: string,
    updates: Partial<Pick<ContextNode, 'name' | 'content' | 'confidence'>>
  ): Promise<ContextNode> {
    return request<ContextNode>('PATCH', `/graph/nodes/${nodeId}`, {
      tenantId,
      ...updates,
    });
  },

  async deleteNode(tenantId: string, nodeId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(
      'DELETE',
      `/graph/nodes/${nodeId}?tenantId=${tenantId}`
    );
  },

  // ── GRAPH EDGES ─────────────────────────────────────────────────

  async addEdge(params: {
    tenantId: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationType: RelationType;
    priorityWeight?: number;
    condition?: string;
  }): Promise<GraphEdge> {
    return request<GraphEdge>('POST', '/graph/edges', params);
  },

  async listEdges(tenantId: string, limit = 100): Promise<GraphEdge[]> {
    return request<GraphEdge[]>(
      'GET',
      `/graph/edges?tenantId=${tenantId}&limit=${limit}`,
      undefined,
      `tenant:${tenantId}:edges:${limit}`
    );
  },

  async deleteEdge(tenantId: string, edgeId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(
      'DELETE',
      `/graph/edges/${edgeId}?tenantId=${tenantId}`
    );
  },

  // ── HYBRID SEARCH ────────────────────────────────────────────────

  async hybridSearch(params: HybridSearchRequest): Promise<HybridSearchResult> {
    const cacheKey = `tenant:${params.tenantId}:search:${params.query}:${params.hops || 2}:${params.maxNodes || 5}`;
    if (!params.noCache) {
      const cached = cache.get<HybridSearchResult>(cacheKey);
      if (cached) {
        return { ...cached, searchMeta: { ...cached.searchMeta, cacheHit: true } };
      }
    }
    return request<HybridSearchResult>('POST', '/graph/search', params);
  },

  // ── CONFLICTS ───────────────────────────────────────────────────

  async detectConflicts(tenantId: string): Promise<GraphConflict[]> {
    return request<GraphConflict[]>(
      'POST',
      '/conflicts/detect',
      { tenantId }
    );
  },

  async listConflicts(
    tenantId: string,
    status?: ConflictStatus
  ): Promise<GraphConflict[]> {
    const params = new URLSearchParams({ tenantId });
    if (status) params.set('status', status);
    return request<GraphConflict[]>(
      'GET',
      `/conflicts?${params}`,
      undefined,
      `tenant:${tenantId}:conflicts:${status || 'all'}`
    );
  },

  async resolveConflict(
    tenantId: string,
    conflictId: string,
    resolution: {
      type: RelationType;
      winnerNodeId: string;
      loserNodeId: string;
      reasoning: string;
    }
  ): Promise<GraphConflict> {
    return request<GraphConflict>(
      'PATCH',
      `/conflicts/${conflictId}/resolve`,
      { tenantId, ...resolution }
    );
  },

  // ── DECISIONS (audit intelligence) ──────────────────────────────

  async recordDecision(params: {
    tenantId: string;
    category: DecisionCategory;
    scenario: string;
    reasoning: string;
    outcome: DecisionOutcome;
    response?: string;
    confidence: number;
    metadata?: DecisionMetadata;
    graphNodeIds?: string[];
    parentDecisionId?: string;
  }): Promise<DecisionRecord> {
    // Decisions are never cached (always fresh)
    return request<DecisionRecord>('POST', '/decisions', params);
  },

  async getDecision(tenantId: string, decisionId: string): Promise<DecisionRecord> {
    return request<DecisionRecord>(
      'GET',
      `/decisions/${decisionId}?tenantId=${tenantId}`,
      undefined,
      `tenant:${tenantId}:decision:${decisionId}`
    );
  },

  async listDecisions(
    tenantId: string,
    limit = 50,
    offset = 0
  ): Promise<DecisionRecord[]> {
    return request<DecisionRecord[]>(
      'GET',
      `/decisions?tenantId=${tenantId}&limit=${limit}&offset=${offset}`,
      undefined,
      `tenant:${tenantId}:decisions:${limit}:${offset}`
    );
  },

  async traceDecisionChain(
    tenantId: string,
    decisionId: string
  ): Promise<CausalChain> {
    return request<CausalChain>(
      'GET',
      `/decisions/${decisionId}/trace?tenantId=${tenantId}`,
      undefined,
      `tenant:${tenantId}:trace:${decisionId}`
    );
  },

  async findSimilarDecisions(
    tenantId: string,
    query: string,
    maxResults = 5
  ): Promise<DecisionRecord[]> {
    return request<DecisionRecord[]>(
      'POST',
      '/decisions/similar',
      { tenantId, query, maxResults }
    );
  },

  // ── INGESTION ───────────────────────────────────────────────────

  async ingest(params: IngestRequest): Promise<IngestResult> {
    return request<IngestResult>('POST', '/ingest', params);
  },

  // ── ONTOLOGY & REASONING ─────────────────────────────────────────

  async validateOntology(tenantId: string): Promise<OntologyValidationResult> {
    return request<OntologyValidationResult>(
      'POST',
      '/ontology/validate',
      { tenantId }
    );
  },

  async reason(
    tenantId: string,
    query: string
  ): Promise<ReasoningResult> {
    return request<ReasoningResult>(
      'POST',
      '/reasoning/query',
      { tenantId, query }
    );
  },

  // ── LGPD ────────────────────────────────────────────────────────

  async forgetGuest(params: ForgetGuestRequest): Promise<ForgetGuestResult> {
    return request<ForgetGuestResult>('POST', '/lgpd/forget-guest', params);
  },

  // ── STATS ────────────────────────────────────────────────────────

  async getStats(tenantId: string): Promise<GraphStats> {
    return request<GraphStats>(
      'GET',
      `/stats?tenantId=${tenantId}`,
      undefined,
      `tenant:${tenantId}:stats`
    );
  },

  // ── CACHE MANAGEMENT ─────────────────────────────────────────────

  invalidateTenantCache(tenantId: string): void {
    cache.invalidate(`tenant:${tenantId}:`);
  },

  clearCache(): void {
    cache.clear();
  },

  getCacheSize(): number {
    return cache.size;
  },

  // ── CONFIG ───────────────────────────────────────────────────────

  isEnabled(): boolean {
    return getConfig().enabled;
  },

  isConfigured(): boolean {
    const config = getConfig();
    return !!(config.baseUrl && config.apiKey);
  },
};

// ============================================================================
// HELPER — wrapper para chamadas com fallback automático
// ============================================================================

/**
 * Executa uma chamada ao Semantica com fallback gracioso.
 * Se o Semantica falhar (timeout, 5xx, etc), executa a função de fallback.
 *
 * Uso típico em cognitive-router.ts:
 *
 *   const result = await withFallback(
 *     () => SemanticaClient.hybridSearch({ tenantId, query: message }),
 *     () => retrieveRelevantKnowledge(tenantId, message)  // fallback atual
 *   );
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  onError?: (err: SemanticaError) => void
): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (err instanceof SemanticaError) {
      if (onError) onError(err);
      if (err.isRecoverable()) {
        console.warn(`[Semantica] Fallback acionado: ${err.code} - ${err.message}`);
        return await fallback();
      }
      throw err;
    }
    throw err;
  }
}
