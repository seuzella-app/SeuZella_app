// ============================================================================
// ZÉLLA — /api/zcc/ze-code/gaps
// ============================================================================
// GET: Lista gaps detectados.
//   Modo padrão (sem ?scan=true): lista do DB (findings persistidos via Evolve)
//   Com ?scan=true: roda detectGaps on-demand (live scan)
//
//   Query params:
//     ?target=src/         (default: 'src/' — apenas para scan=true)
//     ?maxFiles=10         (default: 10, hard cap 30 — apenas para scan=true)
//     ?gapType=missing_test (filtra por tipo)
//     ?status=pending      (filtra por status: pending|approved|rejected|applied)
//     ?limit=50             (default: 50, hard cap 200 — paginação DB)
//     ?offset=0             (offset paginação)
//     ?scan=true            (força scan on-demand em vez de ler do DB)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { detectGaps } from '@/lib/cerebro/ze-code/gap-detector';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import type { GapType } from '@/lib/cerebro/ze-code/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const scan = searchParams.get('scan') === 'true';
    const gapType = searchParams.get('gapType') as GapType | null;
    const status = searchParams.get('status') || undefined;

    // Modo scan: roda detectGaps on-demand (não persiste)
    if (scan) {
      const target = searchParams.get('target') || 'src/';
      const maxFiles = Math.min(parseInt(searchParams.get('maxFiles') || '10', 10), 30);
      const onlyTypes = gapType ? [gapType] : undefined;

      const result = await detectGaps({ target, maxFiles, onlyTypes, persist: false });

      logSink.info({
        module: 'ze-code',
        event: 'gaps-scanned',
        message: `Gaps scanned: ${result.gaps.length} found in ${result.filesScanned} files`,
        context: { ip: security.ip, target, maxFiles, gapType, count: result.gaps.length },
      });

      return NextResponse.json({
        success: true,
        data: {
          gaps: result.gaps,
          filesScanned: result.filesScanned,
          mode: result.mode,
          durationMs: result.durationMs,
          source: 'scan',
        },
      });
    }

    // Modo padrão: lista do DB (findings persistidos)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = {};
    if (gapType) where.gapType = gapType;
    if (status) where.status = status;

    let gaps: any[] = [];
    let total = 0;

    try {
      [gaps, total] = await Promise.all([
        db.gapFinding.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.gapFinding.count({ where }),
      ]);
    } catch (e) {
      logSink.warn({
        module: 'ze-code',
        event: 'gaps-db-fallback',
        message: `DB indisponível para listar gaps (retornando vazio): ${(e as Error).message}`,
        context: { ip: security.ip },
      });
    }

    logSink.info({
      module: 'ze-code',
      event: 'gaps-listed',
      message: `Gaps listed from DB: ${gaps.length} of ${total}`,
      context: { ip: security.ip, gapType, status, count: gaps.length, total },
    });

    return NextResponse.json({
      success: true,
      data: {
        gaps,
        total,
        limit,
        offset,
        source: 'db',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
