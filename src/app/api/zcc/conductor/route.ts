// =============================================================================
// /api/zcc/conductor — Roteia mensagem para o agente certo via LLM
// =============================================================================
// Body: { message: string }
// Response: { routedTo, agentName, text, model, tokensIn, tokensOut, durationMs }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { routeConductor, buildRunContext } from '@/lib/zcc/agents/registry';
import { getAgent } from '@/lib/zcc/agents/registry';

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response;

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_BODY', message: 'JSON inválido.' },
      { status: 400 },
    );
  }

  const message = body.message?.trim();
  if (!message || message.length < 2) {
    return NextResponse.json(
      { success: false, error: 'EMPTY_MESSAGE', message: 'Mensagem muito curta.' },
      { status: 400 },
    );
  }

  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'NO_TENANT', message: 'Tenant não resolvido.' },
      { status: 401 },
    );
  }

  const ctx = await buildRunContext(tenantId);
  const result = await routeConductor(message, ctx);

  // Extrai agentId do summary "[→ AgentName] ..." se presente
  const routedMatch = result.summary.match(/^\[→ ([^\]]+)\]/);
  const routedAgentName = routedMatch?.[1] ?? 'conductor';
  const routedToId = 'conductor';

  return NextResponse.json({
    success: true,
    data: {
      routedTo: routedToId,
      agentName: routedAgentName,
      text: result.summary.replace(/^\[→ [^\]]+\]\s*/, ''),
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: result.durationMs,
    },
  });
}
