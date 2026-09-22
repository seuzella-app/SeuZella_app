// ============================================================================
// GET /api/zcc/cognitive-bus — inspect the ZCB event log
// Query: ?prefix=&source=&since=&limit=
// ============================================================================

import { NextResponse } from 'next/server';
import { zcb } from '@/domain/zcc';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(req: Request) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.cognitive-bus', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.cognitive-bus', what: 'zcc.cognitive-bus.entry', resource: 'api', result: 'ALLOW' });
  const url = new URL(req.url);
  const prefix = url.searchParams.get('prefix') ?? undefined;
  const source = url.searchParams.get('source') as any;
  const since = url.searchParams.get('since') ?? undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 1000;
  const events = zcb.inspect({
    typePrefix: prefix,
    source,
    since,
    limit,
  });
  return NextResponse.json({
    totalEvents: zcb.size(),
    returned: events.length,
    events,
  });
}
