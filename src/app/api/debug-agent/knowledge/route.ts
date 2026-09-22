import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createError, apiSuccess } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function handler(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'debug-agent.knowledge', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:debug-agent.knowledge', what: 'debug-agent.knowledge.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await request.json();
    const { query, topK = 10 } = body;

    if (!query || typeof query !== 'string') {
      return createError(400, 'MISSING_QUERY', 'query é obrigatória');
    }

    // SECURITY: Limit query length
    if (query.length > 500) {
      return createError(400, 'QUERY_TOO_LONG', 'Query limitada a 500 caracteres');
    }

    const entries = await db.knowledgeEntry.findMany({
      where: {
        OR: [
          { question: { contains: query, mode: 'insensitive' } as any },
          { answer: { contains: query, mode: 'insensitive' } as any },
        ],
      },
      orderBy: { usage: 'desc' },
      take: Math.min(topK, 50),
    });

    const ranked = entries.map((e) => {
      const qScore = e.question.toLowerCase().includes(query.toLowerCase()) ? 3 : 0;
      const aScore = e.answer.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      return { ...e, score: qScore + aScore + e.effectiveness / 100 };
    }).sort((a, b) => b.score - a.score);

    return apiSuccess({ entries: ranked });
  } catch (error) {
    return createError(
      500,
      'KNOWLEDGE_DEBUG_FAILED',
      'Falha ao depurar conhecimento',
      error instanceof Error ? error.message : undefined
    );
  }
}

export const POST = withSecurity(handler, { routeLabel: 'debug-agent-knowledge' });