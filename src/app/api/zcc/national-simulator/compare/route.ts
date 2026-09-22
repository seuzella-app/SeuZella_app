// ============================================================================
// POST /api/zcc/national-simulator/compare — compare multiple cities
// Body: { cities: string[], leadCount?, adsDays?, seed? }
// ============================================================================

import { NextResponse } from 'next/server';
import { nationalSimulator } from '@/simulation';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function POST(req: Request) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.national-simulator.compare', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.national-simulator.compare', what: 'zcc.national-simulator.compare.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await req.json();
    if (!Array.isArray(body.cities) || body.cities.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'cities[] required' },
        { status: 400 }
      );
    }
    const result = await nationalSimulator.compare(body.cities, {
      leadCount: body.leadCount,
      adsDays: body.adsDays,
      seed: body.seed,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
