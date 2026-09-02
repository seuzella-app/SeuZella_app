// ============================================================================
// ZÉLLA — POST /api/ddc/cerebro/feedback
// ============================================================================
// Endpoint para registrar feedback do hóspede sobre resposta da IA.
// Conecta feedback ao KnowledgeEntry e recalcula effectiveness dinamicamente.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { recordFeedback } from '@/lib/cerebro/learning-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireDDCTenantId();
    const body = await req.json();

    // Validate input
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating deve ser inteiro de 1 a 5' },
        { status: 400 }
      );
    }

    // Defense in depth: a client may know another tenant's KnowledgeEntry ID.
    // Never allow feedback in tenant A to mutate knowledge belonging to tenant B.
    if (body.knowledgeEntryId) {
      const knowledgeEntry = await db.knowledgeEntry.findFirst({
        where: {
          id: String(body.knowledgeEntryId),
          tenantId,
        },
        select: { id: true },
      });

      if (!knowledgeEntry) {
        return NextResponse.json(
          { success: false, error: 'KnowledgeEntry não pertence ao tenant autenticado' },
          { status: 404 }
        );
      }
    }

    const result = await recordFeedback({
      tenantId,
      knowledgeEntryId: body.knowledgeEntryId,
      conversationId: body.conversationId,
      messageId: body.messageId,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      wasUseful: Boolean(body.wasUseful),
      guestFeedback: body.guestFeedback,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Erro ao registrar feedback' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedKnowledge: result.updatedKnowledge,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[POST /api/ddc/cerebro/feedback]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
