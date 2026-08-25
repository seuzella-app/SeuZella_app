import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { collectObservabilityMetrics, checkAlertThresholds, type SreAlert } from '@/lib/observability/sre-service';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * CRON — SRE Alerts (madrugada)
 * Schedule: 0 7 * * * (07:00 UTC = 04:00 BRT)
 *
 * Coleta métricas operacionais + verifica thresholds.
 * Se houver alerts critical/warning → publica realtime para ZCC.
 */
export async function GET(request: NextRequest) {
  const authOk = await verifyCronAuth(request, 'admin:all');
  if (!authOk.ok) {
    return authOk.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const metrics = await collectObservabilityMetrics();
    const alerts = checkAlertThresholds(metrics);

    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');

    if (criticalAlerts.length > 0 || warningAlerts.length > 0) {
      // Publish alert to ZCC via realtime SSE
      publishTenantEvent('zcc-admin-tenant', 'tenant:metadata_updated', {
        type: 'sre_alert',
        level: criticalAlerts.length > 0 ? 'critical' : 'warning',
        alerts: alerts.map(a => ({
          level: a.level,
          metric: a.metric,
          message: a.message,
        })),
        count: alerts.length,
        timestamp: new Date().toISOString(),
      });

      logger.warn('[SRE_ALERTS] Alerts triggered', {
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        alerts: alerts.map(a => `${a.level}: ${a.message}`),
      });
    }

    return NextResponse.json({
      success: true,
      metrics: {
        status: metrics.uptime.status,
        activeTenants: metrics.database.activeTenants,
        openFindings: metrics.security.openFindings,
        criticalFindings: metrics.security.criticalFindings,
        llmCostUsd: metrics.costs.llmCostUsdThisMonth,
        webhookFailures: metrics.errors.webhookFailures,
        cerebroErrors: metrics.errors.cerebroAnalysisErrors,
      },
      alerts,
      alertCount: alerts.length,
      criticalCount: criticalAlerts.length,
      warningCount: warningAlerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'SRE_ALERTS_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
