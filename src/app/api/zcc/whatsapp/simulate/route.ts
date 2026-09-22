import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const COST_PER_MESSAGE_USD = 0.0068;
const USD_TO_BRL = 5.15;

export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.whatsapp.simulate', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.whatsapp.simulate', what: 'zcc.whatsapp.simulate.entry', resource: 'api', result: 'ALLOW' });
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {

    const body = await request.json();
    const { tenantId, direction, intent, oneShot } = body as {
      tenantId: string;
      direction: 'inbound' | 'outbound';
      intent?: string;
      oneShot?: boolean;
    };

    if (!tenantId || !direction) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, direction' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plan: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Only outbound service messages incur costs
    const costUsd = direction === 'outbound' ? COST_PER_MESSAGE_USD : 0;
    const costBrl = direction === 'outbound' ? COST_PER_MESSAGE_USD * USD_TO_BRL : 0;

    // Create WhatsAppMessageCost record
    const costRecord = await db.whatsAppMessageCost.create({
      data: {
        tenantId,
        direction,
        costUsd,
        costBrl: Math.round(costBrl * 10000) / 10000,
        aiGenerated: direction === 'outbound',
        intent: intent || null,
        oneShot: oneShot === true,
        messageTemplate: oneShot ? 'one_shot_resolution' : (direction === 'outbound' ? 'service_reply' : null),
      },
    });

    // ── Compute updated tenant cost summary ──────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentCosts = await db.whatsAppMessageCost.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const totalCostMonth = recentCosts.reduce((sum, c) => sum + c.costUsd, 0);
    const totalMessagesMonth = recentCosts.length;
    const outboundMonth = recentCosts.filter(c => c.direction === 'outbound').length;
    const oneShotsMonth = recentCosts.filter(c => c.oneShot).length;

    const costSummary = {
      tenantId,
      totalCostMonth: Math.round(totalCostMonth * 10000) / 10000,
      totalMessagesMonth,
      outboundMonth,
      oneShotsMonth,
      oneShotRate: totalMessagesMonth > 0 ? Math.round((oneShotsMonth / totalMessagesMonth) * 100) : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        costRecord,
        costSummary,
      },
    });
  } catch (error) {
    console.error('[ZCC WhatsApp Simulate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
