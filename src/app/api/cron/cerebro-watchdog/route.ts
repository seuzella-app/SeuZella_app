// ============================================================================
// ZÉLLA — Cron: Cérebro Watchdog (1 min)
// ============================================================================
// Endpoint chamado a cada 1 minuto via QStash Schedules.
//
// FUNÇÃO:
//  Executa o AnomalyDetector completo (4 estratégias) para detectar anomalias
//  em tempo real. Persiste cada anomalia em AnomalyEvent (mesmo em mock mode).
//  Em live mode, anomalias críticas disparam alertas via AlertBus (Passo 5).
//
// AUTH:
//  - Em produção: INTERNAL_ENDPOINT_TOKEN (header X-Internal-Token)
//  - Em dev: sem auth (para teste manual via curl/Postman)
//
// ESTRATÉGIAS EXECUTADAS:
//  1. Threshold Detection (regras hard — error rate, auth failures, cost)
//  2. Statistical Detection (3σ da média móvel de 60min)
//  3. Rate-of-Change Detection (spikes > 100% vs histórico)
//  4. Pattern Matcher (ataques distribuídos, cross-tenant errors)
//
// COOLDOWN:
//  Após detectar anomalia de tipo+escopo, ignora mesma combinação por 60 min
//  para evitar alert spam. Configurável via detector config.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { runAnomalyDetection, getAnomalyDetector } from '@/lib/cerebro/anomaly-detector';
// Notification bridge — Phase 2: pushes AI anomaly alerts into DDC for the tenant
import { bridgeCerebroAlert } from '@/lib/notifications/bridges';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export async function GET(request: NextRequest): Promise<NextResponse> {
  
    // Auth unificada: M2M EdDSA JWT primeiro, fallback CRON_SECRET
  const auth = await verifyCronAuth(request, 'cerebro:write');
  if (!auth.ok) return auth.response!;
return runWatchdog(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runWatchdog(request);
}

async function runWatchdog(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth (apenas em produção) ──
  if (process.env.NODE_ENV === 'production') {
    const expectedToken = process.env.INTERNAL_ENDPOINT_TOKEN;
    if (!expectedToken) {
      console.error('[cerebro-watchdog] CRÍTICO: INTERNAL_ENDPOINT_TOKEN não configurado em produção');
      return NextResponse.json(
        { ok: false, error: 'INTERNAL_ENDPOINT_TOKEN_NOT_SET' },
        { status: 503 }
      );
    }
    const receivedToken = request.headers.get('x-internal-token');
    if (receivedToken !== expectedToken) {
      console.warn('[cerebro-watchdog] Token inválido — rejeitando');
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  try {
    // ── 1. Executa AnomalyDetector completo ──
    // Roda todas as 4 estratégias em paralelo, persiste anomalias, aplica cooldown
    const anomalies = await runAnomalyDetection();

    // ── 2. Loga resultado ──
    const detectorStats = getAnomalyDetector().getStats();
    const processingTime = Date.now() - startTime;

    if (anomalies.length > 0) {
      logSink.warn({
        module: 'cerebro-watchdog',
        event: 'anomalies_detected',
        message: `${anomalies.length} anomalia(s) detectada(s) em ${processingTime}ms`,
        context: {
          anomalies: anomalies.map(a => ({
            type: a.anomalyType,
            scope: a.scope,
            severity: a.severity,
            observed: a.observed,
            baseline: a.baseline,
          })),
          processingTimeMs: processingTime,
          mode,
        },
      });

      // ── Notification bridge: push each anomaly into DDC tenant notifications ──
      // Extract tenantId from scope (format: "tenant:<id>") and call bridgeCerebroAlert.
      // Non-blocking: errors logged but never break the watchdog loop.
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
          console.error('[cerebro-watchdog] bridgeCerebroAlert error:', bridgeErr);
        }
      }
    }

    // ── 3. TODO Passo 5: dispara alertas para anomalias critical/emergency ──
    // if (mode === 'live') {
    //   for (const anomaly of anomalies.filter(a => a.severity === 'critical' || a.severity === 'emergency')) {
    //     await dispatchAlert({...});
    //   }
    // }

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      anomaliesDetected: anomalies.length,
      anomalies: anomalies.map(a => ({
        type: a.anomalyType,
        scope: a.scope,
        metric: a.metric,
        observed: a.observed,
        baseline: a.baseline,
        deviation: Math.round(a.deviation * 100) / 100,
        severity: a.severity,
        detectionMethod: a.detectionMethod,
      })),
      detectorStats: {
        cooldownEntries: detectorStats.cooldownEntries,
        logSinkBuffered: detectorStats.logSinkStats.totalEventsBuffered,
        logSinkUniqueErrors: detectorStats.logSinkStats.uniqueErrorHashes,
      },
      message: anomalies.length > 0
        ? `${anomalies.length} anomalia(s) detectada(s) e persistida(s) em AnomalyEvent`
        : 'Nenhuma anomalia detectada',
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-watchdog',
      event: 'watchdog_error',
      message: 'Erro na execução do watchdog',
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
