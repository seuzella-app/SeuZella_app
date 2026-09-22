// ============================================================================
// GET /api/zcc/digital-twin — Digital Twin status & snapshot
// POST /api/zcc/digital-twin/boot — Boot the Digital Twin
// ============================================================================

import { NextResponse } from 'next/server';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
import {
  bootDigitalTwin,
  isDigitalTwinBooted,
  digitalTwinSnapshot,
} from '@/simulation';

export async function GET() {
  return NextResponse.json({
    ...digitalTwinSnapshot(),
  });
}

export async function POST(req: Request) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.digital-twin', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.digital-twin', what: 'zcc.digital-twin.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await req.json().catch(() => ({}));
    await bootDigitalTwin({
      operatingMode: 'digital-twin',
      seedSyntheticBrazil: body.seedSyntheticBrazil ?? true,
      autoStartLab: body.autoStartLab ?? false,
      heartbeatMs: body.heartbeatMs,
    });
    return NextResponse.json({
      ok: true,
      booted: isDigitalTwinBooted(),
      snapshot: digitalTwinSnapshot(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
