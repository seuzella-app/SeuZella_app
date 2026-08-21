// =============================================================================
// ZÉLLA — Telemetry Query API
// =============================================================================
// GET endpoint that returns aggregated telemetry data for the ZCC dashboard.
// Requires ZCC Security Gate V3 validation via verifyZCCAccessOrReject.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import {
  getEvents,
  getAggregates,
  getBurnRate,
  getRevenue,
  getActiveTenantIds,
  getStoreStats,
} from '@/lib/telemetry-store';
import type { TelemetryEventType, TelemetryCategory, TelemetryQueryParams } from '@/lib/telemetry-types';

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = request.nextUrl;
    const filters: TelemetryQueryParams = {};

    const type = searchParams.get('type') as TelemetryEventType | null;
    if (type) filters.type = type;

    const tenantId = searchParams.get('tenantId');
    if (tenantId) filters.tenantId = tenantId;

    const category = searchParams.get('category') as TelemetryCategory | null;
    if (category) filters.category = category;

    const since = searchParams.get('since');
    if (since) filters.since = since;

    const until = searchParams.get('until');
    if (until) filters.until = until;

    const limitParam = searchParams.get('limit');
    if (limitParam) {
      const parsed = Number.parseInt(limitParam, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid limit' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      filters.limit = Math.min(parsed, 1000);
    }

    const includes = (searchParams.get('include') || '').split(',').filter(Boolean);
    const includeAll = includes.length === 0 || includes.includes('all');

    const events = getEvents(filters);
    const response: Record<string, unknown> = {
      success: true,
      data: { events, total: events.length },
    };

    const data = response.data as Record<string, unknown>;
    if (includeAll || includes.includes('aggregates')) {
      data.aggregates = getAggregates(filters.tenantId, filters.type, filters.since);
    }

    if (includeAll || includes.includes('burnRate')) {
      const tenantIds = filters.tenantId ? [filters.tenantId] : getActiveTenantIds();
      data.burnRates = tenantIds.map(id => getBurnRate(id));
    }

    if (includeAll || includes.includes('revenue')) {
      const tenantIds = filters.tenantId ? [filters.tenantId] : getActiveTenantIds();
      data.revenues = tenantIds.map(id => getRevenue(id));
    }

    if (includeAll || includes.includes('storeStats')) {
      data.storeStats = getStoreStats();
    }

    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Telemetry Query] Error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Telemetry query unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
