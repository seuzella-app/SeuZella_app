// ============================================================================
// ZÉLLA — Cérebro Types (Shared Type Definitions)
// ============================================================================
// Tipos compartilhados entre LogSink, AlertBus, AnomalyDetector,
// GlmCerebroService e endpoints cron. Single source of truth para evitar
// drift entre módulos.
// ============================================================================

// ── Severity ────────────────────────────────────────────────────────────────

export type Severity = 'info' | 'warning' | 'critical' | 'emergency';

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
};

// ── LogEvent (LogSink) ──────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEvent {
  /** ISO timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Módulo de origem: "whatsapp-webhook" | "ai-responder" | "auth" | etc */
  module: string;
  /** Evento específico: "process_failure" | "rate_limit_exceeded" | etc */
  event: string;
  /** Mensagem human-readable */
  message: string;
  /** Stack trace se aplicável (errors only) */
  stack?: string;
  /** Hash do erro (para deduplicação/agregação) */
  errorHash?: string;
  /** Contexto estruturado (tenantId, guestPhone, etc) */
  context?: Record<string, unknown>;
  /** Ambiente: production | development */
  env: 'production' | 'development';
  /** Versão do deploy (Vercel) */
  deploymentId?: string;
}

// ── AlertPayload (AlertBus) ─────────────────────────────────────────────────

export type AlertChannel = 'email' | 'slack' | 'sms' | 'dashboard' | 'webhook';

export interface AlertPayload {
  /** Título curto do alerta */
  subject: string;
  /** Corpo do alerta (markdown plain) */
  body: string;
  /** Severidade */
  severity: Severity;
  /** Escopo: "global" | "tenant:<id>" | "module:<name>" */
  scope: string;
  /** Origem: ID da CerebroAnalysis ou AnomalyEvent que motivou */
  sourceId?: string;
  sourceType?: 'cerebro_analysis' | 'anomaly_event' | 'manual';
  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

export interface AlertDeliveryResult {
  channel: AlertChannel;
  recipient: string;
  status: 'queued' | 'sent' | 'failed' | 'delivered';
  sentAt?: Date;
  errorMessage?: string;
  /** ID do registro em AlertDelivery (DB) */
  deliveryId?: string;
  /** Modo: "mock" | "live" */
  mode: 'mock' | 'live';
}

// ── Anomaly Detection ────────────────────────────────────────────────────────

export type AnomalyType =
  | 'error_spike'
  | 'latency_degradation'
  | 'cost_anomaly'
  | 'auth_failure_pattern'
  | 'tenant_under_attack'
  | 'webhook_throughput_burst'
  | 'unknown_metric_anomaly';

export type DetectionMethod = 'statistical' | 'threshold';

export interface AnomalyDetectionResult {
  anomalyType: AnomalyType;
  scope: string;
  metric: string;
  observed: number;
  baseline: number;
  deviation: number;
  detectionMethod: DetectionMethod;
  severity: Severity;
  /** Eventos que motivaram a detecção (amostra) */
  evidence: LogEvent[];
}

// ── CerebroAnalysis (LLM output) ────────────────────────────────────────────

export type AnalysisType =
  | 'anomaly_scan'
  | 'budget_forecast'
  | 'security_audit'
  | 'refactor_suggestion'
  | 'inadimplencia_check';

export interface CerebroAnalysisResult {
  analysisType: AnalysisType;
  scope: string;
  summary: string;
  details: Record<string, unknown>;
  severity: Severity;
  recommendedAction: string;
  confidence: number; // 0-1
  costUsd: number;
  mode: 'mock' | 'live';
}

// ── BudgetForecast (CFO Virtual) ────────────────────────────────────────────

export interface BudgetForecast {
  tenantId: string;
  tenantName: string;
  plan: string;
  /** Gasto atual no mês em USD */
  currentSpendUsd: number;
  /** Limite do plano em USD */
  budgetLimitUsd: number;
  /** Gasto médio diário (média móvel 7 dias) */
  avgDailySpendUsd: number;
  /** Dias restantes no mês */
  daysRemaining: number;
  /** Projeção de gasto até fim do mês */
  projectedSpendUsd: number;
  /** % da cota que será consumida (projetado) */
  projectedUsagePercent: number;
  /** Deve alertar? (projetado > 90%) */
  shouldAlert: boolean;
  /** Severidade baseada na projeção */
  severity: Severity;
  /** Modo: "mock" | "live" */
  mode: 'mock' | 'live';
}

// ── RefactorSuggestion (RAG) ────────────────────────────────────────────────

export interface RefactorSuggestionResult {
  sourceErrorHash: string;
  filePath: string;
  lineRange: string;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  confidence: number;
  mode: 'mock' | 'live';
}

// ── Cérebro Mode ─────────────────────────────────────────────────────────────

/**
 * Determina se o Cérebro está em modo mock ou live.
 *
 * Modo mock (padrão): todas as integrações de IA, Redis e canais externos
 * ficam desabilitadas. Análises usam dados sintéticos. Alertas vão só para
 * DB (não envia email/Slack/SMS). LogSink usa console apenas.
 *
 * Modo live: ativado quando CEREBRO_LIVE_MODE=true E as env vars específicas
 * de cada integração estão configuradas (GLM_5_2_API_KEY, UPSTASH_REDIS_REST_URL,
 * SLACK_WEBHOOK_URL, etc).
 */
export function getCerebroMode(): 'mock' | 'live' {
  if (process.env.CEREBRO_LIVE_MODE !== 'true') return 'mock';
  // Mesmo com flag on, só é live se GLM key estiver configurada
  // (sem LLM o Cérebro não analisa nada útil)
  if (!process.env.GLM_5_2_API_KEY && !process.env.ZHIPU_API_KEY) {
    console.warn('[Cérebro] CEREBRO_LIVE_MODE=true mas GLM_5_2_API_KEY/ZHIPU_API_KEY ausente. Operando em mock.');
    return 'mock';
  }
  return 'live';
}

/**
 * Determina se o LogSink deve enviar para Redis Stream ou apenas console.
 * Em mock: console only.
 * Em live: Redis Stream (se UPSTASH_REDIS_REST_URL configurado) + console.
 */
export function getLogSinkMode(): 'console' | 'redis' {
  if (getCerebroMode() === 'mock') return 'console';
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'redis';
  }
  return 'console';
}

/**
 * Helper para gerar hash determinístico de stack trace.
 * Usado pelo LogSink para agrupar erros recorrentes.
 */
export function hashErrorStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  // Simplifica o stack removendo caminhos absolutos e line numbers variáveis
  const normalized = stack
    .replace(/\/[^\s/]+\.ts/g, '') // caminhos de arquivo
    .replace(/:\d+:\d+/g, ':0:0'); // line:col numbers
  // Hash simples (FNV-1a) — não precisa ser crypto-secure
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
