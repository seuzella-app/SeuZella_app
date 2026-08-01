// ============================================================================
// ZÉLLA — GlmCerebroService Core (Cérebro Pensante)
// ============================================================================
// Serviço singleton que orquestra chamadas ao GLM 5.2 (Chat.z.ai) para análise
// contextual das anomalias detectadas pelo AnomalyDetector.
//
// 4 CAPACIDADES PRINCIPAIS:
//  1. analyzeAnomalies(anomalyEvents) — classifica causa raiz (bug, ataque, pico legítimo)
//  2. forecastBudget(tenantId) — prevê estouro de cota Meta em N dias
//  3. detectInadimplencia() — regra (pagamento >5 dias atraso) + LLM (email cobrança)
//  4. suggestRefactor(errorHash, filePath) — erro recorrente + código → proposta de fix
//
// MODO MOCK (padrão):
//  - NÃO chama GLM 5.2 (economiza tokens)
//  - Retorna análises sintéticas baseadas em heurísticas
//  - Persiste CerebroAnalysis com mode="mock"
//  - Custo: $0
//
// MODO LIVE (CEREBRO_LIVE_MODE=true + GLM_5_2_API_KEY configurada):
//  - Chama GLM 5.2 via callOpenAICompatible adapter
//  - Prompt engineering estruturado com contexto dos eventos
//  - JSON output mode para respostas estruturadas
//  - Persiste CerebroAnalysis com mode="live" + costUsd real
//  - Custo estimado: ~$0.002 por análise (10k input + 1k output tokens)
//
// COST CONTROL:
//  - Hard cap mensal: $20 (configurável via CEREBRO_MONTHLY_BUDGET_USD)
//  - Se cap estourado, fallback para mock mode até próximo mês
//  - LogSink registra cada invocação para auditoria
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import {
  type CerebroAnalysisResult,
  type AnomalyDetectionResult,
  type BudgetForecast,
  type RefactorSuggestionResult,
  type Severity,
  type AnalysisType,
  getCerebroMode,
} from './types';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';

// ── Configuração ────────────────────────────────────────────────────────────

interface GlmCerebroConfig {
  /** GLM 5.2 API key (Chat.z.ai) */
  apiKey: string;
  /** Base URL da API */
  baseUrl: string;
  /** Modelo a usar */
  model: string;
  /** Temperatura (0 = determinístico, 1 = criativo) */
  temperature: number;
  /** Max tokens de output */
  maxTokens: number;
  /** Budget mensal em USD (hard cap) */
  monthlyBudgetUsd: number;
}

function loadConfig(): GlmCerebroConfig {
  return {
    apiKey: process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-5.2',
    temperature: 0.3, // baixa temperatura para respostas técnicas consistentes
    maxTokens: 2000,
    monthlyBudgetUsd: parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20'),
  };
}

// ── Cost Tracking (in-memory por lambda) ────────────────────────────────────

let monthlySpendUsd = 0;
let monthlySpendMonth = new Date().getMonth();

function resetSpendIfNewMonth(): void {
  const currentMonth = new Date().getMonth();
  if (currentMonth !== monthlySpendMonth) {
    monthlySpendUsd = 0;
    monthlySpendMonth = currentMonth;
  }
}

function isBudgetExhausted(config: GlmCerebroConfig): boolean {
  resetSpendIfNewMonth();
  return monthlySpendUsd >= config.monthlyBudgetUsd;
}

function trackSpend(costUsd: number): void {
  monthlySpendUsd += costUsd;
}

export function getCerebroSpend(): { month: number; spendUsd: number; budgetUsd: number } {
  resetSpendIfNewMonth();
  return {
    month: monthlySpendMonth,
    spendUsd: Math.round(monthlySpendUsd * 10000) / 10000,
    budgetUsd: loadConfig().monthlyBudgetUsd,
  };
}

// ── GlmCerebroService Class ─────────────────────────────────────────────────

export class GlmCerebroService {
  private readonly config: GlmCerebroConfig;
  private readonly mode: 'mock' | 'live';

  constructor() {
    this.config = loadConfig();
    this.mode = getCerebroMode();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAPACIDADE 1: ANALYZE ANOMALIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analisa anomalias detectadas pelo AnomalyDetector para classificar causa raiz.
   *
   * Em mock: retorna análise heurística baseada em regras (não chama LLM).
   * Em live: envia anomalias + contexto para GLM 5.2 classificar.
   *
   * @param anomalies Array de AnomalyDetectionResult do Passo 4
   * @returns CerebroAnalysisResult com summary, severity, recommended_action
   */
  async analyzeAnomalies(anomalies: AnomalyDetectionResult[]): Promise<CerebroAnalysisResult> {
    if (anomalies.length === 0) {
      return {
        analysisType: 'anomaly_scan',
        scope: 'global',
        summary: 'Nenhuma anomalia para analisar',
        details: { inputCount: 0 },
        severity: 'info',
        recommendedAction: 'none',
        confidence: 1.0,
        costUsd: 0,
        mode: this.mode,
      };
    }

    // Determina scope global se múltiplas anomalias
    const scopes = new Set(anomalies.map(a => a.scope));
    const scope = scopes.size === 1 ? anomalies[0].scope : 'global';

    // Severity máxima entre anomalias
    const maxSeverity = anomalies.reduce<Severity>((max, a) => {
      const order = { info: 0, warning: 1, critical: 2, emergency: 3 };
      return order[a.severity] > order[max] ? a.severity : max;
    }, 'info');

    if (this.mode === 'mock' || !this.config.apiKey || isBudgetExhausted(this.config)) {
      return this.mockAnomalyAnalysis(anomalies, scope, maxSeverity);
    }

    return this.liveAnomalyAnalysis(anomalies, scope, maxSeverity);
  }

  /**
   * Análise mock baseada em heurísticas (sem LLM).
   * Retorna classificação determinística baseada em tipo de anomalia.
   */
  private mockAnomalyAnalysis(
    anomalies: AnomalyDetectionResult[],
    scope: string,
    maxSeverity: Severity
  ): CerebroAnalysisResult {
    const types = Array.from(new Set(anomalies.map(a => a.anomalyType)));
    const hasErrorSpike = types.includes('error_spike');
    const hasAuthFailure = types.includes('auth_failure_pattern');
    const hasCostAnomaly = types.includes('cost_anomaly');
    const hasAttack = types.includes('tenant_under_attack');
    const hasBurst = types.includes('webhook_throughput_burst');

    let summary = '';
    let recommendedAction = '';
    let confidence = 0.7;

    if (hasAttack) {
      summary = `Possível ataque distribuído detectado em ${scope}. ${anomalies.length} indicador(es) de IPs únicos em auth endpoint.`;
      recommendedAction = 'Ativar rate limiting mais agressivo para /api/auth/* e monitorar. Considerar CAPTCHA temporário.';
      confidence = 0.85;
    } else if (hasAuthFailure && hasErrorSpike) {
      summary = `Falhas de autenticação combinadas com spike de erros em ${scope}. Possível tentativa de invasão com payload malicioso.`;
      recommendedAction = 'Investigar payloads recentes em /api/auth. Verificar se há pattern de SQL injection ou XSS.';
      confidence = 0.75;
    } else if (hasErrorSpike) {
      summary = `Spike de erros detectado em ${scope}. ${anomalies.length} anomalia(s) de tipo error_spike.`;
      recommendedAction = 'Verificar deploy recente (últimas 24h). Consultar logs de erro no LogSink para stack trace comum.';
      confidence = 0.7;
    } else if (hasCostAnomaly) {
      summary = `Custo Meta acima do esperado em ${scope}. Possível loop de retry ou cota estourando.`;
      recommendedAction = 'Verificar tenants com maior gasto Meta. Considerar upgrade forçado ou throttling temporário.';
      confidence = 0.8;
    } else if (hasBurst) {
      summary = `Throughput anormal de mensagens em ${scope}. Possível spam ou hóspede em loop.`;
      recommendedAction = 'Verificar se a conversa é legítima. Considerar rate limit por guestPhone.';
      confidence = 0.65;
    } else {
      summary = `${anomalies.length} anomalia(s) detectada(s) em ${scope}. Classificação automática inconclusiva.`;
      recommendedAction = 'Investigação manual recomendada. Verificar dashboard ZCC para detalhes.';
      confidence = 0.5;
    }

    return {
      analysisType: 'anomaly_scan',
      scope,
      summary,
      details: {
        anomalyCount: anomalies.length,
        anomalyTypes: types,
        maxSeverity,
        mockHeuristic: true,
        topAnomalies: anomalies.slice(0, 5).map(a => ({
          type: a.anomalyType,
          scope: a.scope,
          observed: a.observed,
          baseline: a.baseline,
          deviation: a.deviation,
        })),
      },
      severity: maxSeverity,
      recommendedAction,
      confidence,
      costUsd: 0,
      mode: 'mock',
    };
  }

  /**
   * Análise live chamando GLM 5.2.
   * Constrói prompt estruturado, envia com JSON mode, parseia resposta.
   */
  private async liveAnomalyAnalysis(
    anomalies: AnomalyDetectionResult[],
    scope: string,
    maxSeverity: Severity
  ): Promise<CerebroAnalysisResult> {
    const systemPrompt = `Você é o Cérebro Zélla, supervisor técnico autônomo do SaaS SeuZélla (plataforma de automação de atendimento via WhatsApp para pousadas e anfitriões Airbnb).

Sua função: analisar anomalias detectadas pelo sistema e classificar causa raiz, recomendando ação concreta.

Regras:
- Seja técnico e conciso (máximo 2 parágrafos no summary)
- recommended_action deve ser específica e executável (não genérica)
- confidence entre 0 e 1 (0 = chute, 1 = certeza absoluta)
- Responda SEMPRE em português do Brasil
- Output deve ser JSON válido no formato especificado`;

    const userPrompt = `Analise as seguintes anomalias detectadas:

SCOPE: ${scope}
SEVERITY MÁXIMA: ${maxSeverity}
TOTAL DE ANOMALIAS: ${anomalies.length}

DETALHES DAS ANOMALIAS:
${JSON.stringify(anomalies.map(a => ({
  type: a.anomalyType,
  scope: a.scope,
  metric: a.metric,
  observed: a.observed,
  baseline: a.baseline,
  deviation: a.deviation,
  detectionMethod: a.detectionMethod,
  severity: a.severity,
})), null, 2)}

CONTEXTO DO SISTEMA:
- Stack: Next.js 16 + Prisma + PostgreSQL + Redis + WhatsApp Cloud API
- Ambiente: Vercel Serverless
- Deploy recente: ${process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'unknown'}

Responda em JSON com exatamente esta estrutura:
{
  "summary": "string - resumo de 1-2 frases da causa raiz identificada",
  "severity": "info | warning | critical | emergency",
  "recommended_action": "string - ação específica e executável",
  "confidence": "number - 0 a 1",
  "root_cause_category": "bug | attack | legitimate_spike | config_error | resource_exhaustion | unknown"
}`;

    const messages: AdapterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const startTime = Date.now();

    try {
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

      // Custo estimado: input tokens × $0.00140/1k + output tokens × $0.00440/1k
      const costUsd = (response.inputTokens / 1000) * 0.00140 + (response.outputTokens / 1000) * 0.00440;
      trackSpend(costUsd);

      // Parse JSON response
      const parsed = this.parseAnalysisResponse(response.content);

      logSink.info({
        module: 'glm-cerebro',
        event: 'anomaly_analysis_complete',
        message: `Análise live completa em ${latencyMs}ms — severity: ${parsed.severity}`,
        context: {
          latencyMs,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          costUsd,
          confidence: parsed.confidence,
          anomalyCount: anomalies.length,
        },
      });

      return {
        analysisType: 'anomaly_scan',
        scope,
        summary: parsed.summary,
        details: {
          anomalyCount: anomalies.length,
          anomalyTypes: Array.from(new Set(anomalies.map(a => a.anomalyType))),
          maxSeverity,
          llmResponse: parsed,
          latencyMs,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          rawResponse: response.content,
        },
        severity: parsed.severity as Severity,
        recommendedAction: parsed.recommended_action,
        confidence: parsed.confidence,
        costUsd: Math.round(costUsd * 10000) / 10000,
        mode: 'live',
      };
    } catch (error) {
      logSink.error({
        module: 'glm-cerebro',
        event: 'anomaly_analysis_failed',
        message: 'GLM 5.2 call failed — fallback to mock',
        error,
        context: { anomalyCount: anomalies.length, scope },
      });

      // Fallback gracioso para mock mode
      return this.mockAnomalyAnalysis(anomalies, scope, maxSeverity);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAPACIDADE 2: FORECAST BUDGET (CFO Virtual)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Prevê se um tenant vai estourar cota Meta antes do fim do mês.
   *
   * Em mock: usa média móvel simples (sem LLM).
   * Em live: GLM 5.2 gera recomendação personalizada de upgrade.
   */
  async forecastBudget(tenantId: string): Promise<BudgetForecast> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plan: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} não encontrado`);
    }

    // Busca MetaCostLog dos últimos 30 dias
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const costLogs = await db.metaCostLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { costUsd: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Calcula gasto atual no mês
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentSpendUsd = costLogs
      .filter(l => l.createdAt >= monthStart)
      .reduce((sum, l) => sum + l.costUsd, 0);

    // Limite do plano (sincronizado com meta-cost-guard.ts)
    const budgetLimits: Record<string, number> = {
      gratuito: 3.40,
      lite: 12.00,
      pro: 34.00,
      max: 68.00,
      parceiro: 34.00,
    };
    const budgetLimitUsd = budgetLimits[tenant.plan] ?? 3.40;

    // Média diária (média móvel 7 dias)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysCost = costLogs
      .filter(l => l.createdAt >= sevenDaysAgo)
      .reduce((sum, l) => sum + l.costUsd, 0);
    const avgDailySpendUsd = last7DaysCost / 7;

    // Projeção
    const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const projectedSpendUsd = currentSpendUsd + (avgDailySpendUsd * daysRemaining);
    const projectedUsagePercent = (projectedSpendUsd / budgetLimitUsd) * 100;

    const shouldAlert = projectedUsagePercent > 90;
    let severity: Severity = 'info';
    if (projectedUsagePercent > 100) severity = 'critical';
    else if (projectedUsagePercent > 90) severity = 'warning';

    return {
      tenantId,
      tenantName: tenant.name,
      plan: tenant.plan,
      currentSpendUsd: Math.round(currentSpendUsd * 100) / 100,
      budgetLimitUsd,
      avgDailySpendUsd: Math.round(avgDailySpendUsd * 10000) / 10000,
      daysRemaining,
      projectedSpendUsd: Math.round(projectedSpendUsd * 100) / 100,
      projectedUsagePercent: Math.round(projectedUsagePercent * 10) / 10,
      shouldAlert,
      severity,
      mode: this.mode,
    };
  }

  /**
   * Executa forecast para todos os tenants ativos pagos.
   * Retorna top 10 em risco de estourar cota.
   */
  async forecastBudgetForAllTenants(): Promise<BudgetForecast[]> {
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
        plan: { not: 'gratuito' },
      },
      select: { id: true },
    });

    const forecasts: BudgetForecast[] = [];
    for (const tenant of tenants) {
      try {
        const forecast = await this.forecastBudget(tenant.id);
        if (forecast.shouldAlert) {
          forecasts.push(forecast);
        }
      } catch (error) {
        logSink.warn({
          module: 'glm-cerebro',
          event: 'forecast_tenant_failed',
          message: `Falha ao projetar budget para tenant ${tenant.id} (non-fatal)`,
          error,
        });
      }
    }

    // Ordena por % de uso projetado (maior primeiro)
    return forecasts.sort((a, b) => b.projectedUsagePercent - a.projectedUsagePercent).slice(0, 10);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAPACIDADE 3: DETECT INADIMPLÊNCIA
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Detecta tenants com pagamento >5 dias atrasado.
   * Em live: GLM 5.2 gera email personalizado de cobrança.
   */
  async detectInadimplencia(): Promise<Array<{
    tenantId: string;
    tenantName: string;
    plan: string;
    daysLate: number;
    amountDue: number;
    recommendedAction: string;
    severity: Severity;
  }>> {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    // Busca subscriptions com status past_due ou canceled
    const overdueSubscriptions = await db.subscription.findMany({
      where: {
        status: { in: ['past_due', 'canceled', 'unpaid'] },
        updatedAt: { lt: fiveDaysAgo },
      },
      include: {
        tenant: {
          select: { id: true, name: true, plan: true, email: true },
        },
      },
      take: 100,
    });

    const results = [];
    for (const sub of overdueSubscriptions) {
      const daysLate = Math.floor((now.getTime() - sub.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
      const planPricing: Record<string, number> = {
        lite: 197, pro: 397, max: 797, parceiro: 247,
      };
      const amountDue = planPricing[sub.tenant.plan] || 0;

      let recommendedAction = '';
      let severity: Severity = 'warning';

      if (daysLate > 30) {
        severity = 'critical';
        recommendedAction = 'Suspender tenant e enviar email final de cobrança. Considerar inativar acesso.';
      } else if (daysLate > 15) {
        severity = 'critical';
        recommendedAction = 'Enviar email de cobrança urgente + notificação no DDC. Considerar throttling de IA.';
      } else if (daysLate > 5) {
        severity = 'warning';
        recommendedAction = 'Enviar email de cobrança amigável + lembrete no DDC.';
      }

      // Em live mode, GLM 5.2 poderia gerar email personalizado aqui
      // Por enquanto, mantemos ação template (mock-friendly)
      if (this.mode === 'live' && !isBudgetExhausted(this.config)) {
        // TODO: chamar GLM para gerar email personalizado
        // Por ora, mantemos template para economizar tokens
      }

      results.push({
        tenantId: sub.tenant.id,
        tenantName: sub.tenant.name,
        plan: sub.tenant.plan,
        daysLate,
        amountDue,
        recommendedAction,
        severity,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAPACIDADE 4: SUGGEST REFACTOR (RAG placeholder)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Placeholder para Passo 8 (RefactorSuggester completo com RAG).
   * Por ora, registra erro recorrente e retorna sugestão template.
   */
  async suggestRefactor(errorHash: string, filePath: string): Promise<RefactorSuggestionResult> {
    // Mock: retorna sugestão template baseada no hash
    const suggestion: RefactorSuggestionResult = {
      sourceErrorHash: errorHash,
      filePath,
      lineRange: '0-0',
      currentCode: '// Código não disponível em mock mode',
      proposedCode: '// Sugestão não disponível em mock mode — ative CEREBRO_LIVE_MODE para análise real',
      rationale: 'RefactorSuggester completo (com RAG) será implementado no Passo 8. Por ora, apenas registra o erro para futura análise.',
      confidence: 0.1,
      mode: this.mode,
    };

    logSink.info({
      module: 'glm-cerebro',
      event: 'refactor_suggestion_requested',
      message: `Sugestão de refatoração solicitada para ${filePath} (hash: ${errorHash})`,
      context: { errorHash, filePath, mode: this.mode },
    });

    return suggestion;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Parseia resposta JSON do GLM 5.2 com fallback gracioso.
   */
  private parseAnalysisResponse(content: string): {
    summary: string;
    severity: string;
    recommended_action: string;
    confidence: number;
    root_cause_category?: string;
  } {
    try {
      // Tenta parse direto
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || 'Análise inconclusiva',
        severity: parsed.severity || 'warning',
        recommended_action: parsed.recommended_action || 'Investigação manual necessária',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        root_cause_category: parsed.root_cause_category,
      };
    } catch {
      // Se não é JSON válido, tenta extrair JSON de dentro do texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Fallback final
        }
      }

      return {
        summary: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        severity: 'warning',
        recommended_action: 'Investigação manual necessária (resposta LLM não estruturada)',
        confidence: 0.3,
      };
    }
  }

  /**
   * Persiste CerebroAnalysis no DB.
   */
  async persistAnalysis(result: CerebroAnalysisResult): Promise<string> {
    const analysis = await db.cerebroAnalysis.create({
      data: {
        analysisType: result.analysisType,
        scope: result.scope,
        summary: result.summary,
        details: JSON.stringify(result.details),
        severity: result.severity,
        costUsd: result.costUsd,
        mode: result.mode,
      },
    });

    logSink.info({
      module: 'glm-cerebro',
      event: 'analysis_persisted',
      message: `Análise ${analysis.id} persistida — type: ${result.analysisType}, severity: ${result.severity}`,
      context: {
        analysisId: analysis.id,
        analysisType: result.analysisType,
        severity: result.severity,
        mode: result.mode,
        costUsd: result.costUsd,
      },
    });

    return analysis.id;
  }

  /**
   * Retorna stats do serviço (para dashboard ZCC).
   */
  getStats(): {
    mode: 'mock' | 'live';
    config: { model: string; baseUrl: string; monthlyBudgetUsd: number };
    spend: { month: number; spendUsd: number; budgetUsd: number; remainingUsd: number };
    hasApiKey: boolean;
  } {
    return {
      mode: this.mode,
      config: {
        model: this.config.model,
        baseUrl: this.config.baseUrl,
        monthlyBudgetUsd: this.config.monthlyBudgetUsd,
      },
      spend: {
        ...getCerebroSpend(),
        remainingUsd: Math.max(0, this.config.monthlyBudgetUsd - getCerebroSpend().spendUsd),
      },
      hasApiKey: !!this.config.apiKey,
    };
  }
}

// ── Singleton instance ─────────────────────────────────────────────────────

let singletonService: GlmCerebroService | null = null;

export function getGlmCerebroService(): GlmCerebroService {
  if (!singletonService) {
    singletonService = new GlmCerebroService();
  }
  return singletonService;
}

// ── Helpers para query de análises persistidas ────────────────────────────

export interface AnalysisQueryParams {
  since?: Date;
  analysisType?: AnalysisType;
  severity?: Severity;
  mode?: 'mock' | 'live';
  limit?: number;
}

export async function queryAnalyses(params: AnalysisQueryParams = {}): Promise<Array<{
  id: string;
  analysisType: string;
  scope: string;
  summary: string;
  details: string;
  severity: string;
  costUsd: number;
  mode: string;
  createdAt: Date;
}>> {
  const where: Record<string, unknown> = {};

  if (params.since) where.createdAt = { gte: params.since };
  if (params.analysisType) where.analysisType = params.analysisType;
  if (params.severity) where.severity = params.severity;
  if (params.mode) where.mode = params.mode;

  return db.cerebroAnalysis.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 50,
  });
}
