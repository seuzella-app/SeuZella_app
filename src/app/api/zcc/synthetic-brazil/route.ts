// ============================================================================
// GET /api/zcc/synthetic-brazil — list anchor cities
// POST /api/zcc/synthetic-brazil/generate — generate a Synthetic Brazil slice
// ============================================================================

import { NextResponse } from 'next/server';
import { ANCHOR_CITIES, BRAZILIAN_STATES, generateSyntheticBrazil } from '@/simulation';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.synthetic-brazil', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.synthetic-brazil', what: 'zcc.synthetic-brazil.entry', resource: 'api', result: 'ALLOW' });
  return NextResponse.json({
    states: BRAZILIAN_STATES,
    anchorCities: ANCHOR_CITIES,
    anchorCityCount: ANCHOR_CITIES.length,
    stateCount: BRAZILIAN_STATES.length,
  });
}
