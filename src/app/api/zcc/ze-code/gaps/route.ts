// ============================================================================
// ZÉLLA — /api/zcc/ze-code/gaps
// ============================================================================
// GET: Lista gaps detectados (roda detectGaps on-demand, sem persistir por enquanto)
//   Query params:
//     ?target=src/         (default: 'src/')
//     ?maxFiles=10         (default: 10, hard cap 30)
//     ?gapType=missing_test  (filtra por tipo, opcional)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { detectGaps } from '@/lib/cerebro/ze-code/gap-detector';
import { logSink } from '@/lib/cerebro/log-sink';
import type { GapType } from '@/lib/cerebro/ze-code/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'src/';
    const maxFiles = Math.min(parseInt(searchParams.get('maxFiles') || '10', 10), 30);
    const gapType = searchParams.get('gapType') as GapType | null;

    const onlyTypes = gapType ? [gapType] : undefined;

    const result = await detectGaps({ target, maxFiles, onlyTypes });

    logSink.info({
      module: 'ze-code',
      event: 'gaps-listed',
      message: `Gaps listed: ${result.gaps.length} found in ${result.filesScanned} files`,
      context: { ip: security.ip, target, maxFiles, gapType, count: result.gaps.length },
    });

    return NextResponse.json({
      success: true,
      data: {
        gaps: result.gaps,
        filesScanned: result.filesScanned,
        mode: result.mode,
        durationMs: result.durationMs,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
