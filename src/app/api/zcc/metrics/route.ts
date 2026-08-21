import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getAggregates, getActiveTenantIds, getBurnRate, getRevenue } from '@/lib/telemetry-store';

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const [totalClients, totalRooms, totalReservations, totalTransactions] = await Promise.all([
      db.tenant.count(),
      db.room.count(),
      db.reservation.count(),
      db.transaction.findMany({ where: { type: 'PAYMENT', status: 'COMPLETED' }, select: { amount: true } }),
    ]);
    const totalRevenue = totalTransactions.reduce((sum, t) => sum + t.amount, 0);

    const totalMessagesProcessed = await db.guestMessage.count({ where: { from: 'ai' } });
    const occupiedRooms = await db.room.count({ where: { status: 'ocupado' } });
    const avgOccupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const newTenantsThisMonth = await db.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } });
    const monthlyGrowth = totalClients > 0 ? Math.round((newTenantsThisMonth / totalClients) * 100) : 0;

    const allTenants = await db.tenant.findMany({
      select: {
        id: true, plan: true, property: { select: { type: true } },
        airbSubscriptions: { where: { status: 'active' }, select: { amount: true, status: true } },
        subscriptions: { where: { status: 'active' }, select: { amount: true, status: true } },
      },
    });

    const planPricing: Record<string, number> = { trial: 0, starter: 147, pro: 297, business: 597 };
    let mrrPousadas = 0, mrrAirbnb = 0, mrrParceiro = 0;
    for (const tenant of allTenants) {
      const propertyType = tenant.property?.type || 'pousada';
      const isAirbnb = propertyType === 'airbnb' || tenant.airbSubscriptions.length > 0;
      const sub = tenant.subscriptions.find(s => s.status === 'active');
      if (tenant.plan === 'parceiro') mrrParceiro += sub?.amount ?? 97;
      else if (isAirbnb) mrrAirbnb += tenant.airbSubscriptions[0]?.amount ?? 397;
      else mrrPousadas += sub?.amount ?? planPricing[tenant.plan] ?? 0;
    }

    const pousadaTenants = allTenants.filter(t => ['pousada', 'hotel', 'hostel', 'chalé', 'resort'].includes(t.property?.type ?? ''));
    const airbnbTenants = allTenants.filter(t => t.airbSubscriptions.length > 0);
    const parceiroTenants = allTenants.filter(t => t.plan === 'parceiro');

    const [pousadaReservationCounts, airbnbPropertyCounts] = await Promise.all([
      Promise.all(pousadaTenants.map(t => db.reservation.count({ where: { tenantId: t.id } }))),
      Promise.all(airbnbTenants.map(t => db.airBProperty.count({ where: { tenantId: t.id } }))),
    ]);

    const pousadaRevenue = pousadaTenants.reduce((sum, t) => sum + (t.subscriptions.find(s => s.status === 'active')?.amount ?? planPricing[t.plan] ?? 0), 0);
    const anfitrioesRevenue = airbnbTenants.reduce((sum, t) => sum + (t.airbSubscriptions[0]?.amount ?? 397), 0);
    const parceiroMrr = parceiroTenants.reduce((sum, t) => sum + (t.subscriptions.find(s => s.status === 'active')?.amount ?? 97), 0);
    const pousadaReservations = pousadaReservationCounts.reduce((sum, count) => sum + count, 0);
    const anfitrioesProperties = airbnbPropertyCounts.reduce((sum, count) => sum + count, 0);

    const telemetryAggregates = getAggregates();
    const telemetryTenantIds = getActiveTenantIds();
    const telemetryBurnRates = telemetryTenantIds.map(id => getBurnRate(id));
    const telemetryRevenues = telemetryTenantIds.map(id => getRevenue(id));

    const telemetryData = {
      totalMessagesWithTelemetry: totalMessagesProcessed + telemetryAggregates.burnRate.totalMessagesSent,
      telemetryMessagesSent: telemetryAggregates.burnRate.totalMessagesSent,
      telemetryMessagesBundled: telemetryAggregates.burnRate.totalMessagesBundled,
      telemetryRevenue: telemetryAggregates.revenue.totalAmount,
      burnRate: { ...telemetryAggregates.burnRate, perTenant: telemetryBurnRates },
      revenueTelemetry: { totalAmount: telemetryAggregates.revenue.totalAmount, byCurrency: telemetryAggregates.revenue.byCurrency, bySource: telemetryAggregates.revenue.bySource, perTenant: telemetryRevenues },
      eventCounts: telemetryAggregates.eventCounts,
      categoryCounts: telemetryAggregates.categoryCounts,
      activeTelemetryTenants: telemetryTenantIds.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        totalClients, totalRooms, totalReservations, totalRevenue,
        totalMessagesProcessed: telemetryData.totalMessagesWithTelemetry,
        avgOccupancy, monthlyGrowth,
        mrr: { total: mrrPousadas + mrrAirbnb + mrrParceiro, pousadas: mrrPousadas, airbnb: mrrAirbnb, parceiro: mrrParceiro },
        nicheBreakdown: {
          pousadas: { clients: pousadaTenants.length, revenue: pousadaRevenue, reservations: pousadaReservations },
          anfitrioes: { clients: airbnbTenants.length, revenue: anfitrioesRevenue, properties: anfitrioesProperties, superhosts: 0 },
          parceiro: { clients: parceiroTenants.length, mrr: parceiroMrr, referrals: 0 },
        },
        systemStatus: { app: 'operational', postgresql: 'operational', redis: 'unknown', evolutionApi: 'unknown', nginx: 'unknown', bullmq: 'unknown' },
        telemetry: telemetryData,
      },
    }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('[ZCC Metrics] Error:', error);
    return NextResponse.json({ success: false, error: 'ZCC metrics unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}
