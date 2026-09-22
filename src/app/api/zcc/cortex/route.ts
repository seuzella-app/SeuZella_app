// ============================================================================
// GET /api/zcc/cortex — list all cortexes with their snapshot
// ============================================================================

import { NextResponse } from 'next/server';
import {
  GrowthCortex,
  MarketIntelligenceCortex,
  SalesCortex,
  RevenueCortex,
  SuccessCortex,
  LearningCortex,
  ExecutiveCortex,
} from '@/domain/cortex';
import { ZellaGrowthStrategy } from '@/domain/strategy';
import { getAdapters } from '@/adapters';
import { zcc } from '@/domain/zcc';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// Singletons for the API.
let _growth: GrowthCortex | undefined;
let _market: MarketIntelligenceCortex | undefined;
let _sales: SalesCortex | undefined;
let _revenue: RevenueCortex | undefined;
let _success: SuccessCortex | undefined;
let _learning: LearningCortex | undefined;
let _executive: ExecutiveCortex | undefined;
let _zgs: ZellaGrowthStrategy | undefined;

function getInstances() {
  const adapters = getAdapters();
  if (!_growth) _growth = new GrowthCortex(adapters);
  if (!_market) _market = new MarketIntelligenceCortex(adapters);
  if (!_sales) _sales = new SalesCortex(adapters);
  if (!_revenue) _revenue = new RevenueCortex(adapters);
  if (!_success) _success = new SuccessCortex(adapters);
  if (!_learning) _learning = new LearningCortex(adapters);
  if (!_executive) _executive = new ExecutiveCortex(adapters);
  if (!_zgs) _zgs = new ZellaGrowthStrategy(adapters);
  return { _growth, _market, _sales, _revenue, _success, _learning, _executive, _zgs };
}

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.cortex', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.cortex', what: 'zcc.cortex.entry', resource: 'api', result: 'ALLOW' });
  const c = getInstances();
  return NextResponse.json({
    bootOrder: ['zcc', 'growth', 'market-intelligence', 'sales', 'revenue', 'success', 'learning', 'executive', 'zgs'],
    zccHealth: zcc.health(),
    cortexes: [
      { id: c._growth.id, running: c._growth.isRunning(), snapshot: c._growth.snapshot() },
      { id: c._market.id, running: c._market.isRunning(), snapshot: c._market.snapshot() },
      { id: c._sales.id, running: c._sales.isRunning(), snapshot: c._sales.snapshot() },
      { id: c._revenue.id, running: c._revenue.isRunning(), snapshot: c._revenue.snapshot() },
      { id: c._success.id, running: c._success.isRunning(), snapshot: c._success.snapshot() },
      { id: c._learning.id, running: c._learning.isRunning(), snapshot: c._learning.snapshot() },
      { id: c._executive.id, running: c._executive.isRunning(), snapshot: c._executive.snapshot() },
      { id: c._zgs.id, running: c._zgs.isRunning(), snapshot: c._zgs.snapshot() },
    ],
  });
}
