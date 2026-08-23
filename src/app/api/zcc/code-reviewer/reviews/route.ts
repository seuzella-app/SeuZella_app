// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — List Reviews
// ============================================================================
// GET /api/zcc/code-reviewer/reviews
//   ?limit=20      — max 100 (default 20)
//   ?offset=0      — paginação
//   ?status=...    — "running" | "completed" | "failed" | "dismissed"
//   ?mode=...      — "diff" | "file" | "directory" | "hotspot"
//   ?includeComments=true  — incluir comments em cada review
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
    const status = searchParams.get('status');
    const mode = searchParams.get('mode');
    const includeComments = searchParams.get('includeComments') === 'true';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (mode) where.reviewMode = mode;

    const [reviews, total] = await Promise.all([
      db.codeReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: includeComments ? { comments: true } : undefined,
      }),
      db.codeReview.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        reviews: reviews.map((r) => ({
          id: r.id,
          reviewMode: r.reviewMode,
          scope: r.scope,
          highLevelSummary: r.highLevelSummary,
          severity: r.severity,
          stats: JSON.parse(r.stats),
          costUsd: r.costUsd,
          mode: r.mode,
          status: r.status,
          triggeredBy: r.triggeredBy,
          errorMessage: r.errorMessage,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
          comments: includeComments ? (r as { comments?: unknown }).comments : undefined,
        })),
        pagination: { limit, offset, total },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
