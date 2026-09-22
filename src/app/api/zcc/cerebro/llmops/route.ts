/**
 * ZCC — LLMOps API
 * ==================
 * GET /api/zcc/cerebro/llmops?days=7
 * Retorna estatísticas de chamadas LLM para a aba LLMOps no ZCC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { CerebroWorkflowEngine } from '@/lib/cerebro/workflow-engine';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.cerebro.llmops', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.cerebro.llmops', what: 'zcc.cerebro.llmops.entry', resource: 'api', result: 'ALLOW' });
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const sp = request.nextUrl.searchParams;
    const days = parseInt(sp.get('days') ?? '7', 10);
    const stats = await CerebroWorkflowEngine.getLLMOpsStats(days);
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
