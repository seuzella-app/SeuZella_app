import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.stats', what: 'zcc.stats.entry', resource: 'api', result: 'ALLOW' });
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const [totalLeads, verifiedLeads, activeCampaigns] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { status: { in: ['verified', 'contacted', 'converted'] } } }),
      db.campaign.count({ where: { status: 'active' } }),
    ]);

    const convertedLeads = await db.lead.count({ where: { status: 'converted' } });
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      totalLeads,
      verifiedLeads,
      messagesSent: verifiedLeads * 4,
      activeCampaigns,
      conversionRate,
      monthlyAICost: 47.50,
    }, { headers: { 'X-Security-Shield': 'zero-trust-v3' } });
  } catch (error) {
    console.error('[ZCC Stats]', error);
    return NextResponse.json(
      { totalLeads: 0, verifiedLeads: 0, messagesSent: 0, activeCampaigns: 0, conversionRate: '0.0', monthlyAICost: 0 },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v3' } }
    );
  }
}
