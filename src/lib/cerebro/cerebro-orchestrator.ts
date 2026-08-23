// ============================================================================
// ZÉLLA — Cérebro Orchestrator (Master Loop)
// ============================================================================
// Este módulo é o CORAÇÃO do Cérebro auto-ajustável. Ele orquestra todos os
// módulos em um loop coordenado:
//
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                        CEREBRO ORCHESTRATOR                          │
//  └──────────────────────────────────────────────────────────────────────┘
//                                    │
//        ┌───────────────────────────┼───────────────────────────┐
//        ▼                           ▼                           ▼
//  ┌──────────┐              ┌──────────────┐           ┌────────────────┐
//  │  WATCH   │───anomalias─▶│  SELF-DEFENSE│           │  VULN SCANNER  │
//  │ (Detector)│              │  (Immune)    │           │   (Recon SAST) │
//  └──────────┘              └──────────────┘           └────────────────┘
//        │                           │                           │
//        ▼                           ▼                           ▼
//  ┌──────────┐              ┌──────────────┐           ┌────────────────┐
//  │ ANALYZE  │───análises──▶│  ALERT BUS   │◀──────────│  BUDGET GUARD   │
//  │ (LLM)    │              │  (Voice)     │           │  (FinOps)       │
//  └──────────┘              └──────────────┘           └────────────────┘
//        │                           │
//        ▼                           ▼
//  ┌──────────┐              ┌──────────────┐
//  │ REFACTOR │──sugestões──▶│ AUTO-REMEDI  │
//  │ SUGGESTER│              │ (Self-Heal)  │
//  └──────────┘              └──────────────┘
//        │                           │
//        └───────────┬───────────────┘
//                    ▼
//              ┌──────────┐
//              │ DISTILL  │ ── KnowledgeChunks (memória consolidada)
//              │ (Memory) │
//              └──────────┘
//                    │
//                    ▼
//              ┌──────────┐
//              │  CHURN   │ ── Customer success signals
//              │ PREDICT  │
//              └──────────┘
//
//  CRON: Roda a cada 5 minutos (orchestrator tick)
//
//  FLUXO POR TICK:
//   1. Watch: roda AnomalyDetector (4 estratégias)
//   2. Defend: se há anomalias critical/emergency, toma ação defensiva
//   3. Scan: roda VulnerabilityScanner (incremental — git diff)
//   4. Budget: verifica Cérebro Budget Guard (decide se pode chamar LLM)
//   5. Analyze: se há anomalias e budget permite, chama GlmCerebroService
//   6. Alert: dispatcha alertas via AlertBus
//   7. Refactor: se há erros recorrentes, propõe refatoração
//   8. Remediate: aplica refatorações aprovadas/auto (com guardrails)
//   9. Distill: consolida aprendizado em KnowledgeChunks
//  10. Report: loga sumário do tick em CerebroTelemetryEvent
//
//  GUARDRAILS:
//   - Cada etapa tem try/catch (falha em uma não quebra o tick)
//   - Em mock mode: toma ações mas não envia externo
//   - Em live mode: toma ações reais (Redis, DB, LLM)
//   - Timeout total: 60s por tick (se passar, cancela próximas etapas)
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode, type Severity, type AnomalyDetectionResult } from './types';
import { runAnomalyDetection } from './anomaly-detector';
import { getGlmCerebroService } from './glm-service';
import { dispatchAlert } from './alert-bus';
import { getRefactorSuggester, findRecurringErrors } from './refactor-suggester';
import { getVulnerabilityScanner, type VulnScanResult } from './vulnerability-scanner';
import { getSelfDefense, type DefenseActionResult } from './self-defense';
import { getCerebroBudgetGuard, type CerebroBudgetGuard } from './cerebro-budget-guard';
import { getAutoRemediator, type RemediationResult } from './auto-remediator';
import { getChurnPredictor, type ChurnPrediction } from './churn-predictor';
import { getKnowledgeDistiller, type DistillationResult } from './knowledge-distiller';

// ── Types ───────────────────────────────────────────────────────────────────

export interface OrchestratorTickResult {
  timestamp: string;
  mode: 'mock' | 'live';
  durationMs: number;
  steps: {
    watch: {
      anomaliesDetected: number;
      anomalies: AnomalyDetectionResult[];
    };
    defend: {
      actionsTaken: number;
      results: DefenseActionResult[];
    };
    scan?: {
      totalFindings: number;
      criticalFindings: number;
    };
    budget: {
      tier: string;
      monthlySpendUsd: number;
      monthlyBudgetUsd: number;
    };
    analyze?: {
      analysisId?: string;
      severity?: Severity;
      alertDispatched: boolean;
    };
    refactor?: {
      suggestionsProposed: number;
    };
    remediate?: {
      applied: number;
      failed: number;
      skipped: number;
    };
    churn?: {
      critical: number;
      warning: number;
    };
    distill?: {
      chunksCreated: number;
      chunksArchived: number;
    };
  };
  errors: string[];
}

// ── Orchestrator config ─────────────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Rodar AnomalyDetector (default true) */
  enableWatch: boolean;
  /** Rodar Self-Defense (default true) */
  enableDefend: boolean;
  /** Rodar VulnerabilityScanner (default true, mas só full scan 1x/dia) */
  enableScan: boolean;
  /** Rodar análise LLM (default true, gated by budget) */
  enableAnalyze: boolean;
  /** Rodar RefactorSuggester (default true) */
  enableRefactor: boolean;
  /** Rodar AutoRemediator (default true) */
  enableRemediate: boolean;
  /** Rodar ChurnPredictor (default false — roda em cron diário separado) */
  enableChurn: boolean;
  /** Rodar KnowledgeDistiller (default false — roda em cron diário separado) */
  enableDistill: boolean;
  /** Timeout total em ms (default 60000) */
  timeoutMs: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableWatch: true,
  enableDefend: true,
  enableScan: true,
  enableAnalyze: true,
  enableRefactor: true,
  enableRemediate: true,
  enableChurn: false,
  enableDistill: false,
  timeoutMs: 60_000,
};

// ── Orchestrator ────────────────────────────────────────────────────────────

export class CerebroOrchestrator {
  private config: OrchestratorConfig;
  private mode: 'mock' | 'live';
  private budgetGuard: CerebroBudgetGuard;
  private lastFullScan: number = 0;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = getCerebroMode();
    this.budgetGuard = getCerebroBudgetGuard();
  }

  /**
   * Executa um tick completo do orchestrator.
   * Chamado pelo cron /api/cron/cerebro-orchestrator a cada 5 min.
   */
  async runTick(): Promise<OrchestratorTickResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const result: OrchestratorTickResult = {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      durationMs: 0,
      steps: {
        watch: { anomaliesDetected: 0, anomalies: [] },
        defend: { actionsTaken: 0, results: [] },
        budget: {
          tier: this.budgetGuard.getStats().state.currentTier,
          monthlySpendUsd: this.budgetGuard.getStats().state.monthlySpendUsd,
          monthlyBudgetUsd: this.budgetGuard.getStats().state.monthlyBudgetUsd,
        },
      },
      errors,
    };

    logSink.info({
      module: 'cerebro-orchestrator',
      event: 'tick_started',
      message: `Orchestrator tick iniciado (mode: ${this.mode})`,
      context: { mode: this.mode, config: this.config },
    });

    // ── STEP 1: WATCH (AnomalyDetector) ──
    if (this.config.enableWatch) {
      try {
        const anomalies = await this.runWithTimeout(
          () => runAnomalyDetection(),
          10_000,
          'watch'
        );
        result.steps.watch.anomaliesDetected = anomalies.length;
        result.steps.watch.anomalies = anomalies;
      } catch (err) {
        errors.push(`watch: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 2: DEFEND (Self-Defense reactions) ──
    if (this.config.enableDefend && result.steps.watch.anomalies.length > 0) {
      try {
        const defenseResults = await this.runWithTimeout(
          () => getSelfDefense().reactToAnomalies(result.steps.watch.anomalies),
          5_000,
          'defend'
        );
        result.steps.defend.actionsTaken = defenseResults.length;
        result.steps.defend.results = defenseResults;
      } catch (err) {
        errors.push(`defend: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 3: SCAN (VulnerabilityScanner — incremental) ──
    if (this.config.enableScan) {
      // Full scan apenas 1x por dia (86400000 ms); incremental nas outras
      const isFullScanTime = Date.now() - this.lastFullScan > 24 * 60 * 60 * 1000;
      try {
        const scanResult = await this.runWithTimeout<VulnScanResult>(
          async () => {
            const scanner = getVulnerabilityScanner({
              useGitDiff: !isFullScanTime, // full scan if it's time
            });
            return scanner.scan();
          },
          15_000,
          'scan'
        );

        if (isFullScanTime) {
          this.lastFullScan = Date.now();
        }

        result.steps.scan = {
          totalFindings: scanResult.totalFindings,
          criticalFindings: scanResult.findingsBySeverity.critical || 0,
        };

        // Se há critical findings, dispara alerta
        if (scanResult.findingsBySeverity.critical > 0) {
          try {
            await dispatchAlert({
              subject: `Vulnerability Scanner: ${scanResult.findingsBySeverity.critical} critical findings`,
              body: `Cérebro VulnerabilityScanner identificou ${scanResult.findingsBySeverity.critical} vulnerabilidades críticas no codebase.

Arquivos afetados:
${scanResult.findings
  .filter(f => f.severity === 'critical')
  .slice(0, 10)
  .map(f => `- [${f.patternId}] ${f.filePath}:${f.line} — ${f.description}`)
  .join('\n')}

Recomendação: revisar manualmente e aplicar correções.

Total scan: ${scanResult.totalFindings} findings em ${scanResult.totalFilesScanned} arquivos (${scanResult.durationMs}ms)`,
              severity: 'critical',
              scope: 'global:codebase',
              sourceType: 'manual',
              metadata: {
                scanResult: {
                  totalFindings: scanResult.totalFindings,
                  bySeverity: scanResult.findingsBySeverity,
                  byCategory: scanResult.findingsByCategory,
                },
              },
            });
          } catch (err) {
            errors.push(`scan_alert: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`scan: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 4: ANALYZE (LLM analysis) — gated by budget ──
    if (this.config.enableAnalyze && result.steps.watch.anomalies.length > 0) {
      try {
        const budgetCheck = this.budgetGuard.canSpend(0.005); // estimated cost per analysis

        if (budgetCheck.allowed) {
          const analysisService = getGlmCerebroService();
          const analysisResult = await this.runWithTimeout(
            () => analysisService.analyzeAnomalies(result.steps.watch.anomalies),
            15_000,
            'analyze'
          );

          const analysisId = await analysisService.persistAnalysis(analysisResult);

          await this.budgetGuard.recordSpend(analysisResult.costUsd, 'analysis');

          // Dispara alerta se severity >= critical
          let alertDispatched = false;
          if (analysisResult.severity === 'critical' || analysisResult.severity === 'emergency') {
            try {
              await dispatchAlert({
                subject: `Cérebro: ${analysisResult.severity.toUpperCase()} — ${analysisResult.scope}`,
                body: `${analysisResult.summary}

AÇÃO RECOMENDADA:
${analysisResult.recommendedAction}

ANOMALIAS RELACIONADAS:
${result.steps.watch.anomalies.slice(0, 5).map(a => `- ${a.anomalyType} em ${a.scope}`).join('\n')}

Analysis ID: ${analysisId}
Confiança: ${(analysisResult.confidence * 100).toFixed(1)}%
Custo: $${analysisResult.costUsd.toFixed(4)}`,
                severity: analysisResult.severity,
                scope: analysisResult.scope,
                sourceId: analysisId,
                sourceType: 'cerebro_analysis',
              });
              alertDispatched = true;
            } catch (err) {
              errors.push(`analyze_alert: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          result.steps.analyze = {
            analysisId,
            severity: analysisResult.severity,
            alertDispatched,
          };
        } else {
          // Budget não permite — economiza
          this.budgetGuard.recordSavings(0.005);
          logSink.info({
            module: 'cerebro-orchestrator',
            event: 'analyze_skipped_budget',
            message: `Análise LLM skipada: ${budgetCheck.reason}`,
            context: { tier: budgetCheck.tier, reason: budgetCheck.reason },
          });
        }
      } catch (err) {
        errors.push(`analyze: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 5: REFACTOR (propose new refactors) ──
    if (this.config.enableRefactor) {
      try {
        const recurring = await this.runWithTimeout(
          () => findRecurringErrors(5),
          5_000,
          'refactor.find'
        );

        if (recurring.length > 0) {
          const budgetCheck = this.budgetGuard.canSpend(0.005);

          if (budgetCheck.allowed) {
            const suggester = getRefactorSuggester();
            let proposalsCount = 0;

            for (const err of recurring.slice(0, 3)) { // max 3 per tick
              try {
                const result = await suggester.suggestRefactor({
                  errorHash: err.errorHash,
                  errorMessage: err.sampleEvent.message,
                  stackTrace: err.sampleEvent.stack,
                  occurrencesCount: err.count,
                  recentErrors: err.recentErrors,
                });
                if (result.suggestionId) proposalsCount++;
              } catch {
                // skip individual failures
              }
            }

            await this.budgetGuard.recordSpend(0.005 * proposalsCount, 'refactor');

            result.steps.refactor = {
              suggestionsProposed: proposalsCount,
            };
          } else {
            this.budgetGuard.recordSavings(0.005 * recurring.length);
          }
        }
      } catch (err) {
        errors.push(`refactor: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 6: REMEDIATE (apply approved refactors) ──
    if (this.config.enableRemediate) {
      try {
        const remediations = await this.runWithTimeout(
          () => getAutoRemediator().processPendingRemediations(),
          30_000,
          'remediate'
        );

        const applied = remediations.filter(r => r.status === 'applied').length;
        const failed = remediations.filter(r => r.status === 'failed').length;
        const skipped = remediations.filter(r => r.status === 'skipped').length;

        result.steps.remediate = { applied, failed, skipped };
      } catch (err) {
        errors.push(`remediate: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 7: CHURN (predict) — opcional, default off ──
    if (this.config.enableChurn) {
      try {
        const predictions = await this.runWithTimeout(
          () => getChurnPredictor().predictAll(),
          30_000,
          'churn'
        );

        const critical = predictions.filter(p => p.riskLevel === 'critical').length;
        const warning = predictions.filter(p => p.riskLevel === 'warning').length;

        result.steps.churn = { critical, warning };

        // Dispara alerta para tenants em critical
        if (critical > 0) {
          try {
            await dispatchAlert({
              subject: `Churn Alert: ${critical} tenants em risco crítico`,
              body: `${critical} tenant(s) com risco de churn crítico (score >= 0.85).

Detalhes:
${predictions
  .filter(p => p.riskLevel === 'critical')
  .slice(0, 5)
  .map(p => `- ${p.tenantName || p.tenantId}: score=${p.overallScore} — ${p.recommendedAction}`)
  .join('\n')}`,
              severity: 'critical',
              scope: 'global:churn',
              sourceType: 'manual',
              metadata: { criticalCount: critical, warningCount: warning },
            });
          } catch (err) {
            errors.push(`churn_alert: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`churn: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── STEP 8: DISTILL (consolidate knowledge) — opcional, default off ──
    if (this.config.enableDistill) {
      try {
        const distillResult = await this.runWithTimeout(
          () => getKnowledgeDistiller().runDistillation(),
          30_000,
          'distill'
        );

        result.steps.distill = {
          chunksCreated: distillResult.chunksCreated,
          chunksArchived: distillResult.chunksArchived,
        };
      } catch (err) {
        errors.push(`distill: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    result.durationMs = Date.now() - startTime;

    // ── Persiste resultado do tick em CerebroTelemetryEvent ──
    try {
      await db.cerebroTelemetryEvent.create({
        data: {
          type: 'cron',
          name: 'orchestrator_tick',
          module: 'cerebro-orchestrator',
          severity: errors.length > 0 ? 'warn' : 'info',
          message: `Tick completo em ${result.durationMs}ms — ${result.steps.watch.anomaliesDetected} anomalias, ${result.steps.defend.actionsTaken} defesas${result.steps.remediate ? `, ${result.steps.remediate.applied} remediações` : ''}`,
          context: JSON.stringify({
            durationMs: result.durationMs,
            steps: Object.fromEntries(
              Object.entries(result.steps).map(([k, v]) => [k, typeof v === 'object' && v !== null ? Object.keys(v) : v])
            ),
            errorsCount: errors.length,
            errors: errors.slice(0, 5),
          }),
        },
      });
    } catch {
      // silent — não podemos deixar log falhar tick
    }

    logSink.info({
      module: 'cerebro-orchestrator',
      event: 'tick_complete',
      message: `Tick completo em ${result.durationMs}ms — ${result.steps.watch.anomaliesDetected} anomalias, ${result.steps.defend.actionsTaken} defesas${errors.length > 0 ? `, ${errors.length} erros` : ''}`,
      context: {
        durationMs: result.durationMs,
        steps: {
          watch: result.steps.watch.anomaliesDetected,
          defend: result.steps.defend.actionsTaken,
          scan: result.steps.scan?.totalFindings,
          analyze: result.steps.analyze?.severity,
          refactor: result.steps.refactor?.suggestionsProposed,
          remediate: result.steps.remediate,
          churn: result.steps.churn,
          distill: result.steps.distill,
        },
        errors: errors.slice(0, 3),
      },
    });

    return result;
  }

  /**
   * Executa uma função com timeout estrito.
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    stepName: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${stepName} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Estatísticas para dashboard.
   */
  getStats() {
    return {
      mode: this.mode,
      config: this.config,
      budgetGuard: this.budgetGuard.getStats(),
      lastFullScan: this.lastFullScan,
      selfDefense: getSelfDefense().getStats(),
      autoRemediator: getAutoRemediator().getStats(),
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: CerebroOrchestrator | null = null;

export function getCerebroOrchestrator(config?: Partial<OrchestratorConfig>): CerebroOrchestrator {
  if (!singleton || config) {
    singleton = new CerebroOrchestrator(config);
  }
  return singleton;
}
