// ============================================================================
// ZÉLLA — /api/zcc/ze-code/evolve
// ============================================================================
// POST: Comando master "Evolve Code" — roda TODAS as capacidades do ZéCode:
//   - Gap detection (heurística + LLM)
//   - Bottleneck detection (heurística + LLM)
//   - Code review (apenas em live mode — em mock, deixa para trigger manual)
//   - Refactor suggestions (apenas em live mode — em mock, deixa para cron)
//
// Body:
//   { scope: 'hotspot' | 'directory' | 'full',
//     target?: string,           // default 'src/'
//     maxFiles?: number,         // default 10, hard cap 20
//     forceLive?: boolean,       // requer GODMODE
//     triggeredBy?: string }     // email do admin
//
// Safety locks:
//   - ZCC security guard (apenas admin)
//   - Quality gates (path allowlist, file size, budget, rate limit)
//   - Auto-apply SEMPRE false
//   - Em modo mock: $0 cost, heurística pura
//   - Em modo live: budget guard + rate limit + GODMODE check
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { evolveCode } from '@/lib/cerebro/ze-code/orchestrator';
import { logSink } from '@/lib/cerebro/log-sink';
import type { EvolveRequest } from '@/lib/cerebro/ze-code/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = (await request.json()) as Partial<EvolveRequest>;

    // Validação básica
    if (!body.scope || !['hotspot', 'directory', 'full'].includes(body.scope)) {
      return NextResponse.json(
        { success: false, error: 'scope inválido (deve ser hotspot | directory | full)' },
        { status: 400 },
      );
    }

    // GODMODE check para forceLive
    if (body.forceLive) {
      const godmode = process.env.ZCC_GODMODE === 'true' || process.env.GODMODE === 'true';
      if (!godmode) {
        return NextResponse.json(
          {
            success: false,
            error: 'GODMODE requerido para forceLive. Configure ZCC_GODMODE=true ou dispare sem forceLive (usará modo mock).',
          },
          { status: 403 },
        );
      }
    }

    const token = await getToken({ req: request });
    const triggeredBy = (token?.email as string | undefined) || 'unknown-admin';

    const req: EvolveRequest = {
      scope: body.scope,
      target: body.target || 'src/',
      maxFiles: body.maxFiles,
      forceLive: body.forceLive,
      triggeredBy,
    };

    const result = await evolveCode(req);

    logSink.info({
      module: 'ze-code',
      event: 'evolve-triggered',
      message: `Evolve completed: ${result.status} (job ${result.jobId}) — ${result.gapsCreated} gaps, ${result.bottlenecksCreated} bottlenecks`,
      context: {
        ip: security.ip,
        jobId: result.jobId,
        scope: req.scope,
        target: req.target,
        mode: result.mode,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        warnings: result.warnings,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
