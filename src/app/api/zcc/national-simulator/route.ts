// ============================================================================
// POST /api/zcc/national-simulator/run — run a national simulation for a city
// Body: { city, pousadaCount?, leadCount?, adsDays?, adsBudgetDailyBRL?, seed? }
// GET /api/zcc/national-simulator — list available cities
// ============================================================================

import { NextResponse } from 'next/server';
import { nationalSimulator } from '@/simulation';
import { ANCHOR_CITIES } from '@/simulation';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET() {
  return NextResponse.json({
    availableCities: ANCHOR_CITIES.map((c) => ({
      name: c.name,
      state: c.stateCode,
      coastal: c.coastal,
      tourismIntensity: c.tourismIntensity,
      peakSeason: c.peakSeason,
    })),
  });
}

export async function POST(req: Request) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.national-simulator', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.national-simulator', what: 'zcc.national-simulator.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await req.json();
    if (!body.city) {
      return NextResponse.json(
        { ok: false, error: 'city required' },
        { status: 400 }
      );
    }
    const result = await nationalSimulator.run({
      city: body.city,
      pousadaCount: body.pousadaCount,
      leadCount: body.leadCount,
      adsDays: body.adsDays,
      adsBudgetDailyBRL: body.adsBudgetDailyBRL,
      seed: body.seed,
      publishEvents: body.publishEvents ?? false,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
