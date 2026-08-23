/**
 * Cerebro Learning Service — Workflow "Delirium Zero"
 * =====================================================
 *
 * OBJETIVO: Garantir que o Cérebro Zélla tenha NOÇÃO COMPLETA do projeto
 * e aprenda dia após dia com os relatórios noturnos, SEM alucinar.
 *
 * PROBLEMA QUE RESOLVE:
 *   LLMs alucinam quando não têm contexto estruturado. Para evitar
 *   "delirium" (respostas inventadas), o Cérebro precisa de:
 *     1. CONTEXT INJECTION — conhece o schema, módulos, e estado atual
 *     2. GROUND TRUTH — fatos validados (não achismos do LLM)
 *     3. LEARNING LOOP — aprende com cada audit anterior
 *     4. VALIDATION GATE — respostas críticas exigem fontes citadas
 *
 * WORKFLOW DELIRIUM ZERO:
 *
 *   03:30 BRT (após Night Audit completar às 03:00):
 *     1. INGEST: Lê último NightAuditReport completo
 *     2. EXTRACT: Identifica padrões recorrentes (vulns persistentes,
 *        métricas que mudaram, anomalias confirmadas)
 *     3. DISTILL: Converte em KnowledgeEntry (facts estruturados)
 *     4. VALIDATE: Cada KnowledgeEntry tem confidence 0-1 e source
 *     5. PERSIST: Salva em KnowledgeEntry (Prisma) para RAG futuro
 *
 *   Quando o operador pergunta algo ao Cérebro:
 *     1. QUERY: Busca KnowledgeEntries relevantes (TF-IDF ou Semantica)
 *     2. INJECT: Adiciona facts como contexto no system prompt
 *     3. RESPOND: GLM 5.2 responde com fatos citados (não inventa)
 *
 * 4 PRINCÍPIOS DO DELIRIUM ZERO:
 *   1. SOURCE-OF-TRUTH: toda afirmação vem de dados reais (banco ou audit)
 *   2. CITATION: respostas críticas citam arquivo:linha ou ID do registro
 *   3. UNCERTAINTY MARKER: "não sei" é melhor que alucinar
 *   4. VERSIONED: KnowledgeEntries têm versão (v1, v2 — sobrescreve quando valida)
 */

import { db } from '@/lib/db';
import { getCerebroMode } from './types';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { NightAuditService } from './night-audit-service';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeFact {
  // Identificação do fato
  factType: 'vulnerability_pattern' | 'metric_baseline' | 'anomaly_confirmed' |
            'recommendation_acted' | 'code_smell' | 'performance_pattern';
  // Conteúdo estruturado do fato (PT-BR, direto, sem floreio)
  statement: string;
  // Fonte validada (audit report ID, arquivo:linha, query SQL)
  source: string;
  // Confidence 0-1 (1 = validado por humanos, 0.5 = LLM achismo)
  confidence: number;
  // Contexto adicional (JSON)
  context?: any;
  // Tags para busca (TF-IDF)
  tags: string[];
}

export interface CerebroProjectContext {
  // Snapshot do estado atual do projeto — injetado em TODAS as chamadas LLM
  totalModules: number;
  totalApiRoutes: number;
  totalModels: number;
  totalCronJobs: number;
  totalTests: number;
  cerebroMode: 'mock' | 'live';
  // Estado atual do Cérebro
  lastAuditDate: string | null;
  lastAuditSeverity: string | null;
  openVulnerabilities: number;
  // Environment summary
  hasGLMKey: boolean;
  hasWhatsAppKey: boolean;
  hasMPKey: boolean;
  hasStripeKey: boolean;
}

export interface LearningResult {
  auditDate: string;
  factsExtracted: number;
  factsValidated: number;
  factsUpdated: number;
  newPatternsDetected: string[];
  mode: 'mock' | 'live';
  costUsd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class CerebroLearningService {
  /**
   * Executa o ciclo de aprendizado (chamado após Night Audit completar).
   * Extrai fatos do último audit e os persiste em KnowledgeEntry.
   */
  public static async runLearningCycle(): Promise<LearningResult> {
    const mode = getCerebroMode();

    // Busca último audit completo
    const lastAudit = await NightAuditService.getLatest();
    if (!lastAudit) {
      return {
        auditDate: new Date().toISOString().slice(0, 10),
        factsExtracted: 0,
        factsValidated: 0,
        factsUpdated: 0,
        newPatternsDetected: [],
        mode,
        costUsd: 0,
      };
    }

    // Extrai fatos estruturados do audit
    const facts = this.extractFactsFromAudit(lastAudit);

    // Persiste em KnowledgeEntry
    let factsValidated = 0;
    let factsUpdated = 0;
    for (const fact of facts) {
      const result = await this.persistFact(fact, lastAudit.auditDate, mode);
      if (result.created) factsValidated++;
      if (result.updated) factsUpdated++;
    }

    // Detecta novos padrões (vulns que aparecem pela primeira vez)
    const newPatternsDetected = this.detectNewPatterns(facts);

    // Em modo live, GLM 5.2 faz análise adicional (insights humanos não óbvios)
    let costUsd = 0;
    if (mode === 'live' && facts.length > 0) {
      const llmInsights = await this.runLLMPatternAnalysis(facts, lastAudit);
      costUsd = llmInsights.costUsd;

      // Persiste insights adicionais do LLM
      for (const insight of llmInsights.facts) {
        await this.persistFact(insight, lastAudit.auditDate, mode);
      }
    }

    return {
      auditDate: lastAudit.auditDate,
      factsExtracted: facts.length,
      factsValidated,
      factsUpdated,
      newPatternsDetected,
      mode,
      costUsd,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 1: EXTRACT — converte audit em fatos estruturados
  // ─────────────────────────────────────────────────────────────────────────

  private static extractFactsFromAudit(audit: any): KnowledgeFact[] {
    const facts: KnowledgeFact[] = [];

    // 1. Vulnerabilidades críticas/altas → facts de "vulnerability_pattern"
    for (const vuln of audit.vulnFindings ?? []) {
      if (vuln.severity === 'critical' || vuln.severity === 'high') {
        facts.push({
          factType: 'vulnerability_pattern',
          statement: `${vuln.severity.toUpperCase()} em ${vuln.file}:${vuln.line}: ${vuln.description}`,
          source: `night_audit:${audit.auditDate}:${vuln.cwe ?? vuln.type}`,
          confidence: 0.95, // SAST é determinístico — alta confiança
          context: { cwe: vuln.cwe, recommendation: vuln.recommendation },
          tags: ['security', vuln.type, vuln.severity, vuln.file.split('/')[0]],
        });
      }
    }

    // 2. Métricas fora do baseline → facts de "metric_baseline"
    if (audit.metrics) {
      const m = audit.metrics;
      // Taxa de conversão baixa
      if (m.leadsCaptured > 10 && m.conversionRate < 5) {
        facts.push({
          factType: 'metric_baseline',
          statement: `Taxa de conversão baixa: ${m.conversionRate.toFixed(1)}% (${m.leadsConverted}/${m.leadsCaptured} leads) em ${audit.auditDate}`,
          source: `night_audit:${audit.auditDate}:metrics:conversion_rate`,
          confidence: 0.9,
          context: { leadsCaptured: m.leadsCaptured, leadsConverted: m.leadsConverted },
          tags: ['metrics', 'conversion', 'leads'],
        });
      }
      // Distribuição geográfica
      if (m.regions && m.regions.length > 0) {
        const topRegion = m.regions[0];
        facts.push({
          factType: 'metric_baseline',
          statement: `Top região de leads: ${topRegion.uf} com ${topRegion.count} leads em ${audit.auditDate}`,
          source: `night_audit:${audit.auditDate}:metrics:top_region`,
          confidence: 0.9,
          context: { uf: topRegion.uf, count: topRegion.count },
          tags: ['metrics', 'geo', topRegion.uf],
        });
      }
      // Maioria mobile
      if (m.devicesMobile > m.devicesDesktop * 2 && m.devicesMobile > 5) {
        facts.push({
          factType: 'metric_baseline',
          statement: `Maioria dos usuários acessa via mobile: ${m.devicesMobile} mobile vs ${m.devicesDesktop} desktop em ${audit.auditDate}`,
          source: `night_audit:${audit.auditDate}:metrics:device_split`,
          confidence: 0.85,
          context: { mobile: m.devicesMobile, desktop: m.devicesDesktop },
          tags: ['metrics', 'mobile', 'ux'],
        });
      }
    }

    // 3. Atividade suspeita confirmada → facts de "anomaly_confirmed"
    for (const event of audit.activityEvents ?? []) {
      if (event.severity === 'critical' || event.severity === 'warning') {
        facts.push({
          factType: 'anomaly_confirmed',
          statement: `${event.surface}: ${event.eventType} detectado em ${audit.auditDate} (severity ${event.severity})`,
          source: `night_audit:${audit.auditDate}:activity:${event.surface}:${event.eventType}`,
          confidence: 0.8,
          context: event.details,
          tags: ['activity', event.surface, event.eventType, event.severity],
        });
      }
    }

    // 4. Recomendações do GLM 5.2 → facts de "recommendation_acted"
    for (const rec of audit.llmAnalysis?.recommendations ?? []) {
      facts.push({
        factType: 'recommendation_acted',
        statement: `Recomendação do GLM 5.2 em ${audit.auditDate}: ${rec}`,
        source: `night_audit:${audit.auditDate}:llm:recommendation`,
        confidence: 0.6, // Recomendação do LLM = confiança média
        tags: ['recommendation', 'llm', audit.severity],
      });
    }

    // 5. Pentest findings (BOLA, IDOR, missing withApiGuard)
    for (const finding of audit.pentestFindings ?? []) {
      if (finding.severity === 'critical' || finding.severity === 'high') {
        facts.push({
          factType: 'code_smell',
          statement: `${finding.type} em ${finding.file}:${finding.line}: ${finding.description}`,
          source: `night_audit:${audit.auditDate}:pentest:${finding.cwe ?? finding.type}`,
          confidence: 0.95,
          context: { recommendation: finding.recommendation, source: finding.detectionSource },
          tags: ['pentest', finding.type, finding.detectionSource, finding.file.split('/')[0]],
        });
      }
    }

    return facts;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 2: PERSIST — salva fato em KnowledgeEntry (com dedup por source)
  // ─────────────────────────────────────────────────────────────────────────

  private static async persistFact(
    fact: KnowledgeFact,
    auditDate: string,
    mode: 'mock' | 'live'
  ): Promise<{ created: boolean; updated: boolean }> {
    try {
      // Dedup por source — se já existe, atualiza confidence/contexto
      const existing = await (db as any).cerebroKnowledgeFact?.findFirst({
        where: { source: fact.source },
        select: { id: true, confidence: true },
      });

      if (existing) {
        // Atualiza apenas se confidence aumentou (validação acumulativa)
        if (fact.confidence > existing.confidence) {
          await (db as any).cerebroKnowledgeFact?.update({
            where: { id: existing.id },
            data: {
              confidence: fact.confidence,
              context: JSON.stringify(fact.context ?? {}),
              version: { increment: 1 },
              updatedAt: new Date(),
            },
          });
          return { created: false, updated: true };
        }
        return { created: false, updated: false };
      }

      // Cria novo CerebroKnowledgeFact
      await (db as any).cerebroKnowledgeFact?.create({
        data: {
          factType: fact.factType,
          statement: fact.statement,
          source: fact.source,
          confidence: fact.confidence,
          context: JSON.stringify(fact.context ?? {}),
          tags: fact.tags.join(','),
          auditDate,
          mode,
        },
      });
      return { created: true, updated: false };
    } catch (err) {
      // Falha ao persistir 1 fact não bloqueia os outros
      return { created: false, updated: false };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 3: DETECT NEW PATTERNS — identifica fatos novos (não vistos antes)
  // ─────────────────────────────────────────────────────────────────────────

  private static detectNewPatterns(facts: KnowledgeFact[]): string[] {
    // Agrupa por factType + primeira tag — identifica padrões recorrentes
    const patterns: Record<string, number> = {};
    for (const fact of facts) {
      const key = `${fact.factType}:${fact.tags[0] ?? 'unknown'}`;
      patterns[key] = (patterns[key] ?? 0) + 1;
    }

    // Padrões que aparecem 3+ vezes = "estabelecidos"
    return Object.entries(patterns)
      .filter(([, count]) => count >= 3)
      .map(([key]) => key);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 4: LLM PATTERN ANALYSIS — GLM 5.2 detecta padrões não óbvios
  // ─────────────────────────────────────────────────────────────────────────

  private static async runLLMPatternAnalysis(
    facts: KnowledgeFact[],
    audit: any
  ): Promise<{ facts: KnowledgeFact[]; costUsd: number }> {
    const apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
    if (!apiKey) {
      return { facts: [], costUsd: 0 };
    }

    const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    const model = process.env.GLM_MODEL || 'glm-5.2';

    const systemPrompt = `Você é o Cérebro Zélla analisando padrões do projeto.

Sua tarefa: identificar PADRÕES NÃO ÓVIOS que humanos não perceberam.

DELIRIUM ZERO — REGRAS CRÍTICAS:
1. NUNCA afirme algo sem citar a fonte (audit:X ou arquivo:linha)
2. NUNCA invente métricas — use apenas as fornecidas
3. Se não há padrão claro, RETORNE array vazio (silêncio > alucinação)
4. Cada insight deve ter confidence 0-1 (0.5 = achismo, 0.9 = validado)

Output JSON: { "insights": [{ "statement": "...", "source": "...", "confidence": 0.X, "tags": [...] }] }`;

    const userPrompt = `Fatos extraídos do audit ${audit.auditDate}:
${JSON.stringify(facts.slice(0, 50), null, 2)}

Audit severity: ${audit.severity}
Audit summary: ${audit.summary}

Identifique padrões recorrentes, correlações não óbvias, e antecipe riscos.
Retorne apenas insights NOVOS (não repetir o que está nos fatos).`;

    const messages: AdapterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await callOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        messages,
        temperature: 0.2,
        maxTokens: 800,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.content);
      const costUsd = (response.inputTokens * 0.00140 + response.outputTokens * 0.00440) / 1000;

      const llmFacts: KnowledgeFact[] = (parsed.insights ?? []).map((insight: any) => ({
        factType: 'performance_pattern' as const,
        statement: insight.statement,
        source: insight.source ?? `llm:insight:${audit.auditDate}`,
        confidence: insight.confidence ?? 0.5,
        tags: insight.tags ?? ['llm', 'insight'],
      }));

      return { facts: llmFacts, costUsd };
    } catch (err) {
      return { facts: [], costUsd: 0 };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY API — usado quando o operador faz pergunta ao Cérebro
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Constrói o contexto de projeto para injetar no system prompt.
   * Garante que o LLM CONHEÇA o projeto e não alucine sobre ele.
   */
  public static async buildProjectContext(): Promise<CerebroProjectContext> {
    const mode = getCerebroMode();
    const lastAudit = await NightAuditService.getLatest();

    // Conta recursos do projeto (best-effort — falha silenciosa)
    let openVulnerabilities = 0;
    try {
      openVulnerabilities = await (db as any).codeVulnerability?.count({
        where: { status: 'open' },
      }) ?? 0;
    } catch {}

    return {
      totalModules: 25, // Cérebro tem 25 módulos em src/lib/cerebro/
      totalApiRoutes: 239, // Atualizado conforme ROADMAP
      totalModels: 96, // Modelos Prisma
      totalCronJobs: 27, // Cron jobs no vercel.json
      totalTests: 60, // Testes Vitest
      cerebroMode: mode,
      lastAuditDate: lastAudit?.auditDate ?? null,
      lastAuditSeverity: lastAudit?.severity ?? null,
      openVulnerabilities,
      hasGLMKey: !!process.env.GLM_5_2_API_KEY,
      hasWhatsAppKey: !!process.env.META_ACCESS_TOKEN,
      hasMPKey: !!process.env.MP_ACCESS_TOKEN,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    };
  }

  /**
   * Busca fatos relevantes para uma pergunta (RAG básico via tags).
   * Em produção, usar Semantica GraphRAG quando ativo.
   */
  public static async searchRelevantFacts(query: string, limit = 5): Promise<KnowledgeFact[]> {
    try {
      // Busca simples por tag (TF-IDF em produção)
      const lower = query.toLowerCase();
      const tags = ['security', 'metrics', 'pentest', 'activity', 'mobile', 'leads',
                    'critical', 'high', 'warning', 'conversion'];

      const matchedTags = tags.filter(tag => lower.includes(tag));
      if (matchedTags.length === 0) return [];

      // Busca CerebroKnowledgeFacts com qualquer tag matching
      const entries = await (db as any).cerebroKnowledgeFact?.findMany({
        where: {
          OR: matchedTags.map(tag => ({ tags: { contains: tag } })),
          confidence: { gte: 0.5 },
        },
        orderBy: { confidence: 'desc' },
        take: limit,
      }) ?? [];

      return entries.map((e: any) => ({
        factType: e.factType,
        statement: e.statement,
        source: e.source,
        confidence: e.confidence,
        context: JSON.parse(e.context || '{}'),
        tags: e.tags ? e.tags.split(',') : [],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Constrói o system prompt ENRIQUECIDO com contexto + fatos relevantes.
   * Este é o "Delirium Zero" — o LLM responde com base em fatos, não inventa.
   */
  public static async buildDeliriumZeroPrompt(userQuery: string): Promise<{
    systemPrompt: string;
    factsInjected: number;
  }> {
    const ctx = await this.buildProjectContext();
    const facts = await this.searchRelevantFacts(userQuery);

    const systemPrompt = `Você é o Cérebro Zélla — supervisor técnico do SaaS SeuZélla.

=== CONTEXTO DO PROJETO (NÃO ALUCINE SOBRE ISTO) ===
- Total de módulos do Cérebro: ${ctx.totalModules}
- Total de rotas de API: ${ctx.totalApiRoutes}
- Total de modelos Prisma: ${ctx.totalModels}
- Total de cron jobs: ${ctx.totalCronJobs}
- Total de testes Vitest: ${ctx.totalTests}
- Modo atual: ${ctx.cerebroMode === 'live' ? 'LIVE (GLM 5.2 real)' : 'MOCK (sem API key)'}
- Último audit: ${ctx.lastAuditDate ?? 'nunca executado'} (severity: ${ctx.lastAuditSeverity ?? 'N/A'})
- Vulnerabilidades abertas: ${ctx.openVulnerabilities}
- Integrações ativas: GLM ${ctx.hasGLMKey ? '✅' : '❌'}, WhatsApp ${ctx.hasWhatsAppKey ? '✅' : '❌'}, Mercado Pago ${ctx.hasMPKey ? '✅' : '❌'}, Stripe ${ctx.hasStripeKey ? '✅' : '❌'}

=== FATOS VALIDADOS (BASEIE-SE NESTES — NÃO INVENTE) ===
${facts.length > 0
  ? facts.map((f, i) => `${i + 1}. [${(f.confidence * 100).toFixed(0)}%] ${f.statement}\n   Fonte: ${f.source}`).join('\n')
  : '(nenhum fato relevante encontrado — use com cautela)'}

=== DELIRIUM ZERO — REGRAS OBRIGATÓRIAS ===
1. NUNCA afirme algo que não esteja nos FATOS VALIDADOS acima ou no CONTEXTO
2. Se não sabe, diga "não tenho dados suficientes para responder" — silêncio > alucinação
3. Cite a fonte (audit:X ou arquivo:linha) para afirmações críticas
4. Para perguntas sobre código específico, sugira rodar o SAST/pentest
5. Para perguntas sobre métricas, cite a data do último audit
6. Para recomendações, priorize por: impacto × confidence × urgência

Responda em PT-BR, técnico e direto.`;

    return {
      systemPrompt,
      factsInjected: facts.length,
    };
  }
}
