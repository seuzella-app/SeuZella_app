// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — Trigger Review
// ============================================================================
// POST /api/zcc/code-reviewer/review
//
// Body:
//  {
//    mode: "diff" | "file" | "directory" | "hotspot",
//    target: string,
//    includePatterns?: string[],
//    excludePatterns?: string[],
//    maxFiles?: number (default 10, max 30),
//    minSeverity?: "info" | "warning" | "critical" | "emergency",
//    profile?: "assertive" | "gentle",
//    forceLive?: boolean (requer ZCC_GODMODE_TOKEN)
//  }
//
// Auth: verifyZCCAccessOrReject (6-layer ZCC security)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getCodeReviewer } from '@/lib/cerebro/code-reviewer/reviewer-service';
import type { ReviewRequest } from '@/lib/cerebro/code-reviewer/types';
import { logSink } from '@/lib/cerebro/log-sink';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json() as Partial<ReviewRequest>;

    // Captura email do admin da sessão NextAuth
    const token = await getToken({ req: request });
    const triggeredBy = token?.email as string | undefined;

    const reviewRequest: ReviewRequest = {
      mode: body.mode ?? 'file',
      target: body.target ?? '',
      includePatterns: body.includePatterns,
      excludePatterns: body.excludePatterns,
      maxFiles: body.maxFiles,
      minSeverity: body.minSeverity,
      profile: body.profile,
      forceLive: body.forceLive,
      triggeredBy,
    };

    const reviewer = getCodeReviewer();
    const result = await reviewer.review(reviewRequest);

    return NextResponse.json({
      ok: true,
      data: {
        reviewId: result.reviewId,
        highLevelSummary: result.highLevelSummary,
        severity: result.severity,
        mode: result.mode,
        stats: result.stats,
        comments: result.comments,
      },
    });
  } catch (err) {
    logSink.error({
      module: 'code-reviewer',
      event: 'api_review_failed',
      message: `POST /review falhou: ${(err as Error).message}`,
      context: { errorStack: (err as Error).stack },
    });
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
