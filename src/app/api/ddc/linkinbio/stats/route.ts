// ============================================================================
// ZÉLLA — GET /api/ddc/linkinbio/stats
// ============================================================================
// Retorna analytics dos últimos 60 dias do Link-in-Bio do tenant.
// Usado para mostrar mensagem motivational no DDC e nas notificações.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { getLinkInBioStats60Days, getLinkInBioStatus } from '@/lib/notifications/linkinbio-addon';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
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
