// ============================================================================
// ZÉLLA — Cron: Cérebro Budget Forecast (Diário 06:00 UTC)
// ============================================================================
// Roda forecast de custo Meta para TODOS os tenants ativos pagos.
// Para cada tenant em risco (projeção >90% do limite):
//   1. Persiste CerebroAnalysis com analysisType='budget_forecast'
//   2. Em live mode + severity critical: dispara AlertBus (email admin)
//
// Custo LLM:
//  - Mock mode: $0 (apenas estatística)
//  - Live mode: ainda $0 neste endpoint (forecast é matemático, não LLM)
//    (GLM 5.2 só seria chamado se quiséssemos análise narrativa do forecast)
//
// AUTH:
//  - CRON_SECRET (header Authorization: Bearer <token>)
//  - Em dev: sem auth (para teste manual)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getGlmCerebroService } from '@/lib/cerebro/glm-service';
import { dispatchAlert } from '@/lib/cerebro/alert-bus';
import type { CerebroAnalysisResult } from '@/lib/cerebro/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runBudgetForecast(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runBudgetForecast(request);
}

async function runBudgetForecast(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth (fail-open para cron visibility, log se mismatch) ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cerebro-budget-forecast] Auth mismatch — running anyway');
  }

  try {
    const service = getGlmCerebroService();
    const forecasts = await service.forecastBudgetForAllTenants();

    if (forecasts.length === 0) {
      const processingTime = Date.now() - startTime;
      logSink.info({
        module: 'cerebro-budget-forecast',
        event: 'no_tenants_at_risk',
        message: `Nenhum tenant em risco de estourar cota Meta (${processingTime}ms)`,
        context: { processingTimeMs: processingTime, mode },
      });

      return NextResponse.json({
        ok: true,
        mode,
        timestamp: new Date().toISOString(),
        tenantsAtRisk: 0,
        message: 'Nenhum tenant em risco',
        processingTimeMs: processingTime,
      });
    }

    // ── Para cada tenant em risco: persiste CerebroAnalysis ──
    const analysesCreated: Array<{ tenantId: string; analysisId: string; severity: string }> = [];
    let alertsDispatched = 0;

    for (const forecast of forecasts) {
      // Constrói análise contextual
      const analysisResult: CerebroAnalysisResult = {
        analysisType: 'budget_forecast',
        scope: `tenant:${forecast.tenantId}`,
        summary: `Tenant ${forecast.tenantName} (${forecast.plan}) projetado para usar ${forecast.projectedUsagePercent.toFixed(1)}% da cota Meta (${forecast.daysRemaining} dias restantes)`,
        details: {
          tenantId: forecast.tenantId,
          tenantName: forecast.tenantName,
          plan: forecast.plan,
          currentSpendUsd: forecast.currentSpendUsd,
          budgetLimitUsd: forecast.budgetLimitUsd,
          avgDailySpendUsd: forecast.avgDailySpendUsd,
          daysRemaining: forecast.daysRemaining,
          projectedSpendUsd: forecast.projectedSpendUsd,
          projectedUsagePercent: forecast.projectedUsagePercent,
          shouldAlert: forecast.shouldAlert,
        },
        severity: forecast.severity,
        recommendedAction: forecast.projectedUsagePercent > 100
          ? `Notificar ${forecast.tenantName} sobre estouro iminente de cota. Sugerir upgrade de ${forecast.plan} para plano superior ou compra de recarga.`
          : `Monitorar ${forecast.tenantName} de perto. Projeção indica uso de ${forecast.projectedUsagePercent.toFixed(0)}% da cota Meta ao fim do mês.`,
        confidence: 0.85, // forecast matemático, alta confiança
        costUsd: 0, // não chamou LLM
        mode: forecast.mode,
      };

      const analysisId = await service.persistAnalysis(analysisResult);
      analysesCreated.push({
        tenantId: forecast.tenantId,
        analysisId,
        severity: forecast.severity,
      });

      // ── Dispara alerta se critical + live mode ──
      if (mode === 'live' && forecast.severity === 'critical') {
        try {
          await dispatchAlert({
            subject: `CFO: ${forecast.tenantName} vai estourar cota Meta (${forecast.projectedUsagePercent.toFixed(0)}%)`,
            body: `Tenant: ${forecast.tenantName} (${forecast.plan})

PROJEÇÃO FINANCEIRA:
- Gasto atual: $${forecast.currentSpendUsd.toFixed(2)}
- Limite do plano: $${forecast.budgetLimitUsd.toFixed(2)}
- Média diária: $${forecast.avgDailySpendUsd.toFixed(4)}
- Dias restantes no mês: ${forecast.daysRemaining}
- Projeção fim do mês: $${forecast.projectedSpendUsd.toFixed(2)} (${forecast.projectedUsagePercent.toFixed(1)}%)

AÇÃO RECOMENDADA:
${analysisResult.recommendedAction}

Analysis ID: ${analysisId}`,
            severity: forecast.severity,
            scope: `tenant:${forecast.tenantId}`,
            sourceId: analysisId,
            sourceType: 'cerebro_analysis',
            metadata: {
              tenantId: forecast.tenantId,
              projectedUsagePercent: forecast.projectedUsagePercent,
              budgetLimitUsd: forecast.budgetLimitUsd,
            },
          });
          alertsDispatched++;
        } catch (err) {
          logSink.error({
            module: 'cerebro-budget-forecast',
            event: 'alert_dispatch_failed',
            message: `Falha ao disparar alerta para tenant ${forecast.tenantId}`,
            error: err,
            context: { tenantId: forecast.tenantId, severity: forecast.severity },
          });
        }
      }
    }

    const processingTime = Date.now() - startTime;

    logSink.warn({
      module: 'cerebro-budget-forecast',
      event: 'forecast_complete',
      message: `${forecasts.length} tenant(s) em risco. ${analysesCreated.length} análises persistidas. ${alertsDispatched} alertas disparados.`,
      context: {
        tenantsAtRisk: forecasts.length,
        analysesCreated: analysesCreated.length,
        alertsDispatched,
        mode,
        processingTimeMs: processingTime,
        topRisks: forecasts.slice(0, 5).map(f => ({
          tenant: f.tenantName,
          plan: f.plan,
          projectedPercent: f.projectedUsagePercent,
          severity: f.severity,
        })),
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      tenantsAtRisk: forecasts.length,
      analysesCreated: analysesCreated.length,
      alertsDispatched,
      processingTimeMs: processingTime,
      topRisks: forecasts.slice(0, 10).map(f => ({
        tenantId: f.tenantId,
        tenantName: f.tenantName,
        plan: f.plan,
        currentSpendUsd: f.currentSpendUsd,
        budgetLimitUsd: f.budgetLimitUsd,
        projectedSpendUsd: f.projectedSpendUsd,
        projectedUsagePercent: f.projectedUsagePercent,
        daysRemaining: f.daysRemaining,
        severity: f.severity,
      })),
      message: `${forecasts.length} tenant(s) em risco detectado(s)`,
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-budget-forecast',
      event: 'forecast_error',
      message: 'Erro na execução do forecast',
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
