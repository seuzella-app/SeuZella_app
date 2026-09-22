// ============================================================================
// ZÉLLA — GET /api/ddc/linkinbio/stats
// ============================================================================
// Retorna analytics dos últimos 60 dias do Link-in-Bio do tenant.
// Usado para mostrar mensagem motivational no DDC e nas notificações.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { getLinkInBioStats60Days, getLinkInBioStatus } from '@/lib/notifications/linkinbio-addon';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_req, 'ddc.linkinbio.stats', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.linkinbio.stats', what: 'ddc.linkinbio.stats.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireDDCTenantId();
    const [stats, status] = await Promise.all([
      getLinkInBioStats60Days(tenantId),
      getLinkInBioStatus(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      status: {
        planTier: status.planTier,
        status: status.status,
        startDate: status.startDate?.toISOString() ?? null,
        expiryDate: status.expiryDate?.toISOString() ?? null,
        daysRemaining: status.daysRemaining === Infinity ? 'unlimited' : status.daysRemaining,
        addonPurchased: status.addonPurchased,
        addonPriceBrl: status.addonPriceBrl,
        message: status.message,
      },
      stats: {
        totalClicks: stats.totalClicks,
        uniqueVisitors: stats.uniqueVisitors,
        bookingsViaLinkInBio: stats.bookingsViaLinkInBio,
        revenueViaLinkInBio: stats.revenueViaLinkInBio,
        conversionRate: Number(stats.conversionRate.toFixed(2)),
        avgClicksPerDay: stats.avgClicksPerDay,
        topPerformingLink: stats.topPerformingLink,
        motivationalMessage: stats.motivationalMessage,
      },
      period: '60_days',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[GET /api/ddc/linkinbio/stats]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
