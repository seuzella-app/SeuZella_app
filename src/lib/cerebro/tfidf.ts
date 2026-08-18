// ============================================================================
// ZÉLLA — TF-IDF Retriever (Cérebro Memory Lite)
// ============================================================================
// Implementação own-rolled de TF-IDF (Term Frequency × Inverse Document
// Frequency) para busca semântica de código sem depender de libs externas
// como Upstash Vector ou OpenAI Embeddings.
//
// COMO FUNCIONA:
//  1. Indexa documentos (trechos de código) em uma matriz esparsa TF
//  2. Calcula IDF para cada termo: log(N / (1 + DF)) onde N = total docs
//  3. Para uma query, calcula similaridade cosseno entre query e cada doc
//  4. Retorna top-K documentos mais similares
//
// PREPROCESSING:
//  - Tokeniza código em palavras (split por whitespace + pontuação)
//  - Lowercase
//  - Remove stop-words comuns (function, const, return, etc.)
//  - Stemming simples (remove suffixes -s, -ed, -ing, -tion)
//
// LIMITAÇÕES (aceitas):
//  - Não captura sinônimos (embedding faria, TF-IDF não)
//  - Não entende semântica de código (ex: variável "user" ≠ "guest")
//  - Mas é suficiente para encontrar arquivos relevantes por erro textmatch
//
// Para produção com milhares de arquivos: migrar para pgvector/Upstash Vector.
// ============================================================================

// ── Stop-words (JavaScript/TypeScript keywords) ────────────────────────────

const STOP_WORDS = new Set([
  // JS/TS keywords
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch',
  'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
  'class', 'extends', 'implements', 'interface', 'type', 'enum', 'namespace',
  'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'void',
  'this', 'super', 'static', 'public', 'private', 'protected', 'readonly',
  'abstract', 'declare', 'module', 'require',
  // Common boilerplate
  'true', 'false', 'null', 'undefined', 'number', 'string', 'boolean',
  'object', 'any', 'unknown', 'never', 'void', 'promise', 'array',
  // Single letters
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
]);

// ── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Tokeniza um texto em termos.
 *  - Split por não-palavra (regex)
 *  - Lowercase
 *  - Remove stop-words
 *  - Stemming simples
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  // Lowercase + split por não-palavra
  const rawTokens = text.toLowerCase().match(/[a-z][a-z0-9_]*/g) || [];

  // Filtra stop-words + aplica stemming simples
  const tokens: string[] = [];
  for (const token of rawTokens) {
    if (token.length < 2) continue;
    if (STOP_WORDS.has(token)) continue;
    tokens.push(stem(token));
  }

  return tokens;
}

/**
 * Stemming simples — remove suffixes comuns.
 * Não é Porter/NLTK, mas captura a maioria dos casos.
 */
function stem(word: string): string {
  // Remove plurals
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);

  // Remove verb tenses
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);

  // Remove common suffixes
  if (word.endsWith('tion') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('ment') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('ness') && word.length > 5) return word.slice(0, -4);

  return word;
}

// ── Document type ───────────────────────────────────────────────────────────

export interface TfIdfDocument {
  id: string;
  content: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  doc: TfIdfDocument;
  score: number;
}

// ── TF-IDF Index ────────────────────────────────────────────────────────────

interface IndexedDocument {
  id: string;
  doc: TfIdfDocument;
  /** Token → frequency in this doc (TF) */
  termFreqs: Map<string, number>;
  /** Magnitude of TF vector (for cosine similarity) */
  magnitude: number;
}

export class TfidfIndex {
  private docs: Map<string, IndexedDocument> = new Map();
  /** Term → number of docs containing it (DF) */
  private docFreq: Map<string, number> = new Map();
  /** Cached IDF values */
  private idfCache: Map<string, number> | null = null;

  /**
   * Adiciona um documento ao índice.
   */
  addDocument(doc: TfIdfDocument): void {
    // Remove se já existe (para re-indexação)
    if (this.docs.has(doc.id)) {
      this.removeDocument(doc.id);
    }

    const tokens = tokenize(doc.content);
    const termFreqs = new Map<string, number>();
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
    }

    // Calculate magnitude (sqrt of sum of squared TFs)
    let magnitude = 0;
    for (const count of termFreqs.values()) {
      magnitude += count * count;
    }
    magnitude = Math.sqrt(magnitude);

    const indexed: IndexedDocument = {
      id: doc.id,
      doc,
      termFreqs,
      magnitude,
    };

    this.docs.set(doc.id, indexed);

    // Update document frequency for each unique term
    for (const term of termFreqs.keys()) {
      this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }

    // Invalidate IDF cache
    this.idfCache = null;
  }

  /**
   * Remove documento do índice.
   */
  removeDocument(id: string): void {
    const existing = this.docs.get(id);
    if (!existing) return;

    // Decrement DF for each term
    for (const term of existing.termFreqs.keys()) {
      const df = this.docFreq.get(term);
      if (df === undefined) continue;
      if (df <= 1) {
        this.docFreq.delete(term);
      } else {
        this.docFreq.set(term, df - 1);
      }
    }

    this.docs.delete(id);
    this.idfCache = null;
  }

  /**
   * Calcula IDF para um termo: log(N / (1 + DF))
   * N = total de documentos
   */
  private getIdf(term: string): number {
    if (!this.idfCache) {
      this.idfCache = new Map();
    }
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }

    const N = this.docs.size;
    const df = this.docFreq.get(term) || 0;
    const idf = Math.log(N / (1 + df));
    this.idfCache.set(term, idf);
    return idf;
  }

  /**
   * Busca top-K documentos mais similares à query.
   * Usa similaridade cosseno entre query-TF-IDF e doc-TF-IDF.
   */
  search(query: string, k: number = 5): SearchResult[] {
    if (this.docs.size === 0) return [];

    // Tokenize query
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Build query TF map
    const queryTf = new Map<string, number>();
    for (const token of queryTokens) {
      queryTf.set(token, (queryTf.get(token) || 0) + 1);
    }

    // Calculate query magnitude (for cosine similarity)
    let queryMagnitude = 0;
    for (const count of queryTf.values()) {
      queryMagnitude += count * count;
    }
    queryMagnitude = Math.sqrt(queryMagnitude);

    if (queryMagnitude === 0) return [];

    // For each document, calculate cosine similarity
    const results: SearchResult[] = [];

    for (const indexed of this.docs.values()) {
      let dotProduct = 0;

      for (const [term, queryCount] of queryTf.entries()) {
        const docCount = indexed.termFreqs.get(term);
        if (!docCount) continue;

        const idf = this.getIdf(term);
        const queryWeight = queryCount * idf;
        const docWeight = docCount * idf;
        dotProduct += queryWeight * docWeight;
      }

      if (dotProduct === 0 || indexed.magnitude === 0) continue;

      // Cosine similarity = dotProduct / (queryMag * docMag)
      const score = dotProduct / (queryMagnitude * indexed.magnitude);
      results.push({ doc: indexed.doc, score });
    }

    // Sort by score descending and take top-K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Estatísticas do índice (para dashboard).
   */
  getStats(): {
    totalDocs: number;
    totalTerms: number;
    avgDocLength: number;
  } {
    let totalTokens = 0;
    for (const doc of this.docs.values()) {
      for (const count of doc.termFreqs.values()) {
        totalTokens += count;
      }
    }
    return {
      totalDocs: this.docs.size,
      totalTerms: this.docFreq.size,
      avgDocLength: this.docs.size > 0 ? Math.round(totalTokens / this.docs.size) : 0,
    };
  }

  /**
   * Limpa o índice.
   */
  clear(): void {
    this.docs.clear();
    this.docFreq.clear();
    this.idfCache = null;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singletonIndex: TfidfIndex | null = null;

export function getTfidfIndex(): TfidfIndex {
  if (!singletonIndex) {
    singletonIndex = new TfidfIndex();
  }
  return singletonIndex;
}
