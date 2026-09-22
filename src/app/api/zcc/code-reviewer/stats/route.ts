// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — Stats + Budget + Rate Limits
// ============================================================================
// GET /api/zcc/code-reviewer/stats
//   Retorna: stats agregadas, budget atual, rate limits, lista de arquivos
//   modificados (para UI pré-trigger).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getCodeReviewer } from '@/lib/cerebro/code-reviewer/reviewer-service';
import { getBudgetStats, getRateLimitStats, QUALITY_GATE_LIMITS } from '@/lib/cerebro/code-reviewer/quality-gates';
import { listModifiedFiles } from '@/lib/cerebro/code-reviewer/diff-extractor';
import { CODE_READER_LIMITS } from '@/lib/cerebro/code-reviewer/code-reader';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.code-reviewer.stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.code-reviewer.stats', what: 'zcc.code-reviewer.stats.entry', resource: 'api', result: 'ALLOW' });
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const includeModified = searchParams.get('includeModified') === 'true';

    const reviewer = getCodeReviewer();
    const [stats, budget, rateLimits] = await Promise.all([
      reviewer.getStats(),
      getBudgetStats(),
      Promise.resolve(getRateLimitStats()),
    ]);

    const modifiedFiles = includeModified ? listModifiedFiles() : [];

    return NextResponse.json({
      ok: true,
      data: {
        stats,
        budget,
        rateLimits,
        limits: {
          qualityGates: QUALITY_GATE_LIMITS,
          codeReader: CODE_READER_LIMITS,
        },
        modifiedFiles: includeModified
          ? { count: modifiedFiles.length, files: modifiedFiles }
          : undefined,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
