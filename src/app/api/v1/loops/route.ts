import { logger } from '@/lib/infra/logger';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRobotToken } from '../../../../lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
// Import prisma if we need to store loop results in the future
// import prisma from '../../../../../prisma/db';

/**
 * Este endpoint recebe os relatórios gerados pelos Agentes Autônomos (Headroom/Docker)
 * e os processa no banco de dados do Zélla.
 */
async function postHandler(request: NextRequest, _ctx: any) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'v1.loops', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:v1.loops', what: 'v1.loops.entry', resource: 'api', result: 'ALLOW' });
  try {
    // Apenas nossos robôs com o TOKEN secreto podem bater aqui
    if (!verifyRobotToken(request)) {
      return NextResponse.json({ error: 'Unauthorized Robot' }, { status: 401 });
    }

    const body = await request.json();
    const { loopName, tenantId, payload, generatedAt } = body;

    logger.info(`[LOOP RECEIVED] ${loopName} for Tenant ${tenantId} at ${generatedAt}`);
    
    // Aqui podemos injetar a lógica de salvar os insights do robô no banco de dados
    // ex: se loopName == 'competitor_monitor', salva em uma tabela de MarketInsights
    
    // Simulando processamento...
    
    return NextResponse.json({ success: true, message: 'Loop data ingested successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest loop data' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'v1-loops' });