/**
 * GET /api/v1/latency — Latency report (ZCC-admin-gated)
 * ============================================================================
 * Returns latency percentiles (p50/p95/p99) for all instrumented routes.
 *
 * AUTH: This endpoint is admin-only (verifyZCCAccessOrReject). Latency data
 * is global per route, not per-tenant — each route samples all traffic
 * regardless of which tenant generated it. Exposing this to a single tenant
 * would leak aggregate performance data.
 *
 * STATUS: CODE_READY
 * RUNTIME_VALIDATED: FALSE (samples populate with production traffic)
 *
 * Response shape:
 *   {
 *     status: 'CODE_READY',
 *     runtimeValidated: false,
 *     note: 'IN_MEMORY_ONLY_NOT_PERSISTED',
 *     timestamp: ISO string,
 *     routes: {
 *       'checkout.create': { p50, p95, p99, samples, totalRecorded, min, max, mean },
 *       'ddc.bookings.list': { ... },
 *       ...
 *     }
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getLatencyReport, getInstrumentedRoutes } from '@/lib/observability/latency-tracker';
import { resolveTraceId, withTraceHeaders } from '@/lib/observability/trace-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const traceId = resolveTraceId(request);

  // AUTH: ZCC admin only — latency is global, not tenant-scoped
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const routes = getLatencyReport();
  const instrumentedRoutes = getInstrumentedRoutes();

  return withTraceHeaders(
    NextResponse.json({
      status: 'CODE_READY',
      runtimeValidated: false,
      note: 'IN_MEMORY_ONLY_NOT_PERSISTED',
      timestamp: new Date().toISOString(),
      instrumentedRoutes,
      routes,
      requestId: traceId,
    }),
    traceId
  );
}
