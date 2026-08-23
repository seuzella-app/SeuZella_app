// =============================================================================
// /api/zcc/agents — Lista agentes do roster
// =============================================================================
import { NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { listAgents } from '@/lib/zcc/agents/registry';

export async function GET(request: Request) {
  const security = await verifyZCCAccessOrReject(request as any);
  if (!security.allowed) return security.response;

  const agents = listAgents().map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    department: a.department,
    tier: a.tier,
    defaultModel: a.defaultModel,
    icon: a.icon,
    canRespond: !!a.respond,
  }));

  return NextResponse.json({ success: true, data: { agents } });
}
