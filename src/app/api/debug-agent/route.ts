import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createError, apiSuccess } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security/api-shield';
import { withAuth, AuthSession } from '@/lib/auth-guard';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * POST /api/debug-agent
 * SECURITY: authenticated and tenant-scoped; api-shield blocks production debug routes.
 */
async function handler(request: NextRequest, session: AuthSession) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'debug-agent', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:debug-agent', what: 'debug-agent.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await request.json();
    const { agentId, startDate, endDate, limit = 50 } = body;

    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1 || limit > 200) {
      return createError(400, 'INVALID_LIMIT', 'limit deve estar entre 1 e 200');
    }

    const where: Record<string, unknown> = { tenantId: session.tenantId };
    if (typeof agentId === 'string' && agentId.length <= 100) where.agentId = agentId;
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        const value = new Date(startDate);
        if (Number.isNaN(value.getTime())) return createError(400, 'INVALID_START_DATE', 'startDate inválida');
        createdAt.gte = value;
      }
      if (endDate) {
        const value = new Date(endDate);
        if (Number.isNaN(value.getTime())) return createError(400, 'INVALID_END_DATE', 'endDate inválida');
        createdAt.lte = value;
      }
      where.createdAt = createdAt;
    }

    const logs = await db.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        tenantId: true,
        agentId: true,
        agentName: true,
        action: true,
        status: true,
        createdAt: true,
        latencyMs: true,
        costUsd: true,
        errorMsg: true,
      },
    });

    const total = logs.length;
    const successCount = logs.filter((l) => l.status === 'success').length;
    const avgLatency = total > 0 ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / total) : 0;
    const totalCost = logs.reduce((s, l) => s + l.costUsd, 0);

    return apiSuccess({
      logs,
      summary: {
        total,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
        avgLatencyMs: avgLatency,
        totalCostUsd: Math.round(totalCost * 10000) / 10000,
      },
    });
  } catch (error) {
    return createError(500, 'DEBUG_AGENT_FAILED', 'Falha ao depurar agente');
  }
}

export const POST = withSecurity(withAuth(handler), { routeLabel: 'debug-agent' });
