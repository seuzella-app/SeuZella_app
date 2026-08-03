// =============================================================================
// /api/zcc/agents/[id]/run — Executa um agente específico
// =============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getAgent, runAgent, buildRunContext } from '@/lib/zcc/agents/registry';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response;

  const agentId = params.id;
  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'AGENT_NOT_FOUND', message: `Agente "${agentId}" não existe.` },
      { status: 404 },
    );
  }

  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'NO_TENANT', message: 'Tenant não resolvido na sessão.' },
      { status: 401 },
    );
  }

  const ctx = await buildRunContext(tenantId);
  const run = await runAgent(agentId, ctx);

  return NextResponse.json({ success: true, data: { run, agent: { id: agent.id, name: agent.name } } });
}
