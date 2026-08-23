// ============================================================================
// ZÉLLA — Cron: Cérebro Orchestrator (5 min)
// ============================================================================
// Endpoint chamado a cada 5 minutos via Vercel Cron / QStash.
//
// FUNÇÃO:
//  Executa um tick completo do CérebroOrchestrator:
//   1. AnomalyDetector (4 estratégias)
//   2. Self-Defense (ações defensivas automáticas)
//   3. VulnerabilityScanner (incremental via git diff)
//   4. GlmCerebroService análise (gated por Cérebro Budget)
//   5. RefactorSuggester (propõe refatorações para erros recorrentes)
//   6. AutoRemediator (aplica refatorações aprovadas/auto)
//
// AUTH:
//  - Em produção: CRON_SECRET (header Authorization: Bearer <token>)
//  - Em dev: sem auth (para teste manual)
//
// CRON SCHEDULE (vercel.json):
//   { "path": "/api/cron/cerebro-orchestrator", "schedule": "*/5 * * * *" }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getCerebroOrchestrator } from '@/lib/cerebro/cerebro-orchestrator';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runOrchestrator(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runOrchestrator(request);
}

async function runOrchestrator(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth (CRON_SECRET) ──
    // Auth unificada: M2M EdDSA JWT primeiro, fallback CRON_SECRET
  const auth = await verifyCronAuth(request, 'cerebro:write');
  if (!auth.ok) return auth.response!;

  try {
    // ── Permite override de config via query params (para testes) ──
    const url = new URL(request.url);
    const enableChurn = url.searchParams.get('churn') === 'true';
    const enableDistill = url.searchParams.get('distill') === 'true';

    const orchestrator = getCerebroOrchestrator({
      enableChurn,
      enableDistill,
    });

    const result = await orchestrator.runTick();

    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'cerebro-orchestrator-cron',
      event: 'cron_complete',
      message: `Orchestrator cron completo em ${processingTime}ms`,
      context: {
        processingTimeMs: processingTime,
        mode,
        tickDurationMs: result.durationMs,
        anomaliesDetected: result.steps.watch.anomaliesDetected,
        defenseActions: result.steps.defend.actionsTaken,
        errorsCount: result.errors.length,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      tickDurationMs: result.durationMs,
      result: {
        anomaliesDetected: result.steps.watch.anomaliesDetected,
        defenseActions: result.steps.defend.actionsTaken,
        scanFindings: result.steps.scan?.totalFindings ?? 0,
        scanCriticalFindings: result.steps.scan?.criticalFindings ?? 0,
        analysisSeverity: result.steps.analyze?.severity ?? null,
        analysisAlertDispatched: result.steps.analyze?.alertDispatched ?? false,
        refactorProposals: result.steps.refactor?.suggestionsProposed ?? 0,
        remediationsApplied: result.steps.remediate?.applied ?? 0,
        remediationsFailed: result.steps.remediate?.failed ?? 0,
        remediationsSkipped: result.steps.remediate?.skipped ?? 0,
        churnCritical: result.steps.churn?.critical ?? null,
        churnWarning: result.steps.churn?.warning ?? null,
        chunksCreated: result.steps.distill?.chunksCreated ?? null,
        chunksArchived: result.steps.distill?.chunksArchived ?? null,
      },
      errors: result.errors,
      budgetTier: result.steps.budget.tier,
      monthlySpendUsd: result.steps.budget.monthlySpendUsd,
      monthlyBudgetUsd: result.steps.budget.monthlyBudgetUsd,
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-orchestrator-cron',
      event: 'cron_error',
      message: 'Erro na execução do orchestrator',
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
