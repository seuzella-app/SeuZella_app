// ============================================================================
// ZÉLLA — RefactorSuggester (Cérebro Self-Improvement)
// ============================================================================
// Esta é a capacidade de APRENDIZADO AVANÇADO do Cérebro:
//
//  Quando um erro recorrente é detectado (mesmo errorHash 5+ vezes em 24h),
//  o RefactorSuggester:
//   1. Busca no codebase via TF-IDF o trecho de código relevante
//   2. Lê o arquivo completo para contexto
//   3. Manda para GLM 5.2 com prompt rico:
//      "Analise este erro recorrente + este código + este contexto.
//       Proponha refatoração com diff (currentCode → proposedCode)."
//   4. Salva em RefactorSuggestion com status='pending_review'
//   5. Em live mode + confidence alta: alerta diretoria via Slack
//
// MODO MOCK (padrão):
//  - Não chama GLM 5.2 (economiza tokens)
//  - Retorna sugestão template baseada no tipo de erro
//  - Persiste RefactorSuggestion com mode='mock'
//
// MODO LIVE (CEREBRO_LIVE_MODE=true + GLM_5_2_API_KEY):
//  - Chama GLM 5.2 com JSON mode para output estruturado
//  - Prompt engineering: define role, formato, anti-patterns
//  - Custo: ~$0.005 por sugestão (15k input + 2k output tokens)
//
// AUTO-APRENDIZADO:
//  - Quando humano aprova/rejeita uma sugestão, o feedback é salvo como
//    KnowledgeChunk com source='refactor_applied' ou source='refactor_rejected'
//  - Em futuras sugestões, o Cérebro consulta esses chunks para aprender
//    quais padrões de sugestão funcionam vs quais o humano rejeita
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode, type RefactorSuggestionResult } from './types';
import { searchCodebase, readCodeSnippet, ensureIndexLoaded } from './code-indexer';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';

// ── Configuração ────────────────────────────────────────────────────────────

interface RefactorSuggesterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  /** Threshold de ocorrências para considerar erro "recorrente" (default 5) */
  recurringErrorThreshold: number;
  /** Quantos chunks de código buscar no TF-IDF (default 3) */
  contextChunksCount: number;
  /** Linhas de padding ao redor do erro para incluir no context (default 20) */
  contextPaddingLines: number;
}

function loadConfig(): RefactorSuggesterConfig {
  return {
    apiKey: process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-5.2',
    temperature: 0.4, // slightly higher para creative refactoring ideas
    maxTokens: 3000,
    recurringErrorThreshold: parseInt(process.env.CEREBRO_RECURRING_ERROR_THRESHOLD || '5', 10),
    contextChunksCount: 3,
    contextPaddingLines: 20,
  };
}

// ── RefactorSuggester Class ─────────────────────────────────────────────────

export class RefactorSuggester {
  private readonly config: RefactorSuggesterConfig;
  private readonly mode: 'mock' | 'live';

  constructor() {
    this.config = loadConfig();
    this.mode = getCerebroMode();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN: suggestRefactor
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Gera sugestão de refatoração para um erro recorrente.
   *
   * Fluxo:
   *  1. Busca no codebase via TF-IDF por trechos relacionados ao erro
   *  2. Lê trechos de código completos do filesystem
   *  3. Em mock: retorna sugestão template
   *  4. Em live: chama GLM 5.2 com prompt rico + contexto
   *  5. Persiste em RefactorSuggestion
   *
   * @param errorHash Hash do erro recorrente (agrupa erros similares)
   * @param errorMessage Mensagem de erro representativa
   * @param stackTrace Stack trace (opcional)
   * @param occurrencesCount Quantas vezes ocorreu nas últimas 24h
   * @param recentErrors Amostra de eventos recentes (para contexto)
   */
  async suggestRefactor(params: {
    errorHash: string;
    errorMessage: string;
    stackTrace?: string;
    occurrencesCount: number;
    recentErrors?: Array<{ module: string; event: string; message: string; timestamp: string }>;
  }): Promise<RefactorSuggestionResult & { suggestionId?: string }> {
    const { errorHash, errorMessage, stackTrace, occurrencesCount, recentErrors } = params;

    logSink.info({
      module: 'refactor-suggester',
      event: 'suggestion_started',
      message: `Iniciando sugestão de refatoração para erro ${errorHash} (${occurrencesCount} ocorrências)`,
      context: {
        errorHash,
        occurrencesCount,
        mode: this.mode,
        hasStackTrace: !!stackTrace,
      },
    });

    // ── 1. Busca no codebase trechos relevantes ──
    const searchQuery = `${errorMessage} ${stackTrace || ''}`;
    const codeChunks = await searchCodebase(searchQuery, this.config.contextChunksCount);

    if (codeChunks.length === 0) {
      logSink.warn({
        module: 'refactor-suggester',
        event: 'no_code_found',
        message: `Nenhum trecho de código encontrado para erro ${errorHash} — KnowledgeChunk vazio?`,
        context: { errorHash, searchQuery: searchQuery.substring(0, 200) },
      });
    }

    // ── 2. Para cada chunk encontrado, lê contexto expandido do arquivo ──
    const codeContext = codeChunks.map(chunk => {
      const startLine = Math.max(1, chunk.startLine - this.config.contextPaddingLines);
      const endLine = chunk.endLine + this.config.contextPaddingLines;
      const expandedContent = readCodeSnippet(chunk.filePath, startLine, endLine);

      return {
        filePath: chunk.filePath,
        startLine,
        endLine,
        content: expandedContent || chunk.content,
        relevanceScore: chunk.score,
      };
    });

    // ── 3. Gera sugestão (mock ou live) ──
    let suggestion: RefactorSuggestionResult;

    if (this.mode === 'mock' || !this.config.apiKey) {
      suggestion = await this.generateMockSuggestion(errorHash, errorMessage, occurrencesCount, codeContext);
    } else {
      try {
        suggestion = await this.generateLiveSuggestion(
          errorHash, errorMessage, stackTrace, occurrencesCount, codeContext, recentErrors
        );
      } catch (err) {
        logSink.error({
          module: 'refactor-suggester',
          event: 'live_suggestion_failed',
          message: `GLM 5.2 falhou para erro ${errorHash} — fallback para mock`,
          error: err,
        });
        suggestion = await this.generateMockSuggestion(errorHash, errorMessage, occurrencesCount, codeContext);
      }
    }

    // ── 4. Persiste em RefactorSuggestion ──
    const savedSuggestion = await db.refactorSuggestion.create({
      data: {
        sourceErrorHash: errorHash,
        filePath: codeContext[0]?.filePath || 'unknown',
        lineRange: codeContext[0]
          ? `${codeContext[0].startLine}-${codeContext[0].endLine}`
          : '0-0',
        currentCode: codeContext[0]?.content || '',
        proposedCode: suggestion.proposedCode,
        rationale: suggestion.rationale,
        status: 'pending_review',
        confidence: suggestion.confidence,
        mode: suggestion.mode,
      },
    });

    logSink.info({
      module: 'refactor-suggester',
      event: 'suggestion_persisted',
      message: `Sugestão ${savedSuggestion.id} persistida — mode: ${suggestion.mode}, confidence: ${suggestion.confidence}`,
      context: {
        suggestionId: savedSuggestion.id,
        errorHash,
        filePath: savedSuggestion.filePath,
        lineRange: savedSuggestion.lineRange,
        confidence: suggestion.confidence,
        mode: suggestion.mode,
      },
    });

    return {
      ...suggestion,
      suggestionId: savedSuggestion.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MOCK: gera sugestão template (sem LLM)
  // ═══════════════════════════════════════════════════════════════════════

  private async generateMockSuggestion(
    errorHash: string,
    errorMessage: string,
    occurrencesCount: number,
    codeContext: Array<{ filePath: string; startLine: number; endLine: number; content: string; relevanceScore: number }>
  ): Promise<RefactorSuggestionResult> {
    const topMatch = codeContext[0];

    // Heurística por tipo de erro
    let rationale = '';
    let proposedCode = '';
    let confidence = 0.3;

    if (errorMessage.includes('Cannot read properties of undefined') || errorMessage.includes('null is not')) {
      rationale = `Erro de "undefined/null access" recorrente (${occurrencesCount}x). Provável causa: falta de validação antes de acessar propriedade. Recomendação: adicionar optional chaining (?.) ou null check explícito.`;
      proposedCode = `// ANTES:\n${topMatch?.content || '// código não disponível'}\n\n// DEPOIS (sugestão mock):\n// Adicione validação antes de acessar propriedades:\nif (!obj) return null;\nreturn obj?.property?.nestedProp ?? defaultValue;`;
      confidence = 0.5;
    } else if (errorMessage.includes('PrismaClient') || errorMessage.includes('prisma')) {
      rationale = `Erro do Prisma recorrente (${occurrencesCount}x). Provável causa: conexão com DB instável em serverless ou query mal formada. Recomendação: garantir $disconnect em finally block ou usar select explícito.`;
      proposedCode = `// ANTES:\n${topMatch?.content || '// código não disponível'}\n\n// DEPOIS (sugestão mock):\ntry {\n  const result = await db.entity.findUnique({\n    where: { id },\n    select: { ... }, // explícito para evitar campos sensíveis\n  });\n  return result;\n} finally {\n  // Garantir cleanup em serverless\n}`;
      confidence = 0.6;
    } else if (errorMessage.includes('fetch') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      rationale = `Erro de rede/timeout recorrente (${occurrencesCount}x). Provável causa: API externa instável sem retry/backoff. Recomendação: implementar retry exponencial com jitter.`;
      proposedCode = `// ANTES:\n${topMatch?.content || '// código não disponível'}\n\n// DEPOIS (sugestão mock):\nasync function fetchWithRetry(url: string, retries = 3): Promise<Response> {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url, { signal: AbortSignal.timeout(5000) });\n    } catch (err) {\n      if (i === retries - 1) throw err;\n      await new Promise(r => setTimeout(r, 1000 * 2 ** i + Math.random() * 500));\n    }\n  }\n  throw new Error('unreachable');\n}`;
      confidence = 0.7;
    } else if (errorMessage.includes('RateLimit') || errorMessage.includes('429')) {
      rationale = `Rate limit excedido (${occurrencesCount}x). Provável causa: falta de controle de taxa em endpoint sensível. Recomendação: usar @upstash/ratelimit (sliding window).`;
      proposedCode = `// ANTES:\n${topMatch?.content || '// código não disponível'}\n\n// DEPOIS (sugestão mock):\nimport { Ratelimit } from '@upstash/ratelimit';\nimport { Redis } from '@upstash/redis';\n\nconst ratelimit = new Ratelimit({\n  redis: Redis.fromEnv(),\n  limiter: Ratelimit.slidingWindow(10, '1 m'),\n});\n\nconst { success } = await ratelimit.limit(ip);\nif (!success) return new Response('Rate limited', { status: 429 });`;
      confidence = 0.65;
    } else {
      rationale = `Erro recorrente detectado (${occurrencesCount}x em 24h) mas classificação automática inconclusiva. Sugestão genérica: adicionar try/catch robusto + logging estruturado.`;
      proposedCode = `// ANTES:\n${topMatch?.content || '// código não disponível'}\n\n// DEPOIS (sugestão mock):\n// Adicione try/catch + log estruturado para diagnóstico:\ntry {\n  // código original\n} catch (error) {\n  console.error('[module:event]', { error, context: { /* relevante */ } });\n  throw error; // ou retornar fallback gracioso\n}`;
      confidence = 0.4;
    }

    return {
      sourceErrorHash: errorHash,
      filePath: topMatch?.filePath || 'unknown',
      lineRange: topMatch ? `${topMatch.startLine}-${topMatch.endLine}` : '0-0',
      currentCode: topMatch?.content || '// código não disponível em mock mode',
      proposedCode,
      rationale,
      confidence,
      mode: 'mock',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIVE: chama GLM 5.2 com prompt rico + contexto de código
  // ═══════════════════════════════════════════════════════════════════════

  private async generateLiveSuggestion(
    errorHash: string,
    errorMessage: string,
    stackTrace: string | undefined,
    occurrencesCount: number,
    codeContext: Array<{ filePath: string; startLine: number; endLine: number; content: string; relevanceScore: number }>,
    recentErrors?: Array<{ module: string; event: string; message: string; timestamp: string }>
  ): Promise<RefactorSuggestionResult> {
    const topMatch = codeContext[0];

    // ── Carrega knowledge de sugestões anteriores (auto-aprendizado) ──
    const pastSuggestions = await db.refactorSuggestion.findMany({
      where: {
        status: { in: ['approved', 'applied', 'rejected'] },
        filePath: topMatch?.filePath || undefined,
      },
      select: { filePath: true, rationale: true, status: true, proposedCode: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    const systemPrompt = `Você é o Cérebro Zélla, supervisor técnico autônomo do SaaS SeuZélla. Sua tarefa: analisar um erro recorrente no código-fonte e propor uma refatoração específica com diff.

REGRAS:
1. Analise o erro + o código atual + contexto
2. Proponha refatoração ESPECÍFICA (não genérica) — diff real com changes concretas
3. Explique a RAZÃO da mudança (rationale) — por que vai resolver o erro?
4. confidence: 0-1 (0 = chute, 1 = certeza absoluta de que vai resolver)
5. Se o erro NÃO é de código (ex: config, infra, ambiente), diga explicitamente
6. Em PT-BR
7. Output DEVE ser JSON válido no formato abaixo

DIRETIVA PONYTAIL — CONCISÃO OBRIGATÓRIA:
- Escreva o MENOR código possível que resolva o erro completamente
- Elimine boilerplate desnecessário, comentários óbvios, variáveis intermediárias que não agregam
- Prefira 1 linha bem escrita a 10 linhas verbosas
- Se o código original tem 50 linhas e a solução cabe em 5, proponha 5
- NUNCA adicione try/catch desnecessário — só adicione se o erro for tratável
- NUNCA adicione validação que não previne o erro reportado
- NUNCA adicione comentários explicando o óbvio (ex: // cria o usuário)
- Use optional chaining (?.), nullish coalescing (??), e destructuring para reduzir linhas
- Se uma função utilitária já existe no código, REUSE — não reescreva
- Métrica de sucesso: proposed_code deve ser ≥30% menor que currentCode

APRENDIZADO:
${pastSuggestions.length > 0
  ? `Você já sugeriu refatorações para este arquivo antes. Aprenda com o feedback humano:
${JSON.stringify(pastSuggestions.map(s => ({ status: s.status, rationale: s.rationale?.substring(0, 200) })), null, 2)}`
  : 'Sem histórico de sugestões para este arquivo.'}

OUTPUT JSON (obrigatório):
{
  "rationale": "string - explicação técnica de por que a refatoração resolve o erro",
  "proposed_code": "string - código refatorado completo (não só diff, mas arquivo inteiro)",
  "confidence": "number - 0 a 1",
  "anti_patterns_avoided": "string[] - lista de problemas comuns que evitou (ex: 'race condition', 'null pointer', 'memory leak')"
}`;

    const userPrompt = `Analise este erro recorrente:

ERRO:
${errorMessage}

STACK TRACE:
${stackTrace || '(não disponível)'}

OCORRÊNCIAS NAS ÚLTIMAS 24H: ${occurrencesCount}

EVENTOS RECENTES (amostra):
${JSON.stringify(recentErrors || [], null, 2)}

CÓDIGO ATUAL (arquivo: ${topMatch?.filePath || 'unknown'}, linhas ${topMatch?.startLine || 0}-${topMatch?.endLine || 0}):
\`\`\`
${topMatch?.content || '// código não disponível'}
\`\`\`

${codeContext.length > 1 ? `OUTROS TRECHOS RELEVANTES:
${codeContext.slice(1).map((c, i) => `--- (${i + 2}) ${c.filePath}:${c.startLine}-${c.endLine} (score: ${c.relevanceScore.toFixed(3)}) ---
\`\`\`
${c.content}
\`\`\``).join('\n\n')}` : ''}

Proponha a refatoração que resolve o erro recorrente. Responda em JSON estruturado conforme especificado.`;

    const messages: AdapterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const startTime = Date.now();

    const response = await callOpenAICompatible({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      jsonMode: true,
    });

    const latencyMs = Date.now() - startTime;
    const costUsd = (response.inputTokens / 1000) * 0.00140 + (response.outputTokens / 1000) * 0.00440;

    // Parse JSON response
    const parsed = this.parseRefactorResponse(response.content);

    logSink.info({
      module: 'refactor-suggester',
      event: 'live_suggestion_complete',
      message: `Sugestão live gerada em ${latencyMs}ms — confidence: ${parsed.confidence}`,
      context: {
        latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costUsd,
        confidence: parsed.confidence,
        antiPatternsAvoided: parsed.anti_patterns_avoided,
        contextChunks: codeContext.length,
      },
    });

    return {
      sourceErrorHash: errorHash,
      filePath: topMatch?.filePath || 'unknown',
      lineRange: topMatch ? `${topMatch.startLine}-${topMatch.endLine}` : '0-0',
      currentCode: topMatch?.content || '// código não disponível',
      proposedCode: parsed.proposed_code,
      rationale: parsed.rationale,
      confidence: parsed.confidence,
      mode: 'live',
    };
  }

  /**
   * Parseia resposta JSON do GLM 5.2 com fallback.
   */
  private parseRefactorResponse(content: string): {
    rationale: string;
    proposed_code: string;
    confidence: number;
    anti_patterns_avoided?: string[];
  } {
    try {
      const parsed = JSON.parse(content);
      return {
        rationale: parsed.rationale || 'Sem justificativa fornecida',
        proposed_code: parsed.proposed_code || '// Sem código proposto',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        anti_patterns_avoided: parsed.anti_patterns_avoided,
      };
    } catch {
      // Tenta extrair JSON de dentro do texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // fallback final
        }
      }

      return {
        rationale: content.substring(0, 500),
        proposed_code: '// Resposta LLM não estruturada — revisar manualmente',
        confidence: 0.2,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-APRENDIZADO: registar feedback humano
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Registra feedback humano sobre uma sugestão.
   *
   * Quando humano aprova/rejeita, salvamos como KnowledgeChunk para que
   * futuras sugestões possam aprender com este feedback.
   */
  async recordFeedback(
    suggestionId: string,
    status: 'approved' | 'rejected' | 'applied',
    reviewerEmail: string,
    notes?: string
  ): Promise<void> {
    // 1. Atualiza RefactorSuggestion
    const suggestion = await db.refactorSuggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        reviewNotes: notes,
        reviewedAt: new Date(),
        reviewedBy: reviewerEmail,
      },
    });

    // 2. Salva como KnowledgeChunk para auto-aprendizado
    await db.knowledgeChunk.create({
      data: {
        source: status === 'applied' ? 'refactor_applied' : 'refactor_rejected',
        sourceRef: suggestionId,
        filePath: suggestion.filePath,
        content: `## Erro recorrente: ${suggestion.sourceErrorHash}
## Arquivo: ${suggestion.filePath} (linhas ${suggestion.lineRange})
## Status: ${status} por ${reviewerEmail}
## Notas: ${notes || '(nenhuma)'}

### Rationale proposta:
${suggestion.rationale}

### Código proposto:
${suggestion.proposedCode}

### Código atual:
${suggestion.currentCode}
`,
        embedding: '[]',
        metadata: JSON.stringify({
          suggestionId,
          status,
          reviewerEmail,
          confidence: suggestion.confidence,
          mode: suggestion.mode,
          reviewedAt: new Date().toISOString(),
        }),
      },
    });

    // 3. Adiciona ao TfidfIndex em memória (aprendizado imediato)
    const { getTfidfIndex } = await import('./tfidf');
    const tfidf = getTfidfIndex();
    tfidf.addDocument({
      id: `refactor:${suggestionId}`,
      content: `${suggestion.rationale} ${suggestion.proposedCode} ${suggestion.sourceErrorHash}`,
      filePath: suggestion.filePath,
      metadata: { status, suggestionId },
    });

    logSink.info({
      module: 'refactor-suggester',
      event: 'feedback_recorded',
      message: `Feedback registrado para sugestão ${suggestionId} — status: ${status}`,
      context: {
        suggestionId,
        status,
        reviewerEmail,
        filePath: suggestion.filePath,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════

  async getStats(): Promise<{
    mode: 'mock' | 'live';
    config: { model: string; recurringErrorThreshold: number };
    indexStats: Awaited<ReturnType<typeof import('./code-indexer')['getIndexStats']>>;
    totalSuggestions: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    applied: number;
  }> {
    const { getIndexStats } = await import('./code-indexer');
    const indexStats = await getIndexStats();

    let totalSuggestions = 0;
    let pendingReview = 0;
    let approved = 0;
    let rejected = 0;
    let applied = 0;

    try {
      [totalSuggestions, pendingReview, approved, rejected, applied] = await Promise.all([
        db.refactorSuggestion.count(),
        db.refactorSuggestion.count({ where: { status: 'pending_review' } }),
        db.refactorSuggestion.count({ where: { status: 'approved' } }),
        db.refactorSuggestion.count({ where: { status: 'rejected' } }),
        db.refactorSuggestion.count({ where: { status: 'applied' } }),
      ]);
    } catch {
      // ignore
    }

    return {
      mode: this.mode,
      config: {
        model: this.config.model,
        recurringErrorThreshold: this.config.recurringErrorThreshold,
      },
      indexStats,
      totalSuggestions,
      pendingReview,
      approved,
      rejected,
      applied,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singletonSuggester: RefactorSuggester | null = null;

export function getRefactorSuggester(): RefactorSuggester {
  if (!singletonSuggester) {
    singletonSuggester = new RefactorSuggester();
  }
  return singletonSuggester;
}

// ── Helper: agrupa erros recorrentes dos últimos 24h ───────────────────────

export interface RecurringErrorGroup {
  errorHash: string;
  count: number;
  sampleEvent: {
    module: string;
    event: string;
    message: string;
    stack?: string;
    timestamp: string;
  };
  recentErrors: Array<{ module: string; event: string; message: string; timestamp: string }>;
}

/**
 * Identifica erros recorrentes (mesmo hash, count >= threshold) nas últimas 24h.
 *
 * Fonte: ring buffer in-memory do LogSink (não persiste, mas suficiente para
 * detectar padrões dentro de um mesmo lambda).
 */
export async function findRecurringErrors(threshold: number = 5): Promise<RecurringErrorGroup[]> {
  const { queryEvents } = await import('./log-sink');
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const errors = queryEvents({ level: 'error', since: twentyFourHoursAgo });

  // Agrupa por errorHash
  const groups = new Map<string, Array<typeof errors[number]>>();
  for (const err of errors) {
    if (!err.errorHash) continue;
    if (!groups.has(err.errorHash)) groups.set(err.errorHash, []);
    groups.get(err.errorHash)!.push(err);
  }

  // Filtra apenas grupos com count >= threshold
  const recurring: RecurringErrorGroup[] = [];
  for (const [hash, events] of groups.entries()) {
    if (events.length < threshold) continue;

    const sample = events[0];
    recurring.push({
      errorHash: hash,
      count: events.length,
      sampleEvent: {
        module: sample.module,
        event: sample.event,
        message: sample.message,
        stack: sample.stack,
        timestamp: sample.timestamp,
      },
      recentErrors: events.slice(0, 10).map(e => ({
        module: e.module,
        event: e.event,
        message: e.message,
        timestamp: e.timestamp,
      })),
    });
  }

  return recurring;
}

// ── Helper: pré-aquece o índice em memória (para ZCC stats endpoint) ──────

export async function ensureRefactorSuggesterReady(): Promise<void> {
  await ensureIndexLoaded();
}
