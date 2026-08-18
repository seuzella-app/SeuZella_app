// ============================================================================
// ZÉLLA — /api/zcc/ze-code/review
// ============================================================================
// POST: Proxy para o Code Reviewer existente (CodeRabbit-style).
// Reusa 100% do serviço em /api/zcc/code-reviewer/review, mas com namespace
// "ze-code" para auditoria consistente e futuras extensões ZéCode-specific.
//
// Body: igual ao /api/zcc/code-reviewer/review (ReviewRequest)
//   { mode: 'diff' | 'file' | 'directory' | 'hotspot',
//     target: string,
//     maxFiles?: number,
//     forceLive?: boolean,
//     triggeredBy?: string }
//
// Retorna: CodeReviewResult (do reviewer-service)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getCodeReviewer } from '@/lib/cerebro/code-reviewer/reviewer-service';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import type { ReviewRequest } from '@/lib/cerebro/code-reviewer/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = (await request.json()) as Partial<ReviewRequest>;

    if (!body.mode || !body.target) {
      return NextResponse.json(
        { success: false, error: 'mode e target são obrigatórios' },
        { status: 400 },
      );
    }

    const token = await getToken({ req: request });
    const triggeredBy = (token?.email as string | undefined) || 'unknown-admin';

    const req: ReviewRequest = {
      mode: body.mode,
      target: body.target,
      maxFiles: body.maxFiles,
      forceLive: body.forceLive,
      triggeredBy,
      includePatterns: body.includePatterns,
      excludePatterns: body.excludePatterns,
      minSeverity: body.minSeverity,
      profile: body.profile,
    };

    const reviewer = getCodeReviewer();
    const result = await reviewer.review(req);

    logSink.info({
      module: 'ze-code',
      event: 'review-triggered',
      message: `Review completed: ${result.stats.filesReviewed} files, ${result.stats.totalComments} comments, $${result.stats.costUsd.toFixed(4)}`,
      context: {
        ip: security.ip,
        mode: req.mode,
        target: req.target,
        filesReviewed: result.stats.filesReviewed,
        totalComments: result.stats.totalComments,
        costUsd: result.stats.costUsd,
        reviewerMode: result.mode,
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

// GET: lista reviews passadas (query direta no DB, mesmo padrão do /api/zcc/code-reviewer/reviews)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const status = searchParams.get('status') || undefined;

    let reviews: any[] = [];
    let total = 0;

    try {
      if ((db as any)?.codeReview?.findMany) {
        const [dbReviews, dbTotal] = await Promise.all([
          (db as any).codeReview.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          (db as any).codeReview.count({ where }),
        ]);
        reviews = dbReviews;
        total = dbTotal;
      }
    } catch {
      // Fallback gracioso para banco em cold start ou sem migration
    }

    return NextResponse.json({
      success: true,
      data: { reviews, total },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
