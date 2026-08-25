import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { collectObservabilityMetrics, checkAlertThresholds } from '@/lib/observability/sre-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const metrics = await collectObservabilityMetrics();
    const alerts = checkAlertThresholds(metrics);

    return NextResponse.json({
      success: true,
      metrics,
      alerts,
      alertCount: alerts.length,
      criticalAlertCount: alerts.filter(a => a.level === 'critical').length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'METRICS_COLLECTION_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
