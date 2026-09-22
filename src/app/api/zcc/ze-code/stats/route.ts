// ============================================================================
// ZÉLLA — /api/zcc/ze-code/stats
// ============================================================================
// GET: Retorna estatísticas unificadas do ZéCode:
//   - Codebase domain (files, chunks, distribution)
//   - Safety locks status (budget, rate limit, allowlist)
//   - Counts (reviews, refactors, gaps, bottlenecks — pending + total)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getZeCodeStats } from '@/lib/cerebro/ze-code/orchestrator';
import { logSink } from '@/lib/cerebro/log-sink';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.ze-code.stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.ze-code.stats', what: 'zcc.ze-code.stats.entry', resource: 'api', result: 'ALLOW' });
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    // Spend atual do mês — em mock mode, 0. Em live, leria do DB.
    const monthlySpendUsd = 0;

    const stats = await getZeCodeStats(monthlySpendUsd);

    logSink.info({
      module: 'ze-code',
      event: 'stats-fetched',
      message: 'ZéCode stats fetched by admin',
      context: { ip: security.ip, mode: stats.mode },
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
