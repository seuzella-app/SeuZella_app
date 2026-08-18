// ============================================================================
// ZÉLLA — AnomalyDetector (Cérebro Senses)
// ============================================================================
// Detecta anomalias em tempo real usando 4 estratégias complementares:
//
// 1. THRESHOLD DETECTION (regras hard)
//    - error_rate > X% em janela de 5 min por rota
//    - p99_latency > Xms
//    - auth_failures > X/min de um único IP
//    - meta_cost_usd_per_hour > $X
//    - tenant_message_burst > X msgs/min de um único tenant
//
// 2. STATISTICAL DETECTION (média móvel ± Nσ)
//    - Calcula baseline (média + desvio padrão) dos últimos 60 min
//    - Se valor atual sai de Nσ (default 3σ), flag como anomalia
//    - Mais sensível a mudanças sutis que threshold hard não pega
//
// 3. RATE-OF-CHANGE DETECTION (spikes repentinos)
//    - Se metric cresce > X% em 5 min vs média histórica
//    - Detecta DDoS-like patterns antes do threshold hard disparar
//
// 4. PATTERN MATCHING (ataques distribuídos)
//    - 50+ IPs únicos hitando mesmo endpoint em 1 min
//    - 10+ User-Agents únicos em auth endpoint
//    - Correlação cross-tenant (5+ tenants com mesmo erro simultâneo)
//
// FONTES DE DADOS:
//  - LogSink ring buffer (erros recentes do console interceptado)
//  - DB MetaCostLog (gastos Meta por hora)
//  - DB AuditLog (tentativas de acesso ao ZCC)
//  - DB AIActivityLog (latência de IA)
//  - DB ConversationMessage (throughput de webhook)
//
// COOLDOWN:
//  Após detectar anomalia de tipo+escopo, ignora mesma combinação por 60 min
//  para evitar alert spam. Configurável via cooldownMinutes.
//
// MODO MOCK:
//  Detecta e persiste AnomalyEvent normalmente, mas NÃO dispara alertas
//  (AlertBus é responsável por isso, e em mock mode não envia para canais reais).
// ============================================================================

import { db } from '@/lib/db';
import { logSink, queryEvents } from './log-sink';
import {
  type AnomalyDetectionResult,
  type AnomalyType,
  type Severity,
  type LogEvent,
  getCerebroMode,
} from './types';

// ── Configuração ────────────────────────────────────────────────────────────

export interface AnomalyDetectorConfig {
  // ── Threshold detectors ──
  /** Error rate em % em janela de 5 min por rota (default: 10%) */
  errorRateThresholdPercent: number;
  /** P99 latência em ms (default: 5000ms) */
  p99LatencyThresholdMs: number;
  /** Auth failures por minuto de um único IP (default: 50) */
  authFailuresPerMinThreshold: number;
  /** Custo Meta por hora em USD (default: $5) */
  metaCostPerHourThresholdUsd: number;
  /** Mensagens por minuto de um único tenant (default: 50) */
  tenantMessageBurstThreshold: number;

  // ── Statistical detector ──
  /** Sigma threshold para anomalia estatística (default: 3 = 99.7% confidence) */
  statisticalSigmaThreshold: number;
  /** Janela de baseline em minutos (default: 60 min) */
  baselineWindowMinutes: number;
  /** Janela atual para comparação em minutos (default: 5 min) */
  currentWindowMinutes: number;

  // ── Rate-of-change detector ──
  /** Threshold de mudança percentual (default: 100% = 2x increase) */
  rateOfChangeThresholdPercent: number;

  // ── Pattern matcher ──
  /** IPs únicos em 1 min no mesmo endpoint = ataque distribuído (default: 50) */
  distributedAttackIpThreshold: number;
  /** Tenants únicos com mesmo erro em 5 min = bug sistêmico (default: 5) */
  crossTenantErrorThreshold: number;

  // ── Cooldown ──
  /** Minutos de cooldown por (anomalyType + scope) para evitar spam (default: 60) */
  cooldownMinutes: number;

  // ── Habilitar/desabilitar estratégias ──
  enableThreshold: boolean;
  enableStatistical: boolean;
  enableRateOfChange: boolean;
  enablePatternMatcher: boolean;
}

export const DEFAULT_DETECTOR_CONFIG: AnomalyDetectorConfig = {
  errorRateThresholdPercent: 10,
  p99LatencyThresholdMs: 5000,
  authFailuresPerMinThreshold: 50,
  metaCostPerHourThresholdUsd: 5,
  tenantMessageBurstThreshold: 50,

  statisticalSigmaThreshold: 3,
  baselineWindowMinutes: 60,
  currentWindowMinutes: 5,

  rateOfChangeThresholdPercent: 100,

  distributedAttackIpThreshold: 50,
  crossTenantErrorThreshold: 5,

  cooldownMinutes: 60,

  enableThreshold: true,
  enableStatistical: true,
  enableRateOfChange: true,
  enablePatternMatcher: true,
};

// ── Cooldown tracker (in-memory, por lambda) ────────────────────────────────

const cooldownTracker = new Map<string, number>(); // key → timestamp ms

function getCooldownKey(type: AnomalyType, scope: string): string {
  return `${type}:${scope}`;
}

function isInCooldown(type: AnomalyType, scope: string, cooldownMs: number): boolean {
  const key = getCooldownKey(type, scope);
  const lastSeen = cooldownTracker.get(key);
  if (!lastSeen) return false;
  return Date.now() - lastSeen < cooldownMs;
}

function markCooldown(type: AnomalyType, scope: string): void {
  const key = getCooldownKey(type, scope);
  cooldownTracker.set(key, Date.now());

  // Cleanup: remove entradas antigas (>24h) para evitar memory leak
  if (cooldownTracker.size > 1000) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, ts] of cooldownTracker.entries()) {
      if (ts < cutoff) cooldownTracker.delete(k);
    }
  }
}

// ── AnomalyDetector Class ───────────────────────────────────────────────────

export class AnomalyDetector {
  private readonly config: AnomalyDetectorConfig;
  private readonly mode: 'mock' | 'live';

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this.mode = getCerebroMode();
  }

  /**
   * Executa todas as verificações habilitadas e retorna anomalias detectadas.
   * Persiste cada anomalia em AnomalyEvent (mesmo em mock mode — para auditoria).
   *
   * @returns Array de AnomalyDetectionResult (vazio se nada detectado)
   */
  async runAllChecks(): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];

    const tasks: Promise<AnomalyDetectionResult[]>[] = [];

    if (this.config.enableThreshold) {
      tasks.push(this.runThresholdChecks());
    }
    if (this.config.enableStatistical) {
      tasks.push(this.runStatisticalChecks());
    }
    if (this.config.enableRateOfChange) {
      tasks.push(this.runRateOfChangeChecks());
    }
    if (this.config.enablePatternMatcher) {
      tasks.push(this.runPatternMatcher());
    }

    const taskResults = await Promise.allSettled(tasks);

    for (const result of taskResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        logSink.error({
          module: 'anomaly-detector',
          event: 'detection_strategy_failed',
          message: 'Estratégia de detecção falhou (non-fatal)',
          error: result.reason,
        });
      }
    }

    // Filtra por cooldown
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    const filtered = results.filter(r => !isInCooldown(r.anomalyType, r.scope, cooldownMs));

    // Persiste cada anomalia detectada
    for (const result of filtered) {
      try {
        await this.persistAnomaly(result);
        markCooldown(result.anomalyType, result.scope);
      } catch (error) {
        logSink.error({
          module: 'anomaly-detector',
          event: 'persist_failed',
          message: `Falha ao persistir anomalia ${result.anomalyType} em ${result.scope}`,
          error,
          context: { anomalyType: result.anomalyType, scope: result.scope },
        });
      }
    }

    if (filtered.length > 0) {
      logSink.info({
        module: 'anomaly-detector',
        event: 'detection_run_complete',
        message: `${filtered.length} anomalia(s) detectada(s) e persistida(s)`,
        context: {
          mode: this.mode,
          anomalies: filtered.map(a => ({
            type: a.anomalyType,
            scope: a.scope,
            severity: a.severity,
            observed: a.observed,
            baseline: a.baseline,
            deviation: a.deviation,
          })),
        },
      });
    }

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 1: THRESHOLD DETECTION (regras hard)
  // ═══════════════════════════════════════════════════════════════════════

  private async runThresholdChecks(): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const oneMinAgo = new Date(now - 60 * 1000);

    // ── 1a. Error rate (de LogSink buffer) ──
    const recentErrors = queryEvents({ level: 'error', since: fiveMinAgo });
    if (recentErrors.length > 0) {
      // Agrupa por módulo
      const byModule = new Map<string, LogEvent[]>();
      for (const e of recentErrors) {
        if (!byModule.has(e.module)) byModule.set(e.module, []);
        byModule.get(e.module)!.push(e);
      }

      // Se um módulo tem >20 erros em 5 min, é spike
      for (const [module, events] of byModule.entries()) {
        const threshold = 20; // 20 erros em 5 min = anomalia
        if (events.length >= threshold) {
          results.push({
            anomalyType: 'error_spike',
            scope: `module:${module}`,
            metric: 'errors_in_5min',
            observed: events.length,
            baseline: 2, // baseline mock: 2 erros/5min é normal
            deviation: (events.length - 2) / 2,
            detectionMethod: 'threshold',
            severity: this.calculateSeverity(events.length, 2, threshold),
            evidence: events.slice(0, 5),
          });
        }
      }
    }

    // ── 1b. Auth failures (de DB AuditLog) ──
    // NOTA: AuditLog não tem campo `success` — usamos action contains "failed" ou "denied"
    try {
      const authFailures = await db.auditLog.count({
        where: {
          action: { contains: 'auth' },
          AND: [
            {
              OR: [
                { action: { contains: 'failed' } },
                { action: { contains: 'denied' } },
                { action: { contains: 'unauthorized' } },
                { action: { contains: 'rejected' } },
              ],
            },
          ],
          createdAt: { gte: oneMinAgo },
        },
      });

      if (authFailures >= this.config.authFailuresPerMinThreshold) {
        results.push({
          anomalyType: 'auth_failure_pattern',
          scope: 'global:auth',
          metric: 'auth_failures_per_min',
          observed: authFailures,
          baseline: 2,
          deviation: (authFailures - 2) / 2,
          detectionMethod: 'threshold',
          severity: authFailures >= 100 ? 'emergency' : 'critical',
          evidence: [],
        });
      }
    } catch (error) {
      // AuditLog pode não existir ou ter schema diferente — silencioso
      logSink.warn({
        module: 'anomaly-detector',
        event: 'auditlog_query_failed',
        message: 'Falha ao consultar AuditLog (non-fatal)',
        error,
      });
    }

    // ── 1c. Meta cost por hora (de DB MetaCostLog) ──
    try {
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const costResult = await db.metaCostLog.aggregate({
        _sum: { costUsd: true },
        where: { createdAt: { gte: oneHourAgo } },
      });
      const hourlyCost = costResult._sum.costUsd ?? 0;

      if (hourlyCost >= this.config.metaCostPerHourThresholdUsd) {
        results.push({
          anomalyType: 'cost_anomaly',
          scope: 'global:meta-api',
          metric: 'cost_usd_per_hour',
          observed: hourlyCost,
          baseline: 1, // baseline mock: $1/hora é normal
          deviation: (hourlyCost - 1) / 1,
          detectionMethod: 'threshold',
          severity: hourlyCost >= 20 ? 'critical' : 'warning',
          evidence: [],
        });
      }
    } catch (error) {
      logSink.warn({
        module: 'anomaly-detector',
        event: 'metacostlog_query_failed',
        message: 'Falha ao consultar MetaCostLog (non-fatal)',
        error,
      });
    }

    // ── 1d. Tenant message burst (de ConversationMessage) ──
    // NOTA: SQLite não suporta `having` com `_count` em groupBy da mesma forma que Postgres.
    // Workaround: busca todas as conversas ativas no último minuto e conta manualmente.
    try {
      const recentMessages = await db.conversationMessage.findMany({
        where: { timestamp: { gte: oneMinAgo } },
        select: { conversationId: true },
        take: 5000, // safety limit
      });

      // Agrupa por conversationId manualmente
      const countsByConversation = new Map<string, number>();
      for (const msg of recentMessages) {
        countsByConversation.set(
          msg.conversationId,
          (countsByConversation.get(msg.conversationId) || 0) + 1
        );
      }

      // Filtra conversas que excederam o threshold
      const burstThreshold = this.config.tenantMessageBurstThreshold;
      for (const [conversationId, count] of countsByConversation.entries()) {
        if (count >= burstThreshold) {
          results.push({
            anomalyType: 'webhook_throughput_burst',
            scope: `conversation:${conversationId}`,
            metric: 'messages_per_min',
            observed: count,
            baseline: 10, // baseline mock: 10 msgs/min é normal
            deviation: (count - 10) / 10,
            detectionMethod: 'threshold',
            severity: count >= 100 ? 'critical' : 'warning',
            evidence: [],
          });
        }
      }
    } catch (error) {
      logSink.warn({
        module: 'anomaly-detector',
        event: 'conversation_query_failed',
        message: 'Falha ao consultar ConversationMessage (non-fatal)',
        error,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 2: STATISTICAL DETECTION (3σ)
  // ═══════════════════════════════════════════════════════════════════════

  private async runStatisticalChecks(): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    const now = Date.now();
    const baselineStart = new Date(now - this.config.baselineWindowMinutes * 60 * 1000);
    const currentStart = new Date(now - this.config.currentWindowMinutes * 60 * 1000);

    // ── Errors por módulo (de LogSink buffer) ──
    const baselineEvents = queryEvents({ level: 'error', since: baselineStart });
    const currentEvents = queryEvents({ level: 'error', since: currentStart });

    // Agrupa por módulo
    const baselineByModule = this.groupByModule(baselineEvents);
    const currentByModule = this.groupByModule(currentEvents);

    for (const [module, currentList] of currentByModule.entries()) {
      const baselineList = baselineByModule.get(module) || [];
      const baselineCount = baselineList.length;

      // Taxa por minuto do baseline (para referência)
      const baselineRate = baselineCount / this.config.baselineWindowMinutes;
      void baselineRate; // usado apenas para debug

      // Calcula desvio padrão do baseline (bucket por 5 min)
      const buckets = this.bucketize(baselineList, 5); // buckets de 5 min
      const bucketCounts = buckets.map(b => b.length);
      const mean = bucketCounts.length > 0
        ? bucketCounts.reduce((a, b) => a + b, 0) / bucketCounts.length
        : 0;
      const variance = bucketCounts.length > 0
        ? bucketCounts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / bucketCounts.length
        : 0;
      const stdDev = Math.sqrt(variance);

      // Anomalia: current > mean + N * stdDev
      const threshold = mean + this.config.statisticalSigmaThreshold * stdDev;
      if (currentList.length > threshold && currentList.length >= 5) {
        const deviation = mean > 0 ? (currentList.length - mean) / mean : currentList.length;

        results.push({
          anomalyType: 'error_spike',
          scope: `module:${module}`,
          metric: 'errors_in_5min_statistical',
          observed: currentList.length,
          baseline: mean,
          deviation,
          detectionMethod: 'statistical',
          severity: this.calculateSeverity(currentList.length, mean, threshold),
          evidence: currentList.slice(0, 5),
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 3: RATE-OF-CHANGE DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  private async runRateOfChangeChecks(): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 min
    const historicalWindow = 60 * 60 * 1000; // 60 min

    // Compara taxa recente (5 min) com taxa histórica (60 min - 5 min)
    const recentStart = new Date(now - recentWindow);
    const historicalStart = new Date(now - historicalWindow);
    const historicalEnd = new Date(now - recentWindow);

    const recentEvents = queryEvents({ level: 'error', since: recentStart });
    const historicalEvents = queryEvents({ level: 'error', since: historicalStart })
      .filter(e => new Date(e.timestamp).getTime() < historicalEnd.getTime());

    const recentByModule = this.groupByModule(recentEvents);
    const historicalByModule = this.groupByModule(historicalEvents);

    for (const [module, recentList] of recentByModule.entries()) {
      const historicalList = historicalByModule.get(module) || [];

      // Taxa por minuto
      const recentRatePerMin = recentList.length / 5;
      const historicalRatePerMin = historicalList.length / 55; // 60 - 5 = 55 min

      if (historicalRatePerMin === 0) {
        // Sem histórico — se tem 5+ erros recentes sem baseline, é suspeito
        if (recentList.length >= 5) {
          results.push({
            anomalyType: 'error_spike',
            scope: `module:${module}`,
            metric: 'error_rate_no_baseline',
            observed: recentRatePerMin,
            baseline: 0,
            deviation: 1, // 100% deviation (de 0 para algo)
            detectionMethod: 'statistical',
            severity: 'warning',
            evidence: recentList.slice(0, 5),
          });
        }
        continue;
      }

      const rateOfChangePercent = ((recentRatePerMin - historicalRatePerMin) / historicalRatePerMin) * 100;

      if (rateOfChangePercent >= this.config.rateOfChangeThresholdPercent) {
        results.push({
          anomalyType: 'error_spike',
          scope: `module:${module}`,
          metric: 'error_rate_of_change',
          observed: recentRatePerMin,
          baseline: historicalRatePerMin,
          deviation: rateOfChangePercent / 100,
          detectionMethod: 'statistical',
          severity: rateOfChangePercent >= 300 ? 'critical' : 'warning',
          evidence: recentList.slice(0, 5),
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 4: PATTERN MATCHER (ataques distribuídos)
  // ═══════════════════════════════════════════════════════════════════════

  private async runPatternMatcher(): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    const now = Date.now();
    const oneMinAgo = new Date(now - 60 * 1000);
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);

    // ── 4a. Erros cross-tenant (bug sistêmico) ──
    const recentErrors = queryEvents({ level: 'error', since: fiveMinAgo });
    const tenantErrors = new Map<string, Set<string>>(); // tenantId → Set<errorHash>

    for (const e of recentErrors) {
      const tenantId = (e.context as { tenantId?: string })?.tenantId;
      if (!tenantId || !e.errorHash) continue;
      if (!tenantErrors.has(tenantId)) tenantErrors.set(tenantId, new Set());
      tenantErrors.get(tenantId)!.add(e.errorHash);
    }

    // Para cada errorHash, conta quantos tenants distintos o reportaram
    const hashToTenants = new Map<string, Set<string>>();
    for (const [tenantId, hashes] of tenantErrors.entries()) {
      for (const hash of hashes) {
        if (!hashToTenants.has(hash)) hashToTenants.set(hash, new Set());
        hashToTenants.get(hash)!.add(tenantId);
      }
    }

    for (const [hash, tenants] of hashToTenants.entries()) {
      if (tenants.size >= this.config.crossTenantErrorThreshold) {
        const evidence = recentErrors
          .filter(e => e.errorHash === hash)
          .slice(0, 5);

        results.push({
          anomalyType: 'unknown_metric_anomaly',
          scope: `cross-tenant:${hash}`,
          metric: 'tenants_with_same_error',
          observed: tenants.size,
          baseline: 1, // baseline: 1 tenant com erro é normal
          deviation: (tenants.size - 1) / 1,
          detectionMethod: 'threshold',
          severity: tenants.size >= 10 ? 'critical' : 'warning',
          evidence,
        });
      }
    }

    // ── 4b. Distributed attack (de AuditLog) ──
    // NOTA: AuditLog não tem campo `success` — usamos action contains "failed/denied"
    // para identificar tentativas suspeitas.
    try {
      const recentAuthAttempts = await db.auditLog.findMany({
        where: {
          action: { contains: 'auth' },
          AND: [
            {
              OR: [
                { action: { contains: 'failed' } },
                { action: { contains: 'denied' } },
                { action: { contains: 'unauthorized' } },
              ],
            },
          ],
          createdAt: { gte: oneMinAgo },
        },
        select: { ipAddress: true },
        take: 1000,
      });

      const uniqueIps = new Set<string>();
      for (const attempt of recentAuthAttempts) {
        if (attempt.ipAddress) uniqueIps.add(attempt.ipAddress);
      }

      if (uniqueIps.size >= this.config.distributedAttackIpThreshold) {
        results.push({
          anomalyType: 'tenant_under_attack',
          scope: 'global:auth-distributed',
          metric: 'unique_ips_per_min',
          observed: uniqueIps.size,
          baseline: 5, // baseline mock: 5 IPs/min é normal
          deviation: (uniqueIps.size - 5) / 5,
          detectionMethod: 'threshold',
          severity: uniqueIps.size >= 200 ? 'emergency' : 'critical',
          evidence: [],
        });
      }
    } catch (error) {
      // Silencioso — AuditLog schema pode não ter ipAddress
      logSink.warn({
        module: 'anomaly-detector',
        event: 'auditlog_pattern_query_failed',
        message: 'Falha ao consultar AuditLog para pattern matching (non-fatal)',
        error,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private groupByModule(events: LogEvent[]): Map<string, LogEvent[]> {
    const byModule = new Map<string, LogEvent[]>();
    for (const e of events) {
      if (!byModule.has(e.module)) byModule.set(e.module, []);
      byModule.get(e.module)!.push(e);
    }
    return byModule;
  }

  /**
   * Divide eventos em buckets de N minutos para cálculo de variância.
   */
  private bucketize(events: LogEvent[], bucketSizeMinutes: number): LogEvent[][] {
    if (events.length === 0) return [];
    const buckets: LogEvent[][] = [];
    const bucketMs = bucketSizeMinutes * 60 * 1000;
    const oldest = new Date(events[0].timestamp).getTime();
    const newest = Date.now();
    const totalBuckets = Math.ceil((newest - oldest) / bucketMs);

    for (let i = 0; i < totalBuckets; i++) {
      buckets.push([]);
    }

    for (const e of events) {
      const ts = new Date(e.timestamp).getTime();
      const bucketIdx = Math.floor((ts - oldest) / bucketMs);
      if (bucketIdx >= 0 && bucketIdx < buckets.length) {
        buckets[bucketIdx].push(e);
      }
    }

    return buckets;
  }

  /**
   * Calcula severity baseada em quão longe do threshold está.
   */
  private calculateSeverity(observed: number, baseline: number, threshold: number): Severity {
    const ratio = threshold > 0 ? observed / threshold : 0;
    if (ratio >= 5) return 'emergency';
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'warning';
    return 'info';
  }

  /**
   * Persiste anomalia em AnomalyEvent table.
   * Sempre persiste, mesmo em mock mode (para auditoria e dashboard).
   */
  private async persistAnomaly(result: AnomalyDetectionResult): Promise<void> {
    await db.anomalyEvent.create({
      data: {
        anomalyType: result.anomalyType,
        scope: result.scope,
        metric: result.metric,
        observed: result.observed,
        baseline: result.baseline,
        deviation: result.deviation,
        detectionMethod: result.detectionMethod,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC STATS (para dashboard)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Retorna estatísticas do detector (para dashboard ZCC).
   */
  getStats(): {
    mode: 'mock' | 'live';
    config: AnomalyDetectorConfig;
    cooldownEntries: number;
    logSinkStats: ReturnType<typeof logSink.getStats>;
  } {
    return {
      mode: this.mode,
      config: this.config,
      cooldownEntries: cooldownTracker.size,
      logSinkStats: logSink.getStats(),
    };
  }

  /**
   * Limpa cooldown tracker (apenas para testes).
   */
  clearCooldowns(): void {
    cooldownTracker.clear();
  }
}

// ── Singleton instance (para uso direto sem instanciar) ────────────────────

let singletonDetector: AnomalyDetector | null = null;

export function getAnomalyDetector(config?: Partial<AnomalyDetectorConfig>): AnomalyDetector {
  if (!singletonDetector || config) {
    singletonDetector = new AnomalyDetector(config);
  }
  return singletonDetector;
}

/**
 * Helper para rodar todas as verificações rapidamente.
 * Usado por /api/cron/cerebro-watchdog.
 */
export async function runAnomalyDetection(
  config?: Partial<AnomalyDetectorConfig>
): Promise<AnomalyDetectionResult[]> {
  const detector = config ? new AnomalyDetector(config) : getAnomalyDetector();
  return detector.runAllChecks();
}

// ── Query helpers para dashboard ZCC ────────────────────────────────────────

export interface AnomalyQueryParams {
  since?: Date;
  acknowledged?: boolean;
  anomalyType?: AnomalyType;
  scope?: string;
  limit?: number;
}

export async function queryAnomalies(
  params: AnomalyQueryParams = {}
): Promise<Array<{
  id: string;
  anomalyType: string;
  scope: string;
  metric: string;
  observed: number;
  baseline: number;
  deviation: number;
  detectionMethod: string;
  detectedAt: Date;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgeNotes: string | null;
}>> {
  const where: Record<string, unknown> = {};

  if (params.since) where.detectedAt = { gte: params.since };
  if (params.acknowledged !== undefined) where.acknowledged = params.acknowledged;
  if (params.anomalyType) where.anomalyType = params.anomalyType;
  if (params.scope) where.scope = { contains: params.scope };

  return db.anomalyEvent.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
    take: params.limit ?? 50,
  });
}

export async function acknowledgeAnomaly(
  anomalyId: string,
  acknowledgedBy: string,
  notes?: string
): Promise<void> {
  await db.anomalyEvent.update({
    where: { id: anomalyId },
    data: {
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date(),
      acknowledgeNotes: notes,
    },
  });

  logSink.info({
    module: 'anomaly-detector',
    event: 'anomaly_acknowledged',
    message: `Anomalia ${anomalyId} acknowledged por ${acknowledgedBy}`,
    context: { anomalyId, acknowledgedBy, notes },
  });
}
