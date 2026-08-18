// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — Get/Patch Review by ID
// ============================================================================
// GET    /api/zcc/code-reviewer/reviews/[id]            — detalhes + comments
// PATCH  /api/zcc/code-reviewer/reviews/[id]             — dismiss review
//   body: { action: "dismiss", notes?: string }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { id } = await context.params;
    const review = await db.codeReview.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: [
            { filePath: 'asc' },
            { startLine: 'asc' },
          ],
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { ok: false, error: 'Review não encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: review.id,
        reviewMode: review.reviewMode,
        scope: review.scope,
        highLevelSummary: review.highLevelSummary,
        severity: review.severity,
        stats: JSON.parse(review.stats),
        costUsd: review.costUsd,
        mode: review.mode,
        status: review.status,
        triggeredBy: review.triggeredBy,
        errorMessage: review.errorMessage,
        createdAt: review.createdAt,
        completedAt: review.completedAt,
        comments: review.comments,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { id } = await context.params;
    const body = await request.json() as { action: string; notes?: string };

    if (body.action !== 'dismiss') {
      return NextResponse.json(
        { ok: false, error: 'action deve ser "dismiss"' },
        { status: 400 },
      );
    }

    const token = await getToken({ req: request });
    const reviewerEmail = (token?.email as string) ?? 'unknown';
    void reviewerEmail; // audit future use

    const updated = await db.codeReview.update({
      where: { id },
      data: { status: 'dismissed' },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
