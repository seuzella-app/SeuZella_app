// ============================================================================
// GET /api/zcc/personas — list available Behavioral Engine personas
// ============================================================================

import { NextResponse } from 'next/server';
import { PERSONAS } from '@/simulation';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.personas', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.personas', what: 'zcc.personas.entry', resource: 'api', result: 'ALLOW' });
  return NextResponse.json({
    personas: PERSONAS,
    count: PERSONAS.length,
  });
}
