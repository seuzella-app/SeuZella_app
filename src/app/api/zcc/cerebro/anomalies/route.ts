// ============================================================================
// ZÉLLA — ZCC Endpoint: Anomaly Events
// ============================================================================
// Permite ao admin Zélla visualizar, filtrar e acknowledge anomalias
// detectadas pelo AnomalyDetector.
//
// Endpoints:
//  GET  /api/zcc/cerebro/anomalies — lista anomalias (com filtros opcionais)
//  POST /api/zcc/cerebro/anomalies?action=acknowledge — acknowledge de anomalia
//  POST /api/zcc/cerebro/anomalies?action=run-detection — força rodada de detecção
//
// Query params (GET):
//  ?since=2026-01-01        — filtra por data
//  ?acknowledged=false      — filtra por status
//  ?type=error_spike        — filtra por tipo
//  ?scope=module:webhook    — filtra por escopo (substring match)
//  ?limit=50                — limite de resultados (default 50, max 200)
//
// Auth: verifyZCCAccessOrReject (admin Zélla apenas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import {
  queryAnomalies,
  acknowledgeAnomaly,
  runAnomalyDetection,
  getAnomalyDetector,
} from '@/lib/cerebro/anomaly-detector';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode, type AnomalyType } from '@/lib/cerebro/types';

// ── GET: Lista anomalias ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const sinceParam = searchParams.get('since');
    const acknowledgedParam = searchParams.get('acknowledged');
    const typeParam = searchParams.get('type') as AnomalyType | null;
    const scopeParam = searchParams.get('scope');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);

    const since = sinceParam ? new Date(sinceParam) : undefined;
    const acknowledged = acknowledgedParam === 'true' ? true : acknowledgedParam === 'false' ? false : undefined;
    const limit = Math.min(Math.max(limitParam || 50, 1), 200); // clamp 1-200

    const anomalies = await queryAnomalies({
      since,
      acknowledged,
      anomalyType: typeParam || undefined,
      scope: scopeParam || undefined,
      limit,
    });

    // Estatísticas resumidas
    const stats = {
      total: anomalies.length,
      bySeverity: groupBy(anomalies, (a: { anomalyType: string; severity?: string }) => a.anomalyType),
      byType: groupBy(anomalies, (a: { anomalyType: string }) => a.anomalyType),
      acknowledged: anomalies.filter((a: { acknowledged: boolean }) => a.acknowledged).length,
      unacknowledged: anomalies.filter((a: { acknowledged: boolean }) => !a.acknowledged).length,
    };

    return NextResponse.json({
      success: true,
      data: anomalies,
      stats,
      detectorStats: getAnomalyDetector().getStats(),
      mode: getCerebroMode(),
    });
  } catch (error) {
    console.error('[zcc/cerebro/anomalies GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── POST: Ações (acknowledge ou run-detection) ─────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';

    switch (action) {
      case 'acknowledge': {
        const body = await request.json().catch(() => ({}));
        const { anomalyId, notes } = body as { anomalyId?: string; notes?: string };

        if (!anomalyId) {
          return NextResponse.json(
            { error: 'anomalyId é obrigatório no body' },
            { status: 400 }
          );
        }

        // Em modo mock, não temos sessão real — usamos IP como identifier
        const acknowledgedBy = `admin@${security.ip}`;
        await acknowledgeAnomaly(anomalyId, acknowledgedBy, notes);

        return NextResponse.json({
          success: true,
          message: `Anomalia ${anomalyId} acknowledged por ${acknowledgedBy}`,
        });
      }

      case 'run-detection': {
        // Força uma rodada manual do detector (para debug/teste)
        logSink.info({
          module: 'zcc-cerebro',
          event: 'manual_detection_run',
          message: 'Detecção manual iniciada pelo admin ZCC',
          context: { triggeredBy: security.ip },
        });

        const anomalies = await runAnomalyDetection();

        return NextResponse.json({
          success: true,
          message: `Detecção executada manualmente — ${anomalies.length} anomalia(s) encontrada(s)`,
          anomaliesDetected: anomalies.length,
          anomalies: anomalies.map(a => ({
            type: a.anomalyType,
            scope: a.scope,
            metric: a.metric,
            observed: a.observed,
            baseline: a.baseline,
            severity: a.severity,
            detectionMethod: a.detectionMethod,
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inválido: "${action}". Use ?action=acknowledge ou ?action=run-detection` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[zcc/cerebro/anomalies POST] Error:', error);
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
