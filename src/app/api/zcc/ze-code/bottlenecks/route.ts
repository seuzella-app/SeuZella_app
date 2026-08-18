// ============================================================================
// ZÉLLA — /api/zcc/ze-code/bottlenecks
// ============================================================================
// GET: Lista gargalos detectados (roda detectBottlenecks on-demand)
//   Query params:
//     ?target=src/                (default: 'src/')
//     ?maxFiles=10                (default: 10, hard cap 30)
//     ?bottleneckType=n_plus_one_query  (filtra por tipo, opcional)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { detectBottlenecks } from '@/lib/cerebro/ze-code/bottleneck-detector';
import { logSink } from '@/lib/cerebro/log-sink';
import type { BottleneckType } from '@/lib/cerebro/ze-code/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'src/';
    const maxFiles = Math.min(parseInt(searchParams.get('maxFiles') || '10', 10), 30);
    const bottleneckType = searchParams.get('bottleneckType') as BottleneckType | null;

    const onlyTypes = bottleneckType ? [bottleneckType] : undefined;

    const result = await detectBottlenecks({ target, maxFiles, onlyTypes });

    logSink.info({
      module: 'ze-code',
      event: 'bottlenecks-listed',
      message: `Bottlenecks listed: ${result.bottlenecks.length} found in ${result.filesScanned} files`,
      context: { ip: security.ip, target, maxFiles, bottleneckType, count: result.bottlenecks.length },
    });

    return NextResponse.json({
      success: true,
      data: {
        bottlenecks: result.bottlenecks,
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
