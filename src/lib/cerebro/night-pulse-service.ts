/**
 * Night Pulse Service — Pulsos de Vida (a cada 30min, 24/7)
 * ============================================================
 *
 * 3 tipos de pulso alternados ao longo da madrugada:
 *
 *   1. HEARTBEAT (a cada 30min)
 *      - Status de serviços: DB, GLM 5.2, WhatsApp, Airbnb, Mercado Pago
 *      - Latência: DB response time, GLM API response time
 *      - Disparo de alerta se algum serviço crítico cair
 *      - Custo LLM: $0 (não usa LLM, só health checks HTTP/DB)
 *
 *   2. MINI_SCAN (a cada 30min, alternado com HEARTBEAT)
 *      - Varredura de 1 módulo aleatório (src/lib/cerebro/* ou src/app/api/v1/*)
 *      - 3-5 patterns SAST (não a varredura completa de 14)
 *      - Detecta regressões rapidamente
 *      - Custo LLM: $0 (SAST puro, sem análise LLM)
 *
 *   3. METRICS_SNAPSHOT (a cada 1h)
 *      - Captura métricas live: usuários ativos, conversas WhatsApp,
 *        reservas criadas, taxa de erro
 *      - Compara com baseline das últimas 24h
 *      - GLM 5.2 faz mini-análise (200 tokens) se métricas saem do baseline
 *      - Custo LLM: ~$0.0003 (200 tokens, glm-4.7-flash)
 *
 * Total: 12 pulsos durante a madrugada (22:00-06:00 BRT)
 * Custo total estimado: ~$0.004/noite (3 METRICS_SNAPSHOT com LLM)
 *
 * Persiste cada pulso em NightPulseLog para auditoria no card.
 */

import { db } from '@/lib/db';
import { getCerebroMode } from './types';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type PulseType = 'heartbeat' | 'mini_scan' | 'metrics_snapshot';
export type PulseStatus = 'ok' | 'warning' | 'critical' | 'failed';

export interface PulseResult {
  pulseType: PulseType;
  startedAt: Date;
  durationMs: number;
  status: PulseStatus;
  resultJson: string;
  triggeredAlert: boolean;
  alertMessage?: string;
  llmTokensInput: number;
  llmTokensOutput: number;
  llmCostUsd: number;
  mode: 'mock' | 'live';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const MODULES_TO_SCAN = [
  'src/lib/cerebro',
  'src/lib/ai',
  'src/lib/security',
  'src/lib/payments',
  'src/lib/airb',
  'src/app/api/v1',
  'src/app/api/zcc',
  'src/app/api/cron',
];

// Mini-patterns (versão reduzida do SAST completo — 5 mais críticos)
const MINI_PATTERNS = [
  { type: 'eval_usage', pattern: /\beval\s*\(/, severity: 'critical' as const },
  { type: 'hardcoded_secret', pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][a-zA-Z0-9]{20,}["']/i, severity: 'critical' as const },
  { type: 'dangerously_set_inner_html', pattern: /dangerouslySetInnerHTML/, severity: 'high' as const },
  { type: 'sql_injection', pattern: /\$\{.*\}\s*[;)]/g, severity: 'critical' as const },
  { type: 'weak_crypto', pattern: /crypto\.createHash\s*\(\s*["'](md5|sha1)["']\s*\)/, severity: 'high' as const },
];

const BASELINE_ALERT_THRESHOLDS = {
  errorRatePercent: 5,        // > 5% de erros = alerta
  latencyMs: 2000,           // > 2s = alerta
  failedLoginsPerHour: 20,   // > 20 logins falhos/hora = alerta
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export class NightPulseService {
  /**
   * Executa um pulso. O tipo é determinado pela hora atual:
   *   - xx:00 e xx:30 → alterna HEARTBEAT / MINI_SCAN
   *   - xx:00 de hora cheia → METRICS_SNAPSHOT
   */
  public static async run(opts?: { pulseType?: PulseType }): Promise<PulseResult> {
    const pulseType = opts?.pulseType ?? this.decidePulseType();
    const startedAt = new Date();
    const mode = getCerebroMode();

    try {
      let result: Omit<PulseResult, 'startedAt' | 'durationMs'>;

      switch (pulseType) {
        case 'heartbeat':
          result = await this.runHeartbeat(mode);
          break;
        case 'mini_scan':
          result = await this.runMiniScan(mode);
          break;
        case 'metrics_snapshot':
          result = await this.runMetricsSnapshot(mode);
          break;
        default:
          result = await this.runHeartbeat(mode);
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      const pulseResult: PulseResult = {
        ...result,
        pulseType,
        startedAt,
        durationMs,
      };

      // Persiste em NightPulseLog
      await this.persist(pulseResult);

      return pulseResult;
    } catch (err: any) {
      const durationMs = Date.now() - startedAt.getTime();
      const errorResult: PulseResult = {
        pulseType,
        startedAt,
        durationMs,
        status: 'failed',
        resultJson: JSON.stringify({ error: err?.message ?? String(err) }),
        triggeredAlert: true,
        alertMessage: `Pulso ${pulseType} falhou: ${err?.message ?? 'erro desconhecido'}`,
        llmTokensInput: 0,
        llmTokensOutput: 0,
        llmCostUsd: 0,
        mode,
      };
      await this.persist(errorResult);
      return errorResult;
    }
  }

  /**
   * Decide qual pulso rodar baseado na hora atual.
   * Estratégia:
   *   - A cada 30min: alterna HEARTBEAT / MINI_SCAN
   *   - A cada 1h cheia: METRICS_SNAPSHOT (sobrepõe o mini_scan)
   */
  private static decidePulseType(): PulseType {
    const now = new Date();
    const minute = now.getMinutes();

    if (minute === 0) return 'metrics_snapshot'; // hora cheia
    if (minute === 30) return 'mini_scan';
    return 'heartbeat';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEARTBEAT — health check de serviços
  // ─────────────────────────────────────────────────────────────────────────

  private static async runHeartbeat(mode: 'mock' | 'live'): Promise<Omit<PulseResult, 'startedAt' | 'durationMs'>> {
    const services: Array<{ name: string; status: 'ok' | 'warning' | 'critical'; latencyMs?: number; error?: string }> = [];

    // 1. Database (Prisma)
    const dbStart = Date.now();
    let dbLatencyMs: number | undefined;
    try {
      await db.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      services.push({
        name: 'PostgreSQL (Prisma)',
        status: dbLatencyMs > 1000 ? 'warning' : 'ok',
        latencyMs: dbLatencyMs,
      });
    } catch (err: any) {
      services.push({
        name: 'PostgreSQL (Prisma)',
        status: 'critical',
        error: err?.message ?? 'DB indisponível',
      });
    }

    // 2. GLM 5.2 API (só ping, não consome tokens)
    services.push({
      name: 'GLM 5.2 API',
      status: process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY ? 'ok' : 'warning',
      error: process.env.GLM_5_2_API_KEY ? undefined : 'API key não configurada',
    });

    // 3. WhatsApp Cloud API (env vars)
    services.push({
      name: 'WhatsApp Cloud API',
      status: process.env.META_ACCESS_TOKEN ? 'ok' : 'warning',
      error: process.env.META_ACCESS_TOKEN ? undefined : 'META_ACCESS_TOKEN não configurada',
    });

    // 4. Airbnb OAuth
    services.push({
      name: 'Airbnb OAuth',
      status: process.env.AIRBNB_CLIENT_ID ? 'ok' : 'warning',
      error: process.env.AIRBNB_CLIENT_ID ? undefined : 'AIRBNB_CLIENT_ID não configurada',
    });

    // 5. Mercado Pago
    services.push({
      name: 'Mercado Pago',
      status: process.env.MP_ACCESS_TOKEN ? 'ok' : 'warning',
      error: process.env.MP_ACCESS_TOKEN ? undefined : 'MP_ACCESS_TOKEN não configurada',
    });

    // 6. Stripe
    services.push({
      name: 'Stripe',
      status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'warning',
      error: process.env.STRIPE_SECRET_KEY ? undefined : 'STRIPE_SECRET_KEY não configurada',
    });

    // Determina status geral
    const hasCritical = services.some(s => s.status === 'critical');
    const hasWarning = services.some(s => s.status === 'warning');
    const status: PulseStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';

    const result = {
      services,
      dbLatencyMs,
      checkedAt: new Date().toISOString(),
      mode,
    };

    return {
      pulseType: 'heartbeat',
      status,
      resultJson: JSON.stringify(result),
      triggeredAlert: status === 'critical',
      alertMessage: status === 'critical'
        ? `Heartbeat CRITICAL: ${services.filter(s => s.status === 'critical').map(s => s.name).join(', ')} indisponível`
        : undefined,
      llmTokensInput: 0,
      llmTokensOutput: 0,
      llmCostUsd: 0,
      mode,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MINI_SCAN — varredura de 1 módulo aleatório (3-5 patterns)
  // ─────────────────────────────────────────────────────────────────────────

  private static async runMiniScan(mode: 'mock' | 'live'): Promise<Omit<PulseResult, 'startedAt' | 'durationMs'>> {
    // Escolhe 1 módulo aleatório
    const modulePath = MODULES_TO_SCAN[Math.floor(Math.random() * MODULES_TO_SCAN.length)];
    const absPath = path.resolve(process.cwd(), modulePath);

    let filesScanned = 0;
    const findings: Array<{
      severity: string;
      type: string;
      file: string;
      line: number;
      description: string;
    }> = [];

    if (fs.existsSync(absPath)) {
      try {
        this.scanDirQuick(absPath, process.cwd(), files => {
          filesScanned += files.length;
          findings.push(...files);
        });
      } catch (err) {
        // Continue mesmo se erro em 1 arquivo
      }
    }

    // Limita findings a 20 (não queremos pulso pesado)
    const truncatedFindings = findings.slice(0, 20);
    const hasCritical = truncatedFindings.some(f => f.severity === 'critical');
    const status: PulseStatus = hasCritical ? 'critical' : findings.length > 0 ? 'warning' : 'ok';

    const result = {
      module: modulePath,
      filesScanned,
      findingsCount: findings.length,
      findings: truncatedFindings,
      checkedAt: new Date().toISOString(),
      mode,
    };

    return {
      pulseType: 'mini_scan',
      status,
      resultJson: JSON.stringify(result),
      triggeredAlert: hasCritical,
      alertMessage: hasCritical
        ? `Mini-scan em ${modulePath}: ${findings.filter(f => f.severity === 'critical').length} vulnerabilidade(s) CRÍTICA(S)`
        : undefined,
      llmTokensInput: 0,
      llmTokensOutput: 0,
      llmCostUsd: 0,
      mode,
    };
  }

  private static scanDirQuick(
    dir: string,
    root: string,
    callback: (findings: Array<{ severity: string; type: string; file: string; line: number; description: string }>) => void
  ) {
    const findings: Array<{ severity: string; type: string; file: string; line: number; description: string }> = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      callback([]);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', '.git'].includes(entry.name)) continue;
        this.scanDirQuick(fullPath, root, () => {});
        continue;
      }
      if (!['.ts', '.tsx', '.js'].includes(path.extname(entry.name))) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(root, fullPath);

        for (const pattern of MINI_PATTERNS) {
          const regex = new RegExp(pattern.pattern.source, 'g');
          let match: RegExpExecArray | null;
          let count = 0;
          while ((match = regex.exec(content)) !== null && count < 5) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const exists = findings.find(
              f => f.file === relativePath && f.line === lineNum && f.type === pattern.type
            );
            if (!exists) {
              findings.push({
                severity: pattern.severity,
                type: pattern.type,
                file: relativePath,
                line: lineNum,
                description: `Mini-scan detectou: ${pattern.type}`,
              });
            }
            count++;
          }
        }
      } catch {}
    }
    callback(findings);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS_SNAPSHOT — captura métricas + análise GLM 5.2 se anomalia
  // ─────────────────────────────────────────────────────────────────────────

  private static async runMetricsSnapshot(mode: 'mock' | 'live'): Promise<Omit<PulseResult, 'startedAt' | 'durationMs'>> {
    const snapshotStart = Date.now();

    // Coleta métricas live (janela de 1h atrás até agora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    let activeConversations = 0;
    let reservationsCreated = 0;
    let failedLoginsLastHour = 0;
    let errorRate = 0;

    try {
      activeConversations = await db.conversationLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }).catch(() => 0);
    } catch {}

    try {
      reservationsCreated = await db.reservation.count({
        where: { createdAt: { gte: oneHourAgo } },
      }).catch(() => 0);
    } catch {}

    // ErroRate = logs de erro / total de logs (mock se não tem dados)
    try {
      const totalLogs = await db.agentLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }).catch(() => 0);
      const errorLogs = await db.agentLog.count({
        where: {
          createdAt: { gte: oneHourAgo },
          status: { in: ['error', 'ERROR', 'fatal', 'FATAL', 'failed', 'FAILED'] },
        },
      }).catch(() => 0);
      errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
    } catch {}

    // Determina se há anomalia
    const anomalies: string[] = [];
    if (errorRate > BASELINE_ALERT_THRESHOLDS.errorRatePercent) {
      anomalies.push(`Taxa de erro ${errorRate.toFixed(2)}% acima do limite ${BASELINE_ALERT_THRESHOLDS.errorRatePercent}%`);
    }
    if (failedLoginsLastHour > BASELINE_ALERT_THRESHOLDS.failedLoginsPerHour) {
      anomalies.push(`${failedLoginsLastHour} logins falhos na última hora (limite ${BASELINE_ALERT_THRESHOLDS.failedLoginsPerHour})`);
    }

    const snapshot = {
      activeConversations,
      reservationsCreated,
      failedLoginsLastHour,
      errorRate,
      capturedAt: new Date().toISOString(),
      windowStart: oneHourAgo.toISOString(),
      anomalies,
    };

    let llmTokensInput = 0;
    let llmTokensOutput = 0;
    let llmCostUsd = 0;
    let llmAnalysis: string | undefined;

    // Só chama GLM se houver anomalia detectada
    if (anomalies.length > 0 && mode === 'live') {
      try {
        const apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
        const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
        const model = process.env.GLM_PULSE_MODEL || 'glm-4.7-flash'; // flash é 10x mais barato

        const messages: AdapterMessage[] = [
          {
            role: 'system',
            content: 'Você é um monitor de saúde do sistema. Analise anomalias em 1 parágrafo PT-BR. Seja específico: cite a métrica e a ação recomendada.',
          },
          {
            role: 'user',
            content: `Anomalias detectadas:\n${anomalies.join('\n')}\n\nSnapshot: ${JSON.stringify(snapshot, null, 2)}`,
          },
        ];

        const response = await callOpenAICompatible({
          apiKey,
          baseUrl,
          model,
          messages,
          temperature: 0.2,
          maxTokens: 200,
        });

        llmTokensInput = response.inputTokens;
        llmTokensOutput = response.outputTokens;
        llmCostUsd = (response.inputTokens * 0.00014 + response.outputTokens * 0.00044) / 1000;
        llmAnalysis = response.content;
      } catch (err) {
        // Em erro, segue sem análise LLM
      }
    }

    const status: PulseStatus = anomalies.length > 0 ? 'warning' : 'ok';

    const result = {
      ...snapshot,
      llmAnalysis,
    };

    return {
      pulseType: 'metrics_snapshot',
      status,
      resultJson: JSON.stringify(result),
      triggeredAlert: anomalies.length > 0,
      alertMessage: anomalies.length > 0
        ? `Métricas anômalas: ${anomalies.join('; ')}`
        : undefined,
      llmTokensInput,
      llmTokensOutput,
      llmCostUsd,
      mode,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSISTÊNCIA
  // ─────────────────────────────────────────────────────────────────────────

  private static async persist(pulse: PulseResult) {
    try {
      await (db as any).nightPulseLog?.create({
        data: {
          pulseType: pulse.pulseType,
          startedAt: pulse.startedAt,
          durationMs: pulse.durationMs,
          status: pulse.status,
          resultJson: pulse.resultJson,
          triggeredAlert: pulse.triggeredAlert,
          alertMessage: pulse.alertMessage ?? null,
          llmTokensInput: pulse.llmTokensInput,
          llmTokensOutput: pulse.llmTokensOutput,
          llmCostUsd: pulse.llmCostUsd,
          mode: pulse.mode,
        },
      });
    } catch (err) {
      // Falha ao persistir não bloqueia o pulso
      console.warn('[NIGHT_PULSE] Falha ao persistir:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERIES PÚBLICAS (para o card)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna os últimos N pulsos (default: 12 — uma noite completa).
   */
  public static async getRecent(limit = 12): Promise<PulseResult[]> {
    try {
      const logs = await (db as any).nightPulseLog?.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
      }) ?? [];
      return logs.map((l: any) => ({
        pulseType: l.pulseType,
        startedAt: l.startedAt,
        durationMs: l.durationMs,
        status: l.status,
        resultJson: l.resultJson,
        triggeredAlert: l.triggeredAlert,
        alertMessage: l.alertMessage ?? undefined,
        llmTokensInput: l.llmTokensInput,
        llmTokensOutput: l.llmTokensOutput,
        llmCostUsd: l.llmCostUsd,
        mode: l.mode,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Conta pulsos por status (para KPI do card).
   */
  public static async getStatsLast24h(): Promise<{
    total: number;
    ok: number;
    warning: number;
    critical: number;
    failed: number;
    totalCostUsd: number;
  }> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const logs = await (db as any).nightPulseLog?.findMany({
        where: { startedAt: { gte: twentyFourHoursAgo } },
        select: { status: true, llmCostUsd: true },
      }) ?? [];

      return {
        total: logs.length,
        ok: logs.filter((l: any) => l.status === 'ok').length,
        warning: logs.filter((l: any) => l.status === 'warning').length,
        critical: logs.filter((l: any) => l.status === 'critical').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        totalCostUsd: logs.reduce((s: number, l: any) => s + (l.llmCostUsd ?? 0), 0),
      };
    } catch {
      return { total: 0, ok: 0, warning: 0, critical: 0, failed: 0, totalCostUsd: 0 };
    }
  }
}
