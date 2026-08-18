// ============================================================================
// ZÉLLA — Code Indexer (Cérebro Self-Awareness)
// ============================================================================
// Indexa o código-fonte do próprio repo para que o Cérebro possa:
//  1. Encontrar arquivos relacionados a um erro (via TF-IDF search)
//  2. Ler trechos de código relevantes
//  3. Mandar para GLM 5.2 propor refatorações
//
// INDEXAÇÃO:
//  - Varre src/**/*.ts e src/**/*.tsx em build time
//  - Divide cada arquivo em chunks de ~50 linhas (com overlap de 10)
//  - Salva em KnowledgeChunk no DB (com metadata de filePath/lineRange)
//  - Carrega chunks no TfidfIndex em memória (lazy load no primeiro acesso)
//
// FILTROS DE SEGURANÇA:
//  - NÃO indexa arquivos que contenham secrets (heurística por nome)
//  - NÃO indexa .env, *.secret, *token*, *password*
//  - NÃO indexa node_modules, .next, dist
//
// ANTI-PATTERN:
//  - Indexa também RefactorSuggestions aceitas/aplicadas como KnowledgeChunk
//    de source='refactor_applied' — o Cérebro aprende com o próprio passado
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getTfidfIndex, type TfidfIndex, type TfIdfDocument } from './tfidf';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// ── Configuração ────────────────────────────────────────────────────────────

const CHUNK_SIZE_LINES = 50;
const CHUNK_OVERLAP_LINES = 10;
const MAX_FILE_SIZE_KB = 100; // ignora arquivos > 100KB (provável dados, não código)

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'coverage',
  '__tests__', '__mocks__', '.cache', 'tmp',
]);

// Heurística: se arquivo bate com esses padrões, NÃO indexar (pode conter secrets)
const SECRET_PATTERNS = [
  /\.env/i, /\.secret/i, /secret\./i, /\btoken\b/i, /\bpassword\b/i,
  /\bapikey\b/i, /\bapi_key\b/i, /\bprivate_?key\b/i,
  /credentials?\.json$/i, /\.pem$/i, /\.key$/i,
];

// ── Helper: ler todos arquivos .ts/.tsx recursivamente (sem dependências) ────

interface FoundFile {
  path: string;
  size: number;
}

function findCodeFiles(rootDir: string, found: FoundFile[] = []): FoundFile[] {
  let entries: import('fs').Dirent[];
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      findCodeFiles(fullPath, found);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (!CODE_EXTENSIONS.has(ext)) continue;

      // Pula se nome bate com padrão de secret
      if (SECRET_PATTERNS.some(pattern => pattern.test(entry.name))) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE_KB * 1024) continue; // too big
        found.push({ path: fullPath, size: stat.size });
      } catch {
        // stat failed — skip
      }
    }
  }

  return found;
}

// ── Helper: dividir arquivo em chunks ──────────────────────────────────────

interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

function chunkFile(filePath: string, content: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  if (lines.length <= CHUNK_SIZE_LINES) {
    // Arquivo pequeno = 1 chunk
    chunks.push({
      filePath,
      startLine: 1,
      endLine: lines.length,
      content,
    });
    return chunks;
  }

  // Divide em chunks com overlap
  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + CHUNK_SIZE_LINES, lines.length);
    const chunkLines = lines.slice(start, end);
    const chunkContent = chunkLines.join('\n');

    chunks.push({
      filePath,
      startLine: start + 1, // 1-indexed
      endLine: end,
      content: chunkContent,
    });

    if (end >= lines.length) break;
    start += CHUNK_SIZE_LINES - CHUNK_OVERLAP_LINES; // overlap
  }

  return chunks;
}

// ── Indexação ───────────────────────────────────────────────────────────────

export interface IndexResult {
  filesScanned: number;
  chunksCreated: number;
  chunksSkipped: number;
  errors: string[];
  durationMs: number;
}

/**
 * Indexa todos arquivos .ts/.tsx do diretório src/ no DB + TfidfIndex.
 *
 * USO:
 *  - Em build time (vercel-build hook): chamar indexCodebase() para pré-popular
 *  - Em runtime (lazy load): chamar ensureIndexLoaded() no primeiro acesso
 *
 * Idempotente: se já existe no DB com mesmo sourceRef, skip.
 */
export async function indexCodebase(rootDir?: string): Promise<IndexResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let filesScanned = 0;
  let chunksCreated = 0;
  let chunksSkipped = 0;

  const projectRoot = rootDir || process.cwd();
  const srcDir = join(projectRoot, 'src');

  if (!existsSync(srcDir)) {
    return {
      filesScanned: 0,
      chunksCreated: 0,
      chunksSkipped: 0,
      errors: [`src/ directory not found at ${srcDir}`],
      durationMs: Date.now() - startTime,
    };
  }

  logSink.info({
    module: 'code-indexer',
    event: 'indexing_started',
    message: `Indexando código em ${srcDir}...`,
  });

  // 1. Encontra todos arquivos de código
  const files = findCodeFiles(srcDir);
  filesScanned = files.length;

  // 2. Limpa KnowledgeChunks antigos de source='github' antes de re-indexar
  try {
    await db.knowledgeChunk.deleteMany({
      where: { source: 'github' },
    });
  } catch (err) {
    errors.push(`Failed to clear old KnowledgeChunks: ${err instanceof Error ? err.message : String(err)}`);
    // Continua mesmo se falhar — vamos append
  }

  // 3. Indexa cada arquivo
  const tfidf = getTfidfIndex();
  tfidf.clear(); // reset in-memory index

  for (const file of files) {
    try {
      const content = readFileSync(file.path, 'utf-8');
      const relativePath = file.path.replace(projectRoot + '/', '');
      const chunks = chunkFile(relativePath, content);

      for (const chunk of chunks) {
        try {
          const chunkId = `${relativePath}:${chunk.startLine}-${chunk.endLine}`;

          // Salva no DB
          await db.knowledgeChunk.create({
            data: {
              source: 'github',
              sourceRef: chunkId,
              filePath: relativePath,
              content: chunk.content,
              embedding: '[]', // TF-IDF doesn't use embeddings (we compute on-the-fly)
              metadata: JSON.stringify({
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                language: extname(relativePath).slice(1),
                fileSizeBytes: file.size,
              }),
            },
          });
          chunksCreated++;

          // Adiciona ao índice em memória
          const doc: TfIdfDocument = {
            id: chunkId,
            content: chunk.content,
            filePath: relativePath,
            metadata: {
              startLine: chunk.startLine,
              endLine: chunk.endLine,
            },
          };
          tfidf.addDocument(doc);
        } catch (err) {
          chunksSkipped++;
          // Pode falhar se chunkId duplicado (race condition em paralelo)
          if (!String(err).includes('Unique constraint')) {
            errors.push(`Failed to index chunk ${relativePath}:${chunk.startLine}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Failed to read ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const durationMs = Date.now() - startTime;

  // ── Invalida cache Redis (Passo 11.2) ──
  // Após re-indexação manual, o cache Redis pode estar desatualizado.
  // Invalida para que próximas cargas façam query DB fresca.
  if (chunksCreated > 0 && isRedisConfigured()) {
    void invalidateRedisCache().catch(() => {
      // Silent — invalidação é best-effort
    });
  }

  logSink.info({
    module: 'code-indexer',
    event: 'indexing_complete',
    message: `Indexação completa: ${filesScanned} arquivos, ${chunksCreated} chunks em ${durationMs}ms`,
    context: {
      filesScanned,
      chunksCreated,
      chunksSkipped,
      errors: errors.length,
      durationMs,
    },
  });

  return {
    filesScanned,
    chunksCreated,
    chunksSkipped,
    errors: errors.slice(0, 10), // limit to first 10 errors
    durationMs,
  };
}

// ── Lazy load: carrega chunks do DB para TfidfIndex em memória ──────────────
//
// PASSO 11.2 — Cache Redis para evitar DB roundtrip em cold start
//
// Fluxo:
//  1. Verifica cache Redis (key: tfidf:index:<git-commit-sha>)
//     - HIT: deserializa matriz TF-IDF e carrega em memória (< 100ms)
//     - MISS: continua para passo 2
//  2. Query DB (carrega KnowledgeChunks)
//  3. Serializa matriz TF-IDF e salva no Redis com TTL 30 dias
//
// Resultado: cold start com cache HIT fica em ~50ms (vs 2-5s sem cache)
// Reindexação automática: quando VERCEL_GIT_COMMIT_SHA muda (novo deploy),
// a key do Redis é diferente, forçando miss e requery ao DB.

let indexLoaded = false;
let indexLoadedCommitSha: string | null = null;

const REDIS_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias
const REDIS_CACHE_KEY_PREFIX = 'tfidf:index:';

function getRedisCacheKey(): string {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'local-dev';
  return `${REDIS_CACHE_KEY_PREFIX}${commitSha}`;
}

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Carrega todos KnowledgeChunks do DB para o TfidfIndex em memória.
 * Idempotente — só carrega uma vez por lambda.
 *
 * Com cache Redis (Passo 11.2):
 *  - Cache HIT: deserializa matriz TF-IDF do Redis (< 100ms)
 *  - Cache MISS: query DB + serializa para Redis (2-5s primeira vez)
 */
export async function ensureIndexLoaded(): Promise<{ loaded: boolean; chunks: number; fromCache: boolean }> {
  const currentCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'local-dev';

  // Já carregado neste lambda E para o mesmo commit SHA
  if (indexLoaded && indexLoadedCommitSha === currentCommitSha) {
    return { loaded: true, chunks: getTfidfIndex().getStats().totalDocs, fromCache: true };
  }

  // Reset se commit SHA mudou (novo deploy)
  if (indexLoadedCommitSha !== currentCommitSha) {
    getTfidfIndex().clear();
    indexLoaded = false;
  }

  // ── 1. Tenta cache Redis primeiro ──
  if (isRedisConfigured()) {
    const cacheResult = await loadIndexFromRedis();
    if (cacheResult.loaded) {
      indexLoaded = true;
      indexLoadedCommitSha = currentCommitSha;
      logSink.info({
        module: 'code-indexer',
        event: 'index_loaded_from_redis',
        message: `${cacheResult.chunks} chunks carregados do Redis cache em ${cacheResult.loadTimeMs}ms`,
        context: {
          chunks: cacheResult.chunks,
          loadTimeMs: cacheResult.loadTimeMs,
          cacheKey: getRedisCacheKey(),
        },
      });
      return { loaded: true, chunks: cacheResult.chunks, fromCache: true };
    }
  }

  // ── 2. Cache MISS — query DB ──
  try {
    const chunks = await db.knowledgeChunk.findMany({
      where: { source: 'github' },
      select: { sourceRef: true, content: true, filePath: true, metadata: true },
      take: 10000, // safety limit
    });

    const tfidf = getTfidfIndex();
    for (const chunk of chunks) {
      const metadata = JSON.parse(chunk.metadata || '{}') as { startLine?: number; endLine?: number };
      const doc: TfIdfDocument = {
        id: chunk.sourceRef,
        content: chunk.content,
        filePath: chunk.filePath || undefined,
        metadata,
      };
      tfidf.addDocument(doc);
    }

    indexLoaded = true;
    indexLoadedCommitSha = currentCommitSha;
    logSink.info({
      module: 'code-indexer',
      event: 'index_loaded_from_db',
      message: `${chunks.length} chunks carregados do DB para TfidfIndex em memória`,
      context: { chunks: chunks.length, cacheKey: getRedisCacheKey() },
    });

    // ── 3. Salva no Redis para próxima vez (fire-and-forget) ──
    if (isRedisConfigured()) {
      void saveIndexToRedis(chunks).catch((err) => {
        logSink.warn({
          module: 'code-indexer',
          event: 'redis_save_failed',
          message: 'Falha ao salvar TF-IDF no Redis (non-fatal)',
          error: err,
        });
      });
    }

    return { loaded: true, chunks: chunks.length, fromCache: false };
  } catch (err) {
    logSink.error({
      module: 'code-indexer',
      event: 'load_from_db_failed',
      message: 'Falha ao carregar KnowledgeChunks do DB',
      error: err,
    });
    return { loaded: false, chunks: 0, fromCache: false };
  }
}

// ── Redis cache: load ──────────────────────────────────────────────────────

interface RedisCacheLoadResult {
  loaded: boolean;
  chunks: number;
  loadTimeMs: number;
}

async function loadIndexFromRedis(): Promise<RedisCacheLoadResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const key = getRedisCacheKey();
  const startTime = Date.now();

  try {
    const res = await fetch(`${url}/get/${key}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      throw new Error(`Redis GET HTTP ${res.status}`);
    }

    const data = (await res.json()) as { result: string | null };
    if (!data.result) {
      return { loaded: false, chunks: 0, loadTimeMs: Date.now() - startTime };
    }

    // Deserializa matriz TF-IDF
    const serialized = JSON.parse(data.result) as {
      docs: Array<{
        id: string;
        content: string;
        filePath: string | null;
        metadata: { startLine?: number; endLine?: number };
      }>;
    };

    const tfidf = getTfidfIndex();
    tfidf.clear();

    for (const doc of serialized.docs) {
      tfidf.addDocument({
        id: doc.id,
        content: doc.content,
        filePath: doc.filePath || undefined,
        metadata: doc.metadata,
      });
    }

    return {
      loaded: true,
      chunks: serialized.docs.length,
      loadTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    logSink.warn({
      module: 'code-indexer',
      event: 'redis_load_failed',
      message: 'Falha ao carregar TF-IDF do Redis cache (non-fatal)',
      error: err,
    });
    return { loaded: false, chunks: 0, loadTimeMs: Date.now() - startTime };
  }
}

// ── Redis cache: save ──────────────────────────────────────────────────────

async function saveIndexToRedis(chunks: Array<{
  sourceRef: string;
  content: string;
  filePath: string | null;
  metadata: string;
}>): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const key = getRedisCacheKey();

  // Serializa matriz TF-IDF (apenas docs, não IDF que é recalculado)
  const serialized = JSON.stringify({
    docs: chunks.map(c => ({
      id: c.sourceRef,
      content: c.content,
      filePath: c.filePath,
      metadata: JSON.parse(c.metadata || '{}'),
    })),
    cachedAt: new Date().toISOString(),
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'local-dev',
  });

  const res = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([serialized, 'EX', String(REDIS_CACHE_TTL_SECONDS)]),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Redis SET HTTP ${res.status}`);
  }

  logSink.info({
    module: 'code-indexer',
    event: 'index_saved_to_redis',
    message: `${chunks.length} chunks salvos no Redis cache (TTL ${REDIS_CACHE_TTL_SECONDS}s)`,
    context: {
      chunks: chunks.length,
      cacheKey: key,
      ttlSeconds: REDIS_CACHE_TTL_SECONDS,
    },
  });
}

/**
 * Invalida cache Redis (chamado quando código é re-indexado manualmente).
 */
export async function invalidateRedisCache(): Promise<void> {
  if (!isRedisConfigured()) return;

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const key = getRedisCacheKey();

  try {
    await fetch(`${url}/del/${key}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    logSink.info({
      module: 'code-indexer',
      event: 'redis_cache_invalidated',
      message: `Cache Redis invalidado: ${key}`,
      context: { cacheKey: key },
    });
  } catch (err) {
    logSink.warn({
      module: 'code-indexer',
      event: 'redis_invalidate_failed',
      message: 'Falha ao invalidar cache Redis (non-fatal)',
      error: err,
    });
  }

  // Reset flags in-memory
  indexLoaded = false;
  indexLoadedCommitSha = null;
  getTfidfIndex().clear();
}

/**
 * Reseta flag de loaded (para testes).
 */
export function resetIndexLoaded(): void {
  indexLoaded = false;
  indexLoadedCommitSha = null;
  getTfidfIndex().clear();
}

// ── Busca: encontra trechos de código relevantes para um erro ──────────────

export interface CodeRetrievalResult {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

/**
 * Busca trechos de código relevantes para um erro ou query.
 *
 * Faz:
 *  1. ensureIndexLoaded() — carrega DB → memória se ainda não carregou
 *  2. tfidf.search(query, k) — top-K chunks por similaridade
 *
 * @param query Mensagem de erro, stack trace, ou descrição de problema
 * @param k Número máximo de resultados (default 5)
 */
export async function searchCodebase(query: string, k: number = 5): Promise<CodeRetrievalResult[]> {
  await ensureIndexLoaded();

  const tfidf = getTfidfIndex();
  const results = tfidf.search(query, k);

  return results.map(r => ({
    filePath: r.doc.filePath || 'unknown',
    startLine: (r.doc.metadata as { startLine?: number })?.startLine || 0,
    endLine: (r.doc.metadata as { endLine?: number })?.endLine || 0,
    content: r.doc.content,
    score: r.score,
  }));
}

/**
 * Lê um trecho específico de arquivo do filesystem (para análise de refatoração).
 */
export function readCodeSnippet(filePath: string, startLine: number, endLine: number): string | null {
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) return null;

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join('\n');
  } catch {
    return null;
  }
}

// ── Stats para dashboard ────────────────────────────────────────────────────

export async function getIndexStats(): Promise<{
  tfidf: ReturnType<TfidfIndex['getStats']>;
  dbChunks: number;
  isLoaded: boolean;
}> {
  let dbChunks = 0;
  try {
    dbChunks = await db.knowledgeChunk.count({ where: { source: 'github' } });
  } catch {
    // ignore
  }

  return {
    tfidf: getTfidfIndex().getStats(),
    dbChunks,
    isLoaded: indexLoaded,
  };
}
