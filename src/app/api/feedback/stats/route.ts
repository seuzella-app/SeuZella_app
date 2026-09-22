import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'feedback.stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:feedback.stats', what: 'feedback.stats.entry', resource: 'api', result: 'ALLOW' });
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }

    const feedbacks = await db.feedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    const totalFeedback = feedbacks.length;
    const thumbsUpCount = feedbacks.filter(f => f.rating >= 4).length;
    const thumbsDownCount = feedbacks.filter(f => f.rating <= 2).length;
    
    const satisfactionRate = totalFeedback > 0 
      ? Math.round((thumbsUpCount / totalFeedback) * 100) 
      : 100; // Default to 100% if no feedbacks yet

    // Get the 5 most recent feedbacks with text notes
    const recentFeedbacks = feedbacks
      .filter(f => f.notes && f.notes.trim() !== '')
      .slice(0, 5)
      .map(f => ({
        id: f.id,
        rating: f.rating,
        notes: f.notes,
        createdAt: f.createdAt,
        conversationId: f.conversationId
      }));

    return NextResponse.json({
      success: true,
      stats: {
        totalFeedback,
        thumbsUpCount,
        thumbsDownCount,
        satisfactionRate,
        recentFeedbacks
      }
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[feedback stats GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}