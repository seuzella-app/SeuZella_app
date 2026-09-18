import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { verifyRobotToken } from '@/lib/auth';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// RUN 6 — autoridade de escrita global: POST registra feedback de circuito
// (abre/fecha circuit breaker, altera estatísticas do bandit) para a
// PLATAFORMA INTEIRA. Sem gate, qualquer chamador podia derrubar a IA de
// todos os tenants com 5 falhas forjadas. Escrita exige token de máquina
// (loop interno) OU administrador ZCC. GET permanece para o dashboard.

async function getHandler(_request: NextRequest, _ctx: any) {
  try {
    const providers = await db.routerProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(
      providers.map((p) => ({
        ...p,
        lastFailureAt: p.lastFailureAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[ROUTER_PROVIDERS_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar providers' },
      { status: 500 }
    );
  }
}

async function postHandler(request: NextRequest, _ctx: any) {
  try {
    const robotOk = await verifyRobotToken(request);
    if (!robotOk) {
      const zcc = await verifyZCCAccessOrReject(request);
      if (!zcc.allowed) return zcc.response!;
    }
    const body = await request.json();
    const { providerId, success, latencyMs } = body;

    if (!providerId || success === undefined || latencyMs === undefined) {
      return NextResponse.json(
        { error: 'Campos "providerId", "success" e "latencyMs" são obrigatórios' },
        { status: 400 }
      );
    }

    const provider = await db.routerProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider não encontrado' },
        { status: 404 }
      );
    }

    const newAlpha = provider.alpha + (success ? 1 : 0);
    const newBeta = provider.beta + (success ? 0 : 1);
    const newSuccessCount = provider.successCount + (success ? 1 : 0);
    const newFailureCount = provider.failureCount + (success ? 0 : 1);

    const totalCalls = newSuccessCount + newFailureCount;
    const newAvgLatency =
      (provider.avgLatencyMs * (totalCalls - 1) + latencyMs) / totalCalls;

    const updated = await db.routerProvider.update({
      where: { id: providerId },
      data: {
        alpha: newAlpha,
        beta: newBeta,
        successCount: newSuccessCount,
        failureCount: newFailureCount,
        avgLatencyMs: Math.round(newAvgLatency),
        circuitStatus: success
          ? provider.circuitStatus === 'open'
            ? 'half_open'
            : 'closed'
          : newFailureCount >= 5
            ? 'open'
            : 'half_open',
        lastFailureAt: success
          ? provider.lastFailureAt
          : new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      lastFailureAt: updated.lastFailureAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[ROUTER_PROVIDERS_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao registrar feedback do provider' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'router-providers' });
export const POST = withSecurity(postHandler, { routeLabel: 'router-providers' });