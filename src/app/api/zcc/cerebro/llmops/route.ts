/**
 * ZCC — LLMOps API
 * ==================
 * GET /api/zcc/cerebro/llmops?days=7
 * Retorna estatísticas de chamadas LLM para a aba LLMOps no ZCC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { CerebroWorkflowEngine } from '@/lib/cerebro/workflow-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
