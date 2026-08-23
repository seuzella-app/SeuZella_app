// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — Apply / Dismiss Comment
// ============================================================================
// POST /api/zcc/code-reviewer/apply
//   body: {
//     commentId: string,
//     action: "apply" | "dismiss" | "approve" | "reject",
//     notes?: string  // opcional — apenas para dismiss/reject
//   }
//
// A ação "apply" NÃO escreve no filesystem automaticamente — apenas marca o
// comentário como "applied" no DB. A aplicação física (escrita no arquivo)
// deve ser feita por humano via PR/commit após revisar o diff sugerido.
// Isto é INTENCIONAL — prevenir que LLM automatize mudanças de código sem
// supervisão humana.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { logSink } from '@/lib/cerebro/log-sink';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json() as {
      commentId: string;
      action: 'apply' | 'dismiss' | 'approve' | 'reject';
      notes?: string;
    };

    if (!body.commentId || !body.action) {
      return NextResponse.json(
        { ok: false, error: 'commentId e action são obrigatórios' },
        { status: 400 },
      );
    }

    const comment = await db.codeReviewComment.findUnique({
      where: { id: body.commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { ok: false, error: 'Comentário não encontrado' },
        { status: 404 },
      );
    }

    const token = await getToken({ req: request });
    const reviewerEmail = (token?.email as string) ?? 'unknown';

    let newStatus: string;
    switch (body.action) {
      case 'apply':
        if (!comment.suggestedCode) {
          return NextResponse.json(
            { ok: false, error: 'Comentário não tem código sugerido para aplicar' },
            { status: 400 },
          );
        }
        newStatus = 'applied';
        break;
      case 'dismiss':
        newStatus = 'dismissed';
        break;
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      default:
        return NextResponse.json(
          { ok: false, error: `action inválido: ${body.action}` },
          { status: 400 },
        );
    }

    const updated = await db.codeReviewComment.update({
      where: { id: body.commentId },
      data: {
        status: newStatus,
        reviewedBy: reviewerEmail,
        reviewedAt: new Date(),
        reviewNotes: body.notes ?? null,
      },
    });

    logSink.info({
      module: 'code-reviewer',
      event: `comment_${newStatus}`,
      message: `Comentário ${body.commentId} marcado como ${newStatus} por ${reviewerEmail}`,
      context: {
        commentId: body.commentId,
        action: body.action,
        filePath: comment.filePath,
        reviewerEmail,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logSink.error({
      module: 'code-reviewer',
      event: 'api_apply_failed',
      message: `POST /apply falhou: ${(err as Error).message}`,
    });
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
