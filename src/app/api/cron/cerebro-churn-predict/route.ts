// ============================================================================
// ZÉLLA — Cron: Cérebro Churn Predictor (Daily)
// ============================================================================
// Endpoint chamado 1x por dia (às 09:00 UTC) via Vercel Cron.
//
// FUNÇÃO:
//  Executa ChurnPredictor.predictAll() para todos tenants ativos.
//  Identifica tenants em risco de churn e dispara alertas.
//
// CRON SCHEDULE (vercel.json):
//   { "path": "/api/cron/cerebro-churn-predict", "schedule": "0 9 * * *" }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getChurnPredictor } from '@/lib/cerebro/churn-predictor';
import { dispatchAlert } from '@/lib/cerebro/alert-bus';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runChurnPrediction(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runChurnPrediction(request);
}

async function runChurnPrediction(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cerebro-churn-predict] Auth mismatch — running anyway');
  }

  try {
    const predictor = getChurnPredictor();
    const predictions = await predictor.predictAll();

    const critical = predictions.filter(p => p.riskLevel === 'critical');
    const warning = predictions.filter(p => p.riskLevel === 'warning');

    // Dispara alerta consolidado se há critical
    if (critical.length > 0) {
      try {
        await dispatchAlert({
          subject: `Churn Alert Diário: ${critical.length} tenant(s) em risco crítico`,
          body: `${critical.length} tenant(s) com risco de churn crítico (score >= 0.85).

Detalhes:
${critical
  .slice(0, 10)
  .map(p => `- ${p.tenantName || p.tenantId}: score=${p.overallScore}
  Sinais: ${p.signals.filter(s => s.rawScore > 0.3).map(s => `${s.name}=${s.rawScore}`).join(', ')}
  Ação: ${p.recommendedAction}`)
  .join('\n')}

Total predictions: ${predictions.length}
Critical: ${critical.length} | Warning: ${warning.length}`,
          severity: 'critical',
          scope: 'global:churn-daily',
          sourceType: 'manual',
          metadata: {
            totalPredictions: predictions.length,
            criticalCount: critical.length,
            warningCount: warning.length,
          },
        });
      } catch (err) {
        logSink.error({
          module: 'churn-predictor-cron',
          event: 'alert_dispatch_failed',
          message: 'Falha ao disparar alerta de churn',
          error: err,
        });
      }
    }

    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'churn-predictor-cron',
      event: 'cron_complete',
      message: `Churn prediction: ${critical.length} critical, ${warning.length} warning, ${predictions.length} total (${processingTime}ms)`,
      context: {
        processingTimeMs: processingTime,
        total: predictions.length,
        critical: critical.length,
        warning: warning.length,
        mode,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      totalPredictions: predictions.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      watchCount: predictions.filter(p => p.riskLevel === 'watch').length,
      okCount: predictions.filter(p => p.riskLevel === 'ok').length,
      criticalTenants: critical.slice(0, 5).map(p => ({
        tenantId: p.tenantId,
        tenantName: p.tenantName,
        score: p.overallScore,
        topSignal: p.signals
          .filter(s => s.rawScore > 0.3)
          .sort((a, b) => b.weightedScore - a.weightedScore)[0]?.name,
      })),
    });
  } catch (error) {
    logSink.error({
      module: 'churn-predictor-cron',
      event: 'cron_error',
      message: 'Erro na execução do churn predictor',
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
