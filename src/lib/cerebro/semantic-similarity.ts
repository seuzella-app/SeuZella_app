// ============================================================================
// ZÉLLA — Semantic Similarity Helper (DPO Enhancement)
// ============================================================================
// Helper utilities para calcular similaridade semântica entre duas strings,
// complementando o Levenshtein distance usado em dpo-collector.ts.
//
// PROBLEM:
//  Levenshtein é puramente sintático (caractere-por-caractere).
//  Duas respostas podem ser semanticamente idênticas mas ter Levenshtein alto
//  (ex: "Claro! O check-in é às 14h" vs "Sim, pode fazer check-in a partir das 14h").
//
// SOLUTION:
//  Calcular TF-IDF cosine similarity entre chosen e rejected.
//  - Score alto (>0.85): edições triviais — provavelmente estilo, não semântica
//  - Score médio (0.3-0.85): refatoração real — VALE como DPO pair
//  - Score baixo (<0.3): reescrita total — fora de contexto, não vale
//
// Esta implementação é ZERO-DEPENDENCY (sem transformers.js, sem embeddings).
// Para análise mais profunda, futuramente pode-se usar embeddings (CodeBERT,
// BGE-M3) via API externa. Por ora, TF-IDF é suficiente e roda em <1ms.
// ============================================================================

/**
 * Tokeniza uma string em palavras normalizadas.
 * - Lowercase
 * - Remove pontuação
 * - Remove stopwords PT-BR + EN básicas
 * - Remove acentos
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // Normaliza: lowercase, remove acentos, remove pontuação
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const tokens = normalized.split(' ');

  // Stopwords PT-BR + EN (lista compacta, suficiente para filtering)
  const STOPWORDS = new Set([
    // PT-BR
    'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou', 'um', 'uma',
    'para', 'por', 'com', 'sem', 'no', 'na', 'nos', 'nas', 'em', 'que', 'se',
    'é', 'são', 'foi', 'ser', 'estar', 'tem', 'ter', 'mas', 'como', 'mais',
    'menos', 'muito', 'pouco', 'já', 'não', 'sim', 'ao', 'aos', 'pelo', 'pela',
    'este', 'essa', 'isso', 'aquele', 'aquela', 'aquilo', 'sua', 'seu', 'minha',
    'meu', 'nossa', 'nosso', 'voc', 'sobre', 'at', 'aps', 'antes',
    // EN
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'in',
    'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into',
    'through', 'during', 'before', 'after', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
    'them', 'my', 'your', 'his', 'its', 'our', 'their', 'as',
  ]);

  return tokens.filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Calcula TF (Term Frequency) para uma lista de tokens.
 * Retorna Map<token, frequência>.
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normaliza pelo total de tokens
  const total = tokens.length;
  if (total > 0) {
    for (const [k, v] of tf) {
      tf.set(k, v / total);
    }
  }
  return tf;
}

/**
 * Calcula IDF (Inverse Document Frequency) para um corpus de 2 documentos.
 * IDF(token) = log(N / df) onde N=2, df= documentos que contêm o token (1 ou 2).
 *
 * Para 2 documentos:
 *  - Token em ambos: idf = log(2/2) = 0 (não discrimina)
 *  - Token em apenas 1: idf = log(2/1) ≈ 0.693 (alta discriminação)
 */
export function inverseDocFrequency(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const N = docs.length;

  for (const doc of docs) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, freq] of df) {
    // +1 smoothing para evitar divisão por zero e log(0)
    idf.set(token, Math.log((N + 1) / (freq + 1)) + 1);
  }

  return idf;
}

/**
 * Calcula TF-IDF vector para um documento.
 */
export function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = termFrequency(tokens);
  const vec = new Map<string, number>();
  for (const [token, tfVal] of tf) {
    const idfVal = idf.get(token) ?? 0;
    vec.set(token, tfVal * idfVal);
  }
  return vec;
}

/**
 * Calcula cosine similarity entre dois vetores TF-IDF.
 * Similarity = (A · B) / (||A|| × ||B||)
 */
export function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Dot product (sobre interseção de chaves)
  for (const [k, vA] of vecA) {
    const vB = vecB.get(k);
    if (vB !== undefined) {
      dotProduct += vA * vB;
    }
    normA += vA * vA;
  }

  for (const [, vB] of vecB) {
    normB += vB * vB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calcula similaridade semântica TF-IDF cosine entre duas strings.
 *
 * @param textA Primeira string (ex: chosen response)
 * @param textB Segunda string (ex: rejected response)
 * @returns Score 0-1 (1 = semanticamente idênticas)
 */
export function semanticSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;
  if (textA === textB) return 1;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // IDF calculado sobre o corpus de 2 documentos
  const idf = inverseDocFrequency([tokensA, tokensB]);

  const vecA = tfidfVector(tokensA, idf);
  const vecB = tfidfVector(tokensB, idf);

  return cosineSimilarity(vecA, vecB);
}

/**
 * Calcula similaridade combinada (Levenshtein + TF-IDF cosine).
 *
 * Estratégia:
 *  - Se TF-IDF cosine > 0.9: muito similares semanticamente (provável edição trivial)
 *  - Se TF-IDF cosine < 0.2: semanticamente diferentes (provável reescrita total)
 *  - Caso contrário: útil como DPO pair — retorna média ponderada
 *
 * @param rejected Texto rejeitado
 * @param chosen Texto escolhido
 * @param levenshteinSimilarity Score Levenshtein (1 - distância/maxLen)
 * @returns Score combinado 0-1
 */
export function combinedSimilarity(
  rejected: string,
  chosen: string,
  levenshteinSimilarity: number
): { score: number; semanticScore: number; shouldKeepAsDpo: boolean; reason: string } {
  const semanticScore = semanticSimilarity(rejected, chosen);

  // Score combinado: média geométrica
  const score = Math.sqrt(levenshteinSimilarity * semanticScore);

  // Decisão de filtro (substitui o filtro 0.15-0.85 do dpo-collector original)
  let shouldKeepAsDpo = true;
  let reason = '';

  if (semanticScore > 0.9 && levenshteinSimilarity > 0.85) {
    // Editção trivial — não agrega valor
    shouldKeepAsDpo = false;
    reason = 'EDICAO_TRIVIAL_SEMANTICA';
  } else if (semanticScore < 0.15) {
    // Reescrita total — fora de contexto
    shouldKeepAsDpo = false;
    reason = 'REESCRITA_FORA_DE_CONTEXTO_SEMANTICA';
  } else if (semanticScore > 0.7 && levenshteinSimilarity < 0.3) {
    // Mesmo significado, palavras diferentes — excelente DPO pair
    shouldKeepAsDpo = true;
    reason = 'PARAFRASE_RICA_DPO_VALIOSO';
  } else {
    reason = 'DPO_PADRAO_ACEITO';
  }

  return {
    score: Math.round(score * 1000) / 1000,
    semanticScore: Math.round(semanticScore * 1000) / 1000,
    shouldKeepAsDpo,
    reason,
  };
}
