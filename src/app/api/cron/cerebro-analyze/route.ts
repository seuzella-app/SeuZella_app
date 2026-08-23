// ============================================================================
// ZÉLLA — Cron: Cérebro Analyze (15 min)
// ============================================================================
// Endpoint chamado a cada 15 min via Vercel Cron.
//
// FUNÇÃO:
//  1. Puxa anomalias não-acknowledged dos últimos 15 min (do AnomalyDetector)
//  2. Se há anomalias, chama GlmCerebroService.analyzeAnomalies()
//  3. Persiste análise em CerebroAnalysis
//  4. Se severity >= critical, dispara AlertBus (em live mode)
//  5. Em mock mode: gera análises sintéticas mas NÃO envia alertas
//
// AUTH:
//  - Em produção: CRON_SECRET (header Authorization: Bearer <token>)
//  - Em dev: sem auth (para teste manual)
//
// CUSTO LLM:
//  - Em mock: $0 (não chama GLM)
//  - Em live: ~$0.002 por análise × 4/hora × 24h × 30d = ~$5.76/mês
//  - Hard cap: CEREBRO_MONTHLY_BUDGET_USD (default $20) — fallback para mock se estourar
//
// INTEGRAÇÃO COM VERCEL CRON:
//  Adicionar em vercel.json:
//  { "path": "/api/cron/cerebro-analyze", "schedule": "*/15 * * * *" }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { runAnomalyDetection } from '@/lib/cerebro/anomaly-detector';
// Notification bridge — Phase 2: pushes analysis anomalies into DDC for the tenant
import { bridgeCerebroAlert } from '@/lib/notifications/bridges';
import { getGlmCerebroService } from '@/lib/cerebro/glm-service';
import { dispatchAlert } from '@/lib/cerebro/alert-bus';
import { verifyCronM2MToken, auditCronExecution } from '@/lib/security/cron-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runAnalysis(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runAnalysis(request);
}

async function runAnalysis(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth M2M EdDSA (V11-P0) — fail-closed ──
  const auth = await verifyCronM2MToken(request, 'cerebro:read');
  if (!auth.ok) {
    return auth.response;
  }
  const principal = auth.principal;

  try {
    // ── 1. Roda AnomalyDetector para coletar anomalias atuais ──
    const anomalies = await runAnomalyDetection();

    if (anomalies.length === 0) {
      const processingTime = Date.now() - startTime;
      logSink.info({
        module: 'cerebro-analyze',
        event: 'no_anomalies_to_analyze',
        message: `Nenhuma anomalia detectada — análise não necessária (${processingTime}ms)`,
        context: { processingTimeMs: processingTime, mode },
      });

      return NextResponse.json({
        ok: true,
        mode,
        timestamp: new Date().toISOString(),
        anomaliesDetected: 0,
        analysisPerformed: false,
        processingTimeMs: processingTime,
        message: 'Nenhuma anomalia para analisar',
      });
    }

    // ── 2. Chama GlmCerebroService para análise contextual ──
    const service = getGlmCerebroService();
    const analysisResult = await service.analyzeAnomalies(anomalies);

    // ── Notification bridge: push each anomaly into DDC tenant notifications ──
    for (const anomaly of anomalies) {
      try {
        const tenantIdMatch = /^tenant:([a-zA-Z0-9_-]+)$/.exec(anomaly.scope ?? '');
        const tenantId = tenantIdMatch?.[1];
        const alertTypeMap: Record<string, 'ai_offline' | 'ai_online' | 'pattern_learned' | 'anomaly_response_time' | 'anomaly_conversion' | 'anomaly_revenue' | 'cost_alert' | 'escalation_spike'> = {
          ai_offline: 'ai_offline',
          ai_online: 'ai_online',
          pattern_learned: 'pattern_learned',
          response_time: 'anomaly_response_time',
          conversion: 'anomaly_conversion',
          revenue: 'anomaly_revenue',
          cost: 'cost_alert',
          escalation_spike: 'escalation_spike',
        };
        const alertType = alertTypeMap[anomaly.anomalyType];
        if (!alertType) continue;
        bridgeCerebroAlert({
          alertType,
          value: anomaly.observed,
          expected: anomaly.baseline,
          tenantId,
        });
      } catch (bridgeErr) {
        console.error('[cerebro-analyze] bridgeCerebroAlert error:', bridgeErr);
      }
    }

    // ── 3. Persiste análise no DB ──
    const analysisId = await service.persistAnalysis(analysisResult);

    // ── 4. Dispara alerta se severity >= critical (apenas em live mode) ──
    let alertDispatched = false;
    if (mode === 'live' && (analysisResult.severity === 'critical' || analysisResult.severity === 'emergency')) {
      try {
        await dispatchAlert({
          subject: `Cérebro: ${analysisResult.severity.toUpperCase()} — ${analysisResult.scope}`,
          body: `${analysisResult.summary}

AÇÃO RECOMENDADA:
${analysisResult.recommendedAction}

DETALHES:
- Tipo: ${analysisResult.analysisType}
- Scope: ${analysisResult.scope}
- Confiança: ${(analysisResult.confidence * 100).toFixed(1)}%
- Modo: ${analysisResult.mode}
- Custo LLM: $${analysisResult.costUsd.toFixed(4)}

ANOMALIAS RELACIONADAS:
${anomalies.slice(0, 5).map(a => `- ${a.anomalyType} em ${a.scope} (observed: ${a.observed}, baseline: ${a.baseline})`).join('\n')}

Analysis ID: ${analysisId}`,
          severity: analysisResult.severity,
          scope: analysisResult.scope,
          sourceId: analysisId,
          sourceType: 'cerebro_analysis',
          metadata: {
            analysisType: analysisResult.analysisType,
            confidence: analysisResult.confidence,
            anomalyCount: anomalies.length,
            costUsd: analysisResult.costUsd,
          },
        });
        alertDispatched = true;
      } catch (error) {
        logSink.error({
          module: 'cerebro-analyze',
          event: 'alert_dispatch_failed',
          message: 'Falha ao disparar alerta para análise crítica',
          error,
          context: { analysisId, severity: analysisResult.severity },
        });
      }
    }

    const processingTime = Date.now() - startTime;

    // ── Auditoria M2M (V11-P0) ──
    await auditCronExecution({
      prisma: db,
      tenantId: 'system',
      principal,
      entryPoint: 'glm_cerebro',
      policyId: 'cron:cerebro-analyze',
      severity: 'info',
      action: 'allow',
      latencyMs: processingTime,
    }).catch(err => console.error('[cerebro-analyze] audit log failed:', err));

    logSink.info({
      module: 'cerebro-analyze',
      event: 'analysis_complete',
      message: `Análise ${analysisId} criada — severity: ${analysisResult.severity}, mode: ${analysisResult.mode}, alert: ${alertDispatched}`,
      context: {
        analysisId,
        analysisType: analysisResult.analysisType,
        scope: analysisResult.scope,
        severity: analysisResult.severity,
        confidence: analysisResult.confidence,
        costUsd: analysisResult.costUsd,
        mode: analysisResult.mode,
        alertDispatched,
        anomalyCount: anomalies.length,
        processingTimeMs: processingTime,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      anomaliesDetected: anomalies.length,
      analysisPerformed: true,
      analysis: {
        id: analysisId,
        type: analysisResult.analysisType,
        scope: analysisResult.scope,
        summary: analysisResult.summary,
        severity: analysisResult.severity,
        recommendedAction: analysisResult.recommendedAction,
        confidence: analysisResult.confidence,
        costUsd: analysisResult.costUsd,
        mode: analysisResult.mode,
      },
      alertDispatched,
      processingTimeMs: processingTime,
      spend: service.getStats().spend,
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-analyze',
      event: 'analysis_error',
      message: 'Erro na execução da análise',
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
