// =============================================================================
// ZÉLLA — Telemetry Ingest API
// =============================================================================
// DDC telemetry bridge. Tenant identity comes from the authenticated DDC
// session; the client is never trusted to choose another tenant.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { addEvent } from '@/lib/telemetry-store';
import { VALID_EVENT_TYPES } from '@/lib/telemetry-types';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import type { TelemetryEventType, TelemetryIngestRequest } from '@/lib/telemetry-types';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const tenantCache = new Map<string, { exists: boolean; checkedAt: number }>();
const TENANT_CACHE_TTL = 5 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_DATA_KEYS = 50;

async function verifyTenantExists(tenantId: string): Promise<boolean> {
  const cached = tenantCache.get(tenantId);
  if (cached && Date.now() - cached.checkedAt < TENANT_CACHE_TTL) return cached.exists;
  try {
    const { db } = await import('@/lib/db');
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    const exists = !!tenant;
    tenantCache.set(tenantId, { exists, checkedAt: Date.now() });
    return exists;
  } catch (error) {
    console.error('[Telemetry] Tenant verification failed:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

let lastCleanup = Date.now();
function cleanupTenantCache() {
  if (Date.now() - lastCleanup > 10 * 60 * 1000) {
    for (const [id, entry] of tenantCache) if (Date.now() - entry.checkedAt > TENANT_CACHE_TTL) tenantCache.delete(id);
    lastCleanup = Date.now();
  }
}

export async function POST(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 120 req/1min.
  const rlDeny = guardRequest(request, 'telemetry.ingest', { points: 120, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:telemetry.ingest', what: 'telemetry.ingest.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireDDCTenantId();
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let body: TelemetryIngestRequest;
    try {
      body = JSON.parse(rawBody) as TelemetryIngestRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || !body.type || !body.tenantId) return NextResponse.json({ error: 'Missing required fields: type, tenantId' }, { status: 400 });
    if (body.tenantId !== tenantId) return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 });
    if (!VALID_EVENT_TYPES.has(body.type as TelemetryEventType)) return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    if (body.data && typeof body.data !== 'object') return NextResponse.json({ error: 'data must be an object' }, { status: 400 });
    if (body.data && Object.keys(body.data).length > MAX_DATA_KEYS) return NextResponse.json({ error: 'Too many data fields' }, { status: 400 });

    const tenantExists = await verifyTenantExists(tenantId);
    if (!tenantExists) return NextResponse.json({ error: 'Tenant unavailable' }, { status: 503 });

    cleanupTenantCache();
    const event = addEvent({ type: body.type as TelemetryEventType, tenantId, data: body.data ?? {} });
    return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('DDC_AUTH_REQUIRED')) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    console.error('[Telemetry Ingest] Error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ received: false, error: 'Telemetry unavailable' }, { status: 503 });
  }
}
