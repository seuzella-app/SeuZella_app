// ============================================================================
// GET /api/zcc/cortex/growth — Growth Cortex snapshot
// ============================================================================

import { NextResponse } from 'next/server';
import { GrowthCortex } from '@/domain/cortex';
import { getAdapters } from '@/adapters';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// Singleton Growth Cortex instance for the API.
let _instance: GrowthCortex | undefined;
function getInstance(): GrowthCortex {
  if (!_instance) _instance = new GrowthCortex(getAdapters());
  return _instance;
}

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.cortex.growth', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.cortex.growth', what: 'zcc.cortex.growth.entry', resource: 'api', result: 'ALLOW' });
  const c = getInstance();
  return NextResponse.json({
    id: c.id,
    running: c.isRunning(),
    snapshot: c.snapshot(),
  });
}
