// ============================================================================
// ZÉLLA — /api/zcc/ze-code/bottlenecks
// ============================================================================
// GET: Lista gargalos detectados.
//   Modo padrão (sem ?scan=true): lista do DB (findings persistidos via Evolve)
//   Com ?scan=true: roda detectBottlenecks on-demand (live scan)
//
//   Query params:
//     ?target=src/                (default: 'src/' — apenas para scan=true)
//     ?maxFiles=10                (default: 10, hard cap 30 — apenas para scan=true)
//     ?bottleneckType=n_plus_one_query  (filtra por tipo)
//     ?status=pending              (filtra por status: pending|approved|rejected|applied)
//     ?limit=50                    (default: 50, hard cap 200 — paginação DB)
//     ?offset=0                    (offset paginação)
//     ?scan=true                   (força scan on-demand em vez de ler do DB)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { detectBottlenecks } from '@/lib/cerebro/ze-code/bottleneck-detector';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import type { BottleneckType } from '@/lib/cerebro/ze-code/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const scan = searchParams.get('scan') === 'true';
    const bottleneckType = searchParams.get('bottleneckType') as BottleneckType | null;
    const status = searchParams.get('status') || undefined;

    // Modo scan: roda detectBottlenecks on-demand (não persiste)
    if (scan) {
      const target = searchParams.get('target') || 'src/';
      const maxFiles = Math.min(parseInt(searchParams.get('maxFiles') || '10', 10), 30);
      const onlyTypes = bottleneckType ? [bottleneckType] : undefined;

      const result = await detectBottlenecks({ target, maxFiles, onlyTypes, persist: false });

      logSink.info({
        module: 'ze-code',
        event: 'bottlenecks-scanned',
        message: `Bottlenecks scanned: ${result.bottlenecks.length} found in ${result.filesScanned} files`,
        context: { ip: security.ip, target, maxFiles, bottleneckType, count: result.bottlenecks.length },
      });

      return NextResponse.json({
        success: true,
        data: {
          bottlenecks: result.bottlenecks,
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
    if (bottleneckType) where.bottleneckType = bottleneckType;
    if (status) where.status = status;

    let bottlenecks: any[] = [];
    let total = 0;

    try {
      [bottlenecks, total] = await Promise.all([
        db.bottleneckFinding.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.bottleneckFinding.count({ where }),
      ]);
    } catch (e) {
      logSink.warn({
        module: 'ze-code',
        event: 'bottlenecks-db-fallback',
        message: `DB indisponível para listar bottlenecks (retornando vazio): ${(e as Error).message}`,
        context: { ip: security.ip },
      });
    }

    logSink.info({
      module: 'ze-code',
      event: 'bottlenecks-listed',
      message: `Bottlenecks listed from DB: ${bottlenecks.length} of ${total}`,
      context: { ip: security.ip, bottleneckType, status, count: bottlenecks.length, total },
    });

    return NextResponse.json({
      success: true,
      data: {
        bottlenecks,
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
