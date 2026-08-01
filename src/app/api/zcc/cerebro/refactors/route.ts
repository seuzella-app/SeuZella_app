// ============================================================================
// ZÉLLA — ZCC Endpoint: Refactor Suggestions
// ============================================================================
// Permite ao admin Zélla visualizar, aprovar, rejeitar ou aplicar sugestões
// de refatoração geradas pelo Cérebro.
//
// Endpoints:
//  GET  /api/zcc/cerebro/refactors                 — lista sugestões
//  GET  /api/zcc/cerebro/refactors?stats=true      — stats do RefactorSuggester
//  GET  /api/zcc/cerebro/refactors?reindex=true    — força re-indexação do código
//  POST /api/zcc/cerebro/refactors?action=approve  — aprova sugestão
//  POST /api/zcc/cerebro/refactors?action=reject   — rejeita sugestão
//  POST /api/zcc/cerebro/refactors?action=apply    — marca como aplicada
//  POST /api/zcc/cerebro/refactors?action=trigger  — força análise manual
//
// Auth: verifyZCCAccessOrReject
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getRefactorSuggester, findRecurringErrors } from '@/lib/cerebro/refactor-suggester';
import { indexCodebase } from '@/lib/cerebro/code-indexer';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const isStats = searchParams.get('stats') === 'true';
    const isReindex = searchParams.get('reindex') === 'true';

    // Re-indexação forçada (manual)
    if (isReindex) {
      logSink.info({
        module: 'zcc-cerebro-refactors',
        event: 'manual_reindex',
        message: 'Re-indexação forçada pelo admin ZCC',
        context: { triggeredBy: security.ip },
      });

      const result = await indexCodebase();
      return NextResponse.json({
        success: true,
        message: `Re-indexação completa: ${result.filesScanned} arquivos, ${result.chunksCreated} chunks em ${result.durationMs}ms`,
        data: result,
      });
    }

    if (isStats) {
      const suggester = getRefactorSuggester();
      const stats = await suggester.getStats();
      return NextResponse.json({
        success: true,
        data: stats,
        mode: getCerebroMode(),
      });
    }

    // Lista sugestões com filtros
    const statusParam = searchParams.get('status'); // pending_review | approved | rejected | applied
    const filePathParam = searchParams.get('filePath');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = {};
    if (statusParam) where.status = statusParam;
    if (filePathParam) where.filePath = { contains: filePathParam };

    const limit = Math.min(Math.max(limitParam || 50, 1), 200);

    const suggestions = await db.refactorSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: suggestions,
      stats: {
        total: suggestions.length,
        pending: suggestions.filter((s: { status: string }) => s.status === 'pending_review').length,
        approved: suggestions.filter((s: { status: string }) => s.status === 'approved').length,
        rejected: suggestions.filter((s: { status: string }) => s.status === 'rejected').length,
        applied: suggestions.filter((s: { status: string }) => s.status === 'applied').length,
      },
      mode: getCerebroMode(),
    });
  } catch (error) {
    console.error('[zcc/cerebro/refactors GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const body = await request.json().catch(() => ({}));

    switch (action) {
      case 'approve':
      case 'reject':
      case 'apply': {
        const { suggestionId, notes } = body as { suggestionId?: string; notes?: string };

        if (!suggestionId) {
          return NextResponse.json(
            { error: 'suggestionId é obrigatório no body' },
            { status: 400 }
          );
        }

        // Mapeia action → status (approve → approved, etc)
        const statusMap: Record<string, 'approved' | 'rejected' | 'applied'> = {
          approve: 'approved',
          reject: 'rejected',
          apply: 'applied',
        };
        const newStatus = statusMap[action];

        const reviewerEmail = `admin@${security.ip}`;
        const suggester = getRefactorSuggester();
        await suggester.recordFeedback(
          suggestionId,
          newStatus,
          reviewerEmail,
          notes
        );

        return NextResponse.json({
          success: true,
          message: `Sugestão ${suggestionId} marcada como ${newStatus} por ${reviewerEmail}`,
          action: newStatus,
        });
      }

      case 'trigger': {
        // Força análise manual: encontra erros recorrentes e gera sugestões
        logSink.info({
          module: 'zcc-cerebro-refactors',
          event: 'manual_trigger',
          message: 'Análise manual de refatoração iniciada pelo admin ZCC',
          context: { triggeredBy: security.ip },
        });

        const recurring = await findRecurringErrors(5);
        const suggester = getRefactorSuggester();

        const created: Array<{ suggestionId: string; filePath: string; confidence: number }> = [];
        for (const errorGroup of recurring.slice(0, 5)) { // top 5
          try {
            const result = await suggester.suggestRefactor({
              errorHash: errorGroup.errorHash,
              errorMessage: errorGroup.sampleEvent.message,
              stackTrace: errorGroup.sampleEvent.stack,
              occurrencesCount: errorGroup.count,
              recentErrors: errorGroup.recentErrors,
            });

            if (result.suggestionId) {
              created.push({
                suggestionId: result.suggestionId,
                filePath: result.filePath,
                confidence: result.confidence,
              });
            }
          } catch (err) {
            logSink.error({
              module: 'zcc-cerebro-refactors',
              event: 'manual_trigger_failed',
              message: `Falha ao gerar sugestão para erro ${errorGroup.errorHash}`,
              error: err,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `${created.length} sugestão(ões) criada(s) manualmente`,
          recurringErrorsFound: recurring.length,
          suggestionsCreated: created.length,
          data: created,
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inválido: "${action}". Use ?action=approve|reject|apply|trigger` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[zcc/cerebro/refactors POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
