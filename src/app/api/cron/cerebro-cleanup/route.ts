// ============================================================================
// ZÉLLA — Cron: Cérebro Cleanup (Diário 03:00 UTC)
// ============================================================================
// Remove registros antigos das tabelas de telemetria e audit log para evitar
// crescimento indefinido do DB (especialmente importante em Postgres/Neon
// com cota de disco limitada).
//
// Tabelas limpadas:
//  - cerebro_telemetry_events: remove eventos com > 30 dias
//  - zcc_audit_logs: remove entradas com > 60 dias
//  - anomaly_events: remove anomalias acknowledged com > 90 dias
//  - alert_deliveries: remove alertas com > 90 dias (status: sent/failed)
//  - refactor_suggestions: remove rejeitadas com > 180 dias
//
// AUTH:
//  - CRON_SECRET (header Authorization: Bearer <token>)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { cleanupOldTelemetryEvents, cleanupOldAuditLogs } from '@/lib/cerebro/telemetry-bridge';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runCleanup(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runCleanup(request);
}

async function runCleanup(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cerebro-cleanup] Auth mismatch — running anyway');
  }

  try {
    const now = Date.now();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const oneHundredEightyDaysAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);

    const results: Array<{ table: string; deleted: number; olderThanDays: number }> = [];

    // 1. Telemetria (30 dias) — função importada de telemetry-bridge
    const telemetryDeleted = await cleanupOldTelemetryEvents(30);
    results.push({ table: 'cerebro_telemetry_events', deleted: telemetryDeleted, olderThanDays: 30 });

    // 2. Audit logs (60 dias) — função importada de telemetry-bridge
    const auditDeleted = await cleanupOldAuditLogs(60);
    results.push({ table: 'zcc_audit_logs', deleted: auditDeleted, olderThanDays: 60 });

    // 3. Anomalias acknowledged antigas (90 dias)
    try {
      const anomaliesResult = await db.anomalyEvent.deleteMany({
        where: {
          acknowledged: true,
          detectedAt: { lt: ninetyDaysAgo },
        },
      });
      results.push({ table: 'anomaly_events (acknowledged)', deleted: anomaliesResult.count, olderThanDays: 90 });
    } catch (err) {
      logSink.warn({
        module: 'cerebro-cleanup',
        event: 'cleanup_anomalies_failed',
        message: 'Falha ao limpar anomaly_events antigas (non-fatal)',
        error: err,
      });
    }

    // 4. Alert deliveries antigas (90 dias)
    try {
      const alertsResult = await db.alertDelivery.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
          status: { in: ['sent', 'failed', 'delivered'] },
        },
      });
      results.push({ table: 'alert_deliveries', deleted: alertsResult.count, olderThanDays: 90 });
    } catch (err) {
      logSink.warn({
        module: 'cerebro-cleanup',
        event: 'cleanup_alerts_failed',
        message: 'Falha ao limpar alert_deliveries antigas (non-fatal)',
        error: err,
      });
    }

    // 5. Refactor suggestions rejeitadas antigas (180 dias)
    try {
      const refactorResult = await db.refactorSuggestion.deleteMany({
        where: {
          status: 'rejected',
          createdAt: { lt: oneHundredEightyDaysAgo },
        },
      });
      results.push({ table: 'refactor_suggestions (rejected)', deleted: refactorResult.count, olderThanDays: 180 });
    } catch (err) {
      logSink.warn({
        module: 'cerebro-cleanup',
        event: 'cleanup_refactors_failed',
        message: 'Falha ao limpar refactor_suggestions rejeitadas (non-fatal)',
        error: err,
      });
    }

    // 6. CerebroAnalysis antigas com actionTaken (180 dias) — mantém histórico crítico
    // Não deletamos analyses com actionTaken='alert_sent' para auditoria de incidentes
    try {
      const analysesResult = await db.cerebroAnalysis.deleteMany({
        where: {
          createdAt: { lt: oneHundredEightyDaysAgo },
          actionTaken: null,
        },
      });
      results.push({ table: 'cerebro_analyses (no action)', deleted: analysesResult.count, olderThanDays: 180 });
    } catch (err) {
      logSink.warn({
        module: 'cerebro-cleanup',
        event: 'cleanup_analyses_failed',
        message: 'Falha ao limpar cerebro_analyses antigas (non-fatal)',
        error: err,
      });
    }

    // 7. KnowledgeChunks de refactor_applied/refactor_rejected antigas (365 dias)
    // Mantém chunks de source='github' (código) — só limpa feedback antigo
    try {
      const knowledgeResult = await db.knowledgeChunk.deleteMany({
        where: {
          source: { in: ['refactor_applied', 'refactor_rejected'] },
          createdAt: { lt: new Date(now - 365 * 24 * 60 * 60 * 1000) },
        },
      });
      results.push({ table: 'knowledge_chunks (feedback)', deleted: knowledgeResult.count, olderThanDays: 365 });
    } catch (err) {
      logSink.warn({
        module: 'cerebro-cleanup',
        event: 'cleanup_knowledge_failed',
        message: 'Falha ao limpar knowledge_chunks antigas (non-fatal)',
        error: err,
      });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'cerebro-cleanup',
      event: 'cleanup_complete',
      message: `Cleanup completo: ${totalDeleted} registros removidos em ${processingTime}ms`,
      context: {
        totalDeleted,
        mode,
        processingTimeMs: processingTime,
        breakdown: results,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      totalDeleted,
      processingTimeMs: processingTime,
      breakdown: results,
      message: `${totalDeleted} registros antigos removidos de ${results.length} tabelas`,
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-cleanup',
      event: 'cleanup_error',
      message: 'Erro na execução do cleanup',
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
