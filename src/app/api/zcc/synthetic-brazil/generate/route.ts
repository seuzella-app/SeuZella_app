// ============================================================================
// POST /api/zcc/synthetic-brazil/generate — generate a Synthetic Brazil slice
// Body: { seed?, cityCount?, pousadaCount?, airbnbCount?, guestCount?, competitorCount?, historyYears? }
// ============================================================================

import { NextResponse } from 'next/server';
import { generateSyntheticBrazil } from '@/simulation';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function POST(req: Request) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.synthetic-brazil.generate', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.synthetic-brazil.generate', what: 'zcc.synthetic-brazil.generate.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await req.json().catch(() => ({}));
    const snapshot = generateSyntheticBrazil({
      seed: body.seed,
      cityCount: body.cityCount,
      pousadaCount: body.pousadaCount,
      airbnbCount: body.airbnbCount,
      guestCount: body.guestCount,
      competitorCount: body.competitorCount,
      historyYears: body.historyYears,
    });
    return NextResponse.json({
      ok: true,
      summary: {
        generatedAt: snapshot.generatedAt,
        seed: snapshot.seed,
        cityCount: snapshot.cities.length,
        pousadaCount: snapshot.pousadas.length,
        airbnbCount: snapshot.airbnbs.length,
        guestCount: snapshot.guests.length,
        competitorCount: snapshot.competitors.length,
        historicalEventCount: snapshot.historicalEventCount,
      },
      // Sample of each entity type (avoid sending the entire 250k guests).
      sample: {
        cities: snapshot.cities.slice(0, 20),
        pousadas: snapshot.pousadas.slice(0, 10),
        airbnbs: snapshot.airbnbs.slice(0, 10),
        guests: snapshot.guests.slice(0, 10),
        competitors: snapshot.competitors,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
