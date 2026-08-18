// ============================================================================
// ZÉLLA — /api/zcc/ze-code/refactors
// ============================================================================
// GET: Lista refactor suggestions (proxy para /api/zcc/cerebro/refactors).
// Reusa 100% do serviço existente (RefactorSuggester).
//
// Query params (iguais ao /api/zcc/cerebro/refactors):
//   ?status=pending_review  (filtra por status)
//   ?limit=20                (default 20, hard cap 50)
//   ?stats=true              (retorna apenas stats, não lista)
//
// ZéCode wraps com auditoria "ze-code" para visibilidade unificada.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const wantStats = searchParams.get('stats') === 'true';
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Modo stats (retorna apenas agregações)
    if (wantStats) {
      try {
        const [total, pendingReview, approved, rejected, applied] = await Promise.all([
          db.refactorSuggestion.count(),
          db.refactorSuggestion.count({ where: { status: 'pending_review' } }),
          db.refactorSuggestion.count({ where: { status: 'approved' } }),
          db.refactorSuggestion.count({ where: { status: 'rejected' } }),
          db.refactorSuggestion.count({ where: { status: 'applied' } }),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            totalSuggestions: total,
            pendingReview,
            approved,
            rejected,
            applied,
          },
        });
      } catch {
        // DB indisponível — retorna zeros
        return NextResponse.json({
          success: true,
          data: {
            totalSuggestions: 0,
            pendingReview: 0,
            approved: 0,
            rejected: 0,
            applied: 0,
          },
        });
      }
    }

    // Lista sugestões
    try {
      const suggestions = await db.refactorSuggestion.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      logSink.info({
        module: 'ze-code',
        event: 'refactors-listed',
        message: `Refactors listed: ${suggestions.length} (status=${status || 'all'})`,
        context: { ip: security.ip, status, limit, count: suggestions.length },
      });

      return NextResponse.json({
        success: true,
        data: suggestions,
      });
    } catch {
      // DB indisponível — retorna lista vazia
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}

// POST: ação (approve / reject / apply) — proxy para o endpoint existente
export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'approve' | 'reject' | 'apply'
    const body = (await request.json().catch(() => ({}))) as {
      suggestionId?: string;
      notes?: string;
    };

    if (!action || !body.suggestionId) {
      return NextResponse.json(
        { success: false, error: 'action (query) e suggestionId (body) são obrigatórios' },
        { status: 400 },
      );
    }

    const validActions = ['approve', 'reject', 'apply'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `action inválido: ${action}` },
        { status: 400 },
      );
    }

    // Mapeia ação para status final
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      apply: 'applied',
    } as const;
    const finalStatus = statusMap[action as keyof typeof statusMap];

    const token = await getToken({ req: request });
    const adminEmail = (token?.email as string | undefined) || 'unknown-admin';

    try {
      const updated = await db.refactorSuggestion.update({
        where: { id: body.suggestionId },
        data: {
          status: finalStatus,
          reviewedBy: adminEmail,
          reviewedAt: new Date(),
          reviewNotes: body.notes || (action === 'reject' ? 'Rejected via ZéCode UI' : 'Approved via ZéCode UI'),
        },
      });

      logSink.info({
        module: 'ze-code',
        event: 'refactor-action',
        message: `Refactor ${action}: ${body.suggestionId} by ${updated.reviewedBy}`,
        context: {
          ip: security.ip,
          suggestionId: body.suggestionId,
          action,
          finalStatus,
          appliedBy: updated.reviewedBy,
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'DB update failed', details: (e as Error).message },
        { status: 500 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
