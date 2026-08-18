// ============================================================================
// ZÉLLA — /api/zcc/ze-code/apply
// ============================================================================
// POST: Marca uma sugestão como "applied" no DB (com safety locks).
//
// Body:
//   { category: 'review' | 'refactor' | 'gap' | 'bottleneck',
//     suggestionId: string,
//     notes?: string }
//
// Safety locks:
//   - ZCC security guard (apenas admin)
//   - appliedBy extraído do security audit entry (NUNCA do body)
//   - Auto-apply SEMPRE false — apenas marca no DB
//   - Em modo mock: NENHUMA escrita no filesystem
//   - Em modo live: apenas marca no DB — escrita real via git/PR separado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { applySuggestion } from '@/lib/cerebro/ze-code/orchestrator';
import { logSink } from '@/lib/cerebro/log-sink';
import type { ApplySuggestionRequest, SuggestionCategory } from '@/lib/cerebro/ze-code/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = (await request.json()) as {
      category?: SuggestionCategory;
      suggestionId?: string;
      notes?: string;
    };

    // Validação obrigatória
    if (!body.category || !body.suggestionId) {
      return NextResponse.json(
        { success: false, error: 'category e suggestionId são obrigatórios' },
        { status: 400 },
      );
    }

    const validCategories: SuggestionCategory[] = ['review', 'refactor', 'gap', 'bottleneck'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: `category inválido: ${body.category}` },
        { status: 400 },
      );
    }

    const token = await getToken({ req: request });
    const appliedBy = (token?.email as string | undefined) || 'unknown-admin';

    const req: ApplySuggestionRequest = {
      category: body.category,
      suggestionId: body.suggestionId,
      appliedBy,
      notes: body.notes,
    };

    const result = await applySuggestion(req);

    logSink.info({
      module: 'ze-code',
      event: 'apply-request',
      message: `Apply ${result.status}: ${req.category}#${req.suggestionId} by ${req.appliedBy}`,
      context: {
        ip: security.ip,
        category: req.category,
        suggestionId: req.suggestionId,
        appliedBy: req.appliedBy,
        status: result.status,
        mode: result.mode,
        safetyLocksTriggered: result.safetyLocksTriggered,
      },
    });

    return NextResponse.json({
      success: result.ok,
      data: result,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
