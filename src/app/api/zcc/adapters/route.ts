// ============================================================================
// GET /api/zcc/adapters — show the current adapter mode map
// ============================================================================

import { NextResponse } from 'next/server';
import { resolveModeMap, getAdapters } from '@/adapters';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.adapters', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.adapters', what: 'zcc.adapters.entry', resource: 'api', result: 'ALLOW' });
  const modeMap = resolveModeMap();
  const adapters = getAdapters();
  return NextResponse.json({
    modeMap,
    adapters: {
      googleAds: { isDigitalTwin: adapters.googleAds.isDigitalTwin() },
      metaAds: { isDigitalTwin: adapters.metaAds.isDigitalTwin() },
      payment: { isDigitalTwin: adapters.payment.isDigitalTwin() },
      crm: { isDigitalTwin: adapters.crm.isDigitalTwin() },
      whatsapp: { isDigitalTwin: adapters.whatsapp.isDigitalTwin() },
      analytics: { isDigitalTwin: adapters.analytics.isDigitalTwin() },
      email: { isDigitalTwin: adapters.email.isDigitalTwin() },
      maps: { isDigitalTwin: adapters.maps.isDigitalTwin() },
    },
  });
}
