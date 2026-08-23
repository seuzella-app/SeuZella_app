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

export async function GET(request: NextRequest): Promise<NextResponse> {
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
