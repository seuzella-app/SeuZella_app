// ============================================================================
// ZÉLLA — Cron: Cérebro Cleanup
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { cleanupOldTelemetryEvents, cleanupOldAuditLogs } from '@/lib/cerebro/telemetry-bridge';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runCleanup(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runCleanup(request);
}

async function runCleanup(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();
  const auth = await verifyCronAuth(request, 'cerebro:write');
  if (!auth.ok) return auth.response!;

  try {
    const now = Date.now();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const oneHundredEightyDaysAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const results: Array<{ table: string; deleted: number; olderThanDays: number }> = [];

    const telemetryDeleted = await cleanupOldTelemetryEvents(30);
    results.push({ table: 'cerebro_telemetry_events', deleted: telemetryDeleted, olderThanDays: 30 });

    const auditDeleted = await cleanupOldAuditLogs(60);
    results.push({ table: 'zcc_audit_logs', deleted: auditDeleted, olderThanDays: 60 });

    try {
      const result = await db.anomalyEvent.deleteMany({ where: { acknowledged: true, detectedAt: { lt: ninetyDaysAgo } } });
      results.push({ table: 'anomaly_events (acknowledged)', deleted: result.count, olderThanDays: 90 });
    } catch (err) {
      logSink.warn({ module: 'cerebro-cleanup', event: 'cleanup_anomalies_failed', message: 'Failed to clean old anomaly events', error: err });
    }

    try {
      const result = await db.alertDelivery.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo }, status: { in: ['sent', 'failed', 'delivered'] } } });
      results.push({ table: 'alert_deliveries', deleted: result.count, olderThanDays: 90 });
    } catch (err) {
      logSink.warn({ module: 'cerebro-cleanup', event: 'cleanup_alerts_failed', message: 'Failed to clean old alert deliveries', error: err });
    }

    try {
      const result = await db.refactorSuggestion.deleteMany({ where: { status: 'rejected', createdAt: { lt: oneHundredEightyDaysAgo } } });
      results.push({ table: 'refactor_suggestions (rejected)', deleted: result.count, olderThanDays: 180 });
    } catch (err) {
      logSink.warn({ module: 'cerebro-cleanup', event: 'cleanup_refactors_failed', message: 'Failed to clean old refactor suggestions', error: err });
    }

    try {
      const result = await db.cerebroAnalysis.deleteMany({ where: { createdAt: { lt: oneHundredEightyDaysAgo }, actionTaken: null } });
      results.push({ table: 'cerebro_analyses (no action)', deleted: result.count, olderThanDays: 180 });
    } catch (err) {
      logSink.warn({ module: 'cerebro-cleanup', event: 'cleanup_analyses_failed', message: 'Failed to clean old analyses', error: err });
    }

    try {
      const result = await db.knowledgeChunk.deleteMany({ where: { source: { in: ['refactor_applied', 'refactor_rejected'] }, createdAt: { lt: new Date(now - 365 * 24 * 60 * 60 * 1000) } } });
      results.push({ table: 'knowledge_chunks (feedback)', deleted: result.count, olderThanDays: 365 });
    } catch (err) {
      logSink.warn({ module: 'cerebro-cleanup', event: 'cleanup_knowledge_failed', message: 'Failed to clean old knowledge feedback', error: err });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'cerebro-cleanup',
      event: 'cleanup_complete',
      message: `Cleanup complete: ${totalDeleted} records removed in ${processingTime}ms`,
      context: { totalDeleted, mode, processingTimeMs: processingTime, breakdown: results },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      totalDeleted,
      processingTimeMs: processingTime,
      breakdown: results,
      message: `${totalDeleted} registros antigos removidos de ${results.length} tabelas`,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logSink.error({ module: 'cerebro-cleanup', event: 'cleanup_error', message: 'Cleanup execution failed', error });
    return NextResponse.json(
      { ok: false, error: 'Cleanup unavailable', timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
