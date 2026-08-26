/**  
 * Semantic RAG — Retrieval-Augmented Generation com Vector Embeddings  
 *  
 * MIGRADO de TF-IDF para embeddings vetoriais reais (Gemini text-embedding-004).  
 *  
 * Pipeline:  
 * 1. Carregar TODOS os KnowledgeEntry do tenant  
 * 2. Verificar tipo de embedding armazenado:  
 *    - Vector (768-dim Gemini) → busca por cosseno vetorial (PREFERIDO)  
 *    - TF-IDF (dimensão variável) → busca TF-IDF (FALLBACK)  
 *    - Vazio → gera embeddings vetoriais on-the-fly e persiste  
 * 3. Busca as K entradas mais relevantes ao contexto da dúvida  
 * 4. Formata o contexto enriquecido para o LLM  
 *  
 * Benefícios vs TF-IDF:  
 * - Compreensão semântica real (sinônimos, paráfrases, contexto)  
 * - Similaridade cross-lingual (português informal → conhecimento formal)  
 * - Precisão muito maior para queries complexas  
 * - Custo: ~$0.000018/embedding (praticamente gratuito)  
 *  
 * Armazenamento:  
 * - Vetores de 768 dimensões no campo `embeddingJson` (mesmo campo do TF-IDF)  
 * - Detecção automática: 768-dim = vector, demais = TF-IDF  
 */

import { db } from '@/lib/db';
import {
  generateEmbedding,
  batchGenerateEmbeddings,
  cosineSimilarity,
  isVectorEmbedding,
  EMBEDDING_DIMENSIONS,
} from './vector-embedder';
import { createTfidfEngine } from './embedder';

// ── Tipos ───────────────────────────────────────────────────────────

export interface RAGResult {
  /** Entradas de conhecimento relevantes, ordenadas por score */
  entries: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    score: number;
  }>;
  /** Número total de entradas no conhecimento do tenant */
  totalKnowledgeEntries: number;
  /** Tamanho do vocabulário TF-IDF (0 para vector) */
  vocabSize: number;
  /** Tempo de busca em ms */
  searchTimeMs: number;
  /** Tipo de embedding usado nesta busca */
  embeddingType: 'vector' | 'tfidf' | 'none';
  /** v2.0: Threshold adaptativo usado (apenas para vector) */
  adaptiveThreshold?: number;
}

// ── Constantes ───────────────────────────────────────────────────────

const DEFAULT_TOP_K = 4;
const VECTOR_MIN_SIMILARITY_BASE = 0.3; // Threshold base para embeddings vetoriais
const TFIDF_MIN_SIMILARITY = 0.05; // Threshold para TF-IDF (mais permissivo)

// v2.0: Adaptive RAG Threshold
// Quando a base de conhecimento cresce, o threshold aumenta para reduzir ruído.
// Inspirado em online-learning (adaptive algorithms do awesome-machine-learning).
// Fórmula: threshold = base + log10(1 + totalEntries / 20) * 0.05
function getAdaptiveVectorThreshold(totalEntries: number): number {
  if (totalEntries <= 20) return VECTOR_MIN_SIMILARITY_BASE;
  const adaptive = VECTOR_MIN_SIMILARITY_BASE + Math.log10(1 + totalEntries / 20) * 0.05;
  return Math.min(0.55, adaptive); // Cap em 0.55 para nunca ser excessivamente restritivo
}

// ── Função principal ─────────────────────────────────────────────────

/**  
 * Busca as entradas de conhecimento mais relevantes para a query do hóspede.  
 * Usa embeddings vetoriais quando disponíveis, TF-IDF como fallback.  
 *  
 * @param tenantId - ID do tenant (pousada)  
 * @param query - Mensagem do hóspede  
 * @param topK - Número máximo de resultados (default: 4)  
 * @returns RAGResult com entradas relevantes  
 */  
export async function retrieveRelevantKnowledge(  
  tenantId: string,  
  query: string,  
  topK = DEFAULT_TOP_K,  
): Promise<RAGResult> {  
  const startTime = Date.now();

  // 1. Carregar todas as KnowledgeEntry do tenant  
  const allEntries = await db.knowledgeEntry.findMany({  
    where: { tenantId },  
    select: {  
      id: true,  
      question: true,  
      answer: true,  
      category: true,  
      embeddingJson: true,  
    },  
  });

  if (allEntries.length === 0) {  
    return {  
      entries: [],  
      totalKnowledgeEntries: 0,  
      vocabSize: 0,  
      searchTimeMs: Date.now() - startTime,  
      embeddingType: 'none',
    };  
  }

  // 2. Classificar entradas por tipo de embedding
  const vectorEntries: typeof allEntries = [];
  const tfidfEntries: typeof allEntries = [];
  const noEmbeddingEntries: typeof allEntries = [];

  for (const entry of allEntries) {
    const raw = entry.embeddingJson || '[]';
    if (isVectorEmbedding(raw)) {
      vectorEntries.push(entry);
    } else if (raw !== '[]') {
      tfidfEntries.push(entry);
    } else {
      noEmbeddingEntries.push(entry);
    }
  }

  // 3. Se temos embeddings vetoriais, usar busca vetorial (PREFERIDO)
  if (vectorEntries.length > 0) {
    return await searchWithVectorEmbeddings(
      vectorEntries,
      query,
      topK,
      startTime,
      allEntries.length,
    );
  }

  // 4. Se há entradas sem embedding e GEMINI_API_KEY disponível, gerar embeddings
  if (noEmbeddingEntries.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const texts = noEmbeddingEntries.map(e => `${e.question} ${e.answer}`);
      const embeddings = await batchGenerateEmbeddings(texts);

      // Persistir embeddings gerados (fire-and-forget)
      const newlyVectorized: typeof allEntries = [];
      for (let i = 0; i < noEmbeddingEntries.length; i++) {
        if (embeddings[i]) {
          const entry = noEmbeddingEntries[i];
          const vectorJson = JSON.stringify(embeddings[i]);
          // Update in background
          db.knowledgeEntry.update({
            where: { id: entry.id },
            data: { embeddingJson: vectorJson },
          }).catch(err =>
            console.error('[SemanticRAG] Falha ao persistir embedding:', err),
          );
          newlyVectorized.push({ ...entry, embeddingJson: vectorJson });
        }
      }

      // Se conseguimos gerar embeddings, usar busca vetorial
      if (newlyVectorized.length > 0) {
        // Combine with any TF-IDF entries
        const allForSearch = [...newlyVectorized, ...tfidfEntries];
        return await searchWithVectorEmbeddings(
          newlyVectorized,
          query,
          topK,
          startTime,
          allEntries.length,
        );
      }
    } catch (err) {
      console.warn('[SemanticRAG] Falha na geração de embeddings vetoriais, usando TF-IDF:', err);
    }
  }

  // 5. Fallback: TF-IDF (abordagem original)
  return await searchWithTfIdf(
    allEntries,
    query,
    topK,
    startTime,
    allEntries.length,
  );
}

// ── Busca vetorial ────────────────────────────────────────────────────

async function searchWithVectorEmbeddings(
  entries: Array<{ id: string; question: string; answer: string; category: string; embeddingJson: string }>,
  query: string,
  topK: number,
  startTime: number,
  totalEntries: number,
): Promise<RAGResult> {
  // v2.0: Adaptive threshold baseado no tamanho da KB
  const vectorMinSimilarity = getAdaptiveVectorThreshold(totalEntries);

  // Gerar embedding para a query
  let queryVector: number[];
  try {
    queryVector = await generateEmbedding(query);
  } catch (err) {
    console.warn('[SemanticRAG] Falha ao gerar embedding da query, retorno vazio:', err);
    return {
      entries: [],
      totalKnowledgeEntries: totalEntries,
      vocabSize: 0,
      searchTimeMs: Date.now() - startTime,
      embeddingType: 'vector',
      adaptiveThreshold: vectorMinSimilarity,
    };
  }

  // Calcular similaridade para cada entrada
  const scored: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    score: number;
  }> = [];

  for (const entry of entries) {
    let entryVector: number[];
    try {
      entryVector = JSON.parse(entry.embeddingJson || '[]');
    } catch {
      continue;
    }

    if (!Array.isArray(entryVector) || entryVector.length !== EMBEDDING_DIMENSIONS) {
      continue;
    }

    const score = cosineSimilarity(queryVector, entryVector);
    if (score >= vectorMinSimilarity) {
      scored.push({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        score,
      });
    }
  }

  // Ordenar por score e limitar a topK
  const filtered = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Atualizar lastUsed e usage das entradas retornadas
  if (filtered.length > 0) {
    const ids = filtered.map(r => r.id);
    db.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: {
        lastUsed: new Date(),
        usage: { increment: 1 },
      },
    }).catch(err => console.error('[SemanticRAG] Falha ao atualizar usage:', err));
  }

  return {
    entries: filtered,
    totalKnowledgeEntries: totalEntries,
    vocabSize: 0,
    searchTimeMs: Date.now() - startTime,
    embeddingType: 'vector',
    adaptiveThreshold: vectorMinSimilarity,
  };
}

// ── Busca TF-IDF (fallback) ──────────────────────────────────────────

async function searchWithTfIdf(
  allEntries: Array<{ id: string; question: string; answer: string; category: string; embeddingJson?: string }>,
  query: string,
  topK: number,
  startTime: number,
  totalEntries: number,
): Promise<RAGResult> {
  const engine = createTfidfEngine(
    allEntries.map(e => ({
      id: e.id,
      question: e.question,
      answer: e.answer,
    })),
  );

  const searchHits = engine.search(query, topK * 2, TFIDF_MIN_SIMILARITY);
  const entryMap = new Map(allEntries.map(e => [e.id, e]));

  const results = searchHits
    .map(hit => {
      const entry = entryMap.get(hit.id);
      return {
        id: hit.id,
        question: entry?.question ?? '',
        answer: entry?.answer ?? '',
        category: entry?.category ?? 'custom',
        score: hit.score,
      };
    })
    .filter(r => r.score >= TFIDF_MIN_SIMILARITY)
    .slice(0, topK);

  // Atualizar lastUsed e usage
  if (results.length > 0) {
    const ids = results.map(r => r.id);
    db.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: {
        lastUsed: new Date(),
        usage: { increment: 1 },
      },
    }).catch(err => console.error('[SemanticRAG] Falha ao atualizar usage:', err));
  }

  return {
    entries: results,
    totalKnowledgeEntries: totalEntries,
    vocabSize: engine.getVocabSize(),
    searchTimeMs: Date.now() - startTime,
    embeddingType: 'tfidf',
  };
}

// ── Formatação ───────────────────────────────────────────────────────

/**  
 * Formata o resultado do RAG em string para injetar no prompt do LLM.  
 * Se não houver resultados relevantes, retorna string vazia.  
 */  
export function formatRAGContext(rag: RAGResult): string {  
  if (rag.entries.length === 0) return '';

  const sections = rag.entries.map((entry, i) => {  
    const categoryLabel: Record<string, string> = {  
      pricing: 'Preços',  
      rooms: 'Quartos',  
      amenities: 'Servicos',  
      policies: 'Politicas',  
      location: 'Localizacao',  
      activities: 'Atividades',  
      food: 'Alimentacao',  
      custom: 'Geral',  
    };
    const label = categoryLabel[entry.category] || 'Geral';

    return `${i + 1}. [${label}]\n   Pergunta: ${entry.question}\n   Resposta: ${entry.answer}`;  
  });

  return `Base de conhecimento (top ${rag.entries.length} mais relevantes):\n\n${sections.join('\n\n')}`;  
}