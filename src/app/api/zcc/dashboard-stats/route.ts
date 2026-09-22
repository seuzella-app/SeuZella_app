import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.dashboard-stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.dashboard-stats', what: 'zcc.dashboard-stats.entry', resource: 'api', result: 'ALLOW' });
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const totalLeads = await db.lead.count();
    const converted = await db.lead.count({ where: { status: 'converted' } });
    const activeCampaigns = await db.campaign.count({ where: { status: 'active' } });
    const totalTargets = await db.target.count();

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads,
        converted,
        conversionRate: totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0',
        activeCampaigns,
        totalTargets,
      },
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    return NextResponse.json({ success: true, stats: { totalLeads: 0, converted: 0, conversionRate: '0', activeCampaigns: 0, totalTargets: 0 } }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  }
}