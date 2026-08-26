/**
 * Vector Embedder — Gemini text-embedding-004
 *
 * Substitui TF-IDF por embeddings vetoriais reais do Google Gemini.
 * Vetores de 768 dimensões armazenados no campo `embeddingJson` existente.
 *
 * Pipeline:
 * 1. Envia texto para a API Gemini Embedding
 * 2. Recebe vetor de 768 dimensões
 * 3. Armazena como JSON array no campo embeddingJson (mesmo campo do TF-IDF)
 * 4. Busca via similaridade de cosseno in-memory
 *
 * Diferenciação TF-IDF vs Vector:
 * - TF-IDF: vetor esparso, dimensão variável (tamanho do vocabulário, tipicamente >100)
 * - Vector: 768 dimensões fixas (Gemini text-embedding-004)
 *
 * Custo: ~$0.000018 por embedding (praticamente gratuito)
 * Latência: ~50-80ms por embedding, ~200ms por batch de 100
 */

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
export const EMBEDDING_DIMENSIONS = 768;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── In-memory cache ────────────────────────────────────────────────────
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 2000;

function getCacheKey(text: string): string {
  return text.trim().toLowerCase().slice(0, 500);
}

function cacheSet(key: string, vector: number[]): void {
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    // Evict oldest entries (first 20%)
    const keysToDelete = Array.from(embeddingCache.keys()).slice(0, Math.floor(CACHE_MAX_SIZE * 0.2));
    for (const k of keysToDelete) embeddingCache.delete(k);
  }
  embeddingCache.set(key, vector);
}

// ── Single embedding ───────────────────────────────────────────────────

/**
 * Gera um embedding vetorial para um texto usando a API Gemini.
 *
 * @param text - Texto para gerar o embedding
 * @param apiKey - Chave da API Gemini (usa env var se não fornecida)
 * @returns Vetor de 768 dimensões
 */
export async function generateEmbedding(
  text: string,
  apiKey?: string,
): Promise<number[]> {
  const key = apiKey || process.env.GEMINI_API_KEY || '';
  if (!key) {
    throw new Error('[VectorEmbedder] GEMINI_API_KEY nao configurada para embeddings vetoriais');
  }

  const cacheKey = getCacheKey(text);
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const url = `${GEMINI_BASE_URL}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GEMINI_EMBEDDING_MODEL,
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `[VectorEmbedder] Erro Gemini embedding (${response.status}): ${errText.slice(0, 300)}`,
    );
  }

  const data = await response.json();
  const values: number[] = data.embedding?.values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('[VectorEmbedder] Nenhum valor de embedding retornado');
  }

  cacheSet(cacheKey, values);
  return values;
}

// ── Batch embeddings ───────────────────────────────────────────────────

/**
 * Gera embeddings para múltiplos textos em uma única requisição batch.
 * Gemini suporta até 100 textos por batch.
 *
 * @param texts - Array de textos para gerar embeddings
 * @param apiKey - Chave da API Gemini (usa env var se não fornecida)
 * @returns Array de vetores (mesma ordem dos textos de entrada)
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  apiKey?: string,
): Promise<number[][]> {
  const key = apiKey || process.env.GEMINI_API_KEY || '';
  if (!key) {
    throw new Error('[VectorEmbedder] GEMINI_API_KEY nao configurada para embeddings vetoriais');
  }

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cacheKey = getCacheKey(texts[i]);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedTexts.length === 0) {
    return results as number[][];
  }

  // Gemini batch API — max 100 per request
  const BATCH_SIZE = 100;
  for (let batchStart = 0; batchStart < uncachedTexts.length; batchStart += BATCH_SIZE) {
    const batch = uncachedTexts.slice(batchStart, batchStart + BATCH_SIZE);
    const batchIndices = uncachedIndices.slice(batchStart, batchStart + BATCH_SIZE);

    const url = `${GEMINI_BASE_URL}/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI_EMBEDDING_MODEL,
        requests: batch.map(text => ({
          content: { parts: [{ text }] },
        })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `[VectorEmbedder] Erro batch embedding (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const data = await response.json();
    const {embeddings} = data;

    if (!Array.isArray(embeddings)) {
      throw new Error('[VectorEmbedder] Resposta batch invalida');
    }

    for (let j = 0; j < embeddings.length && j < batch.length; j++) {
      const values = embeddings[j]?.values;
      if (Array.isArray(values) && values.length > 0) {
        const idx = batchIndices[j];
        results[idx] = values;
        cacheSet(getCacheKey(batch[j]), values);
      }
    }
  }

  return results as number[][];
}

// ── Similaridade de Cosseno ────────────────────────────────────────────

/**
 * Calcula similaridade de cosseno entre dois vetores de mesma dimensão.
 * Retorna valor entre 0 e 1 para embeddings (vetores não-negativos com normalização L2).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

// ── Detecção de tipo de embedding ──────────────────────────────────────

/**
 * Verifica se o embeddingJson armazenado é um embedding vetorial (768-dim)
 * vs TF-IDF (dimensão variável, tipicamente diferente de 768).
 */
export function isVectorEmbedding(embeddingJson: string): boolean {
  try {
    const arr = JSON.parse(embeddingJson);
    return Array.isArray(arr) && arr.length === EMBEDDING_DIMENSIONS;
  } catch {
    return false;
  }
}

/**
 * Verifica se o embeddingJson contém um embedding TF-IDF (não-vazio, dimensão != 768).
 */
export function isTfidfEmbedding(embeddingJson: string): boolean {
  try {
    const arr = JSON.parse(embeddingJson);
    return Array.isArray(arr) && arr.length > 0 && arr.length !== EMBEDDING_DIMENSIONS;
  } catch {
    return false;
  }
}

// ── Regeneração de embeddings ──────────────────────────────────────────

/**
 * Gera e persiste embeddings vetoriais (Gemini) para todas as KnowledgeEntries de um tenant.
 * Substitui embeddings TF-IDF por vetores semânticos reais.
 *
 * Deve ser chamado quando o dono da pousada salva/edita o conhecimento.
 *
 * @returns Número de embeddings gerados e persistidos
 */
export async function regenerateVectorEmbeddings(tenantId: string): Promise<number> {
  const { db } = await import('@/lib/db');

  const entries = await db.knowledgeEntry.findMany({
    where: { tenantId },
    select: { id: true, question: true, answer: true },
  });

  if (entries.length === 0) return 0;

  const texts = entries.map(e => `${e.question} ${e.answer}`);
  const embeddings = await batchGenerateEmbeddings(texts);

  let count = 0;
  for (let i = 0; i < entries.length; i++) {
    if (embeddings[i]) {
      await db.knowledgeEntry.update({
        where: { id: entries[i].id },
        data: { embeddingJson: JSON.stringify(embeddings[i]) },
      });
      count++;
    }
  }

  return count;
}

// ── Stats ──────────────────────────────────────────────────────────────

export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
  return { size: embeddingCache.size, maxSize: CACHE_MAX_SIZE };
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

export { GEMINI_EMBEDDING_MODEL };