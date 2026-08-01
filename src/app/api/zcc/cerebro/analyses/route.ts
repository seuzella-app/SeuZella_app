// ============================================================================
// ZÉLLA — ZCC Endpoint: Cerebro Analyses
// ============================================================================
// Permite ao admin Zélla visualizar análises geradas pelo GlmCerebroService
// e stats do serviço (modo, budget gasto, etc).
//
// Endpoints:
//  GET /api/zcc/cerebro/analyses          — lista análises
//  GET /api/zcc/cerebro/analyses/stats    — stats do GlmCerebroService
//  POST /api/zcc/cerebro/analyses?action=run  — força análise manual
//  POST /api/zcc/cerebro/analyses?action=forecast — roda budget forecast
//
// Auth: verifyZCCAccessOrReject (admin Zélla apenas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getGlmCerebroService, queryAnalyses } from '@/lib/cerebro/glm-service';
import { runAnomalyDetection } from '@/lib/cerebro/anomaly-detector';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode, type AnalysisType, type Severity } from '@/lib/cerebro/types';

// ── GET: Lista análises ou stats ────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const isStats = searchParams.get('stats') === 'true';

    if (isStats) {
      // Stats do GlmCerebroService
      const service = getGlmCerebroService();
      const stats = service.getStats();

      return NextResponse.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    }

    // Lista análises com filtros
    const sinceParam = searchParams.get('since');
    const typeParam = searchParams.get('type') as AnalysisType | null;
    const severityParam = searchParams.get('severity') as Severity | null;
    const modeParam = searchParams.get('mode') as 'mock' | 'live' | null;
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);

    const since = sinceParam ? new Date(sinceParam) : undefined;
    const limit = Math.min(Math.max(limitParam || 50, 1), 200);

    const analyses = await queryAnalyses({
      since,
      analysisType: typeParam || undefined,
      severity: severityParam || undefined,
      mode: modeParam || undefined,
      limit,
    });

    // Stats resumidas
    const stats = {
      total: analyses.length,
      bySeverity: groupBy(analyses, (a: { severity: string }) => a.severity),
      byType: groupBy(analyses, (a: { analysisType: string }) => a.analysisType),
      byMode: groupBy(analyses, (a: { mode: string }) => a.mode),
      totalCostUsd: analyses.reduce((sum: number, a: { costUsd: number }) => sum + a.costUsd, 0),
    };

    return NextResponse.json({
      success: true,
      data: analyses,
      stats,
      mode: getCerebroMode(),
    });
  } catch (error) {
    console.error('[zcc/cerebro/analyses GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── POST: Ações (run analysis ou forecast) ─────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';

    switch (action) {
      case 'run': {
        // Força rodada manual: detecta anomalias + analisa com GLM
        logSink.info({
          module: 'zcc-cerebro',
          event: 'manual_analysis_run',
          message: 'Análise manual iniciada pelo admin ZCC',
          context: { triggeredBy: security.ip },
        });

        const anomalies = await runAnomalyDetection();
        const service = getGlmCerebroService();
        const analysisResult = await service.analyzeAnomalies(anomalies);
        const analysisId = await service.persistAnalysis(analysisResult);

        return NextResponse.json({
          success: true,
          message: `Análise manual executada — ${anomalies.length} anomalia(s) encontrada(s)`,
          analysisId,
          analysis: {
            type: analysisResult.analysisType,
            scope: analysisResult.scope,
            summary: analysisResult.summary,
            severity: analysisResult.severity,
            recommendedAction: analysisResult.recommendedAction,
            confidence: analysisResult.confidence,
            costUsd: analysisResult.costUsd,
            mode: analysisResult.mode,
          },
          anomaliesDetected: anomalies.length,
        });
      }

      case 'forecast': {
        // Roda budget forecast para top 10 tenants em risco
        const body = await request.json().catch(() => ({}));
        const tenantId = (body as { tenantId?: string }).tenantId;

        const service = getGlmCerebroService();

        if (tenantId) {
          // Forecast para tenant específico
          const forecast = await service.forecastBudget(tenantId);
          return NextResponse.json({
            success: true,
            data: forecast,
          });
        }

        // Forecast para todos os tenants em risco
        const forecasts = await service.forecastBudgetForAllTenants();
        return NextResponse.json({
          success: true,
          data: forecasts,
          count: forecasts.length,
          message: `${forecasts.length} tenant(s) em risco de estourar cota Meta`,
        });
      }

      case 'inadimplencia': {
        // Detecta inadimplência
        const service = getGlmCerebroService();
        const overdue = await service.detectInadimplencia();
        return NextResponse.json({
          success: true,
          data: overdue,
          count: overdue.length,
          message: `${overdue.length} tenant(s) inadimplente(s) detectado(s)`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inválido: "${action}". Use ?action=run, ?action=forecast ou ?action=inadimplencia` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[zcc/cerebro/analyses POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── Helper: agrupa por campo ─────────────────────────────────────────────────

function groupBy<T>(arr: T[], fn: (item: T) => string | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item) || 'unknown';
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}
