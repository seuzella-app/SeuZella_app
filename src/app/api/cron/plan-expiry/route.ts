// ============================================================================
// ZÉLLA — Cron: Plan Expiry Check (Daily 09:00 BRT = 12:00 UTC)
// ============================================================================
// Verifica trials e subscriptions que terminam em 3 dias (warning) ou 24h (urgent).
// Chama bridgePlanExpiring para cada tenant em situação de expiração.
// Schedule Vercel: 0 12 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bridgePlanExpiring } from '@/lib/notifications/bridges';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runCheck(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runCheck(request);
}

async function runCheck(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron:plan-expiry] No auth — running in mock mode');
  }

  let trialAlerts = 0;
  let subscriptionAlerts = 0;

  try {
    const now = new Date();
    const horizon3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ── Trial expiring ──
    const trialTenants = await db.tenant.findMany({
      where: {
        status: 'active',
        trialEnd: { gt: now, lte: horizon3d },
      },
      select: { id: true, name: true, plan: true, trialEnd: true },
    });

    for (const tenant of trialTenants) {
      try {
        const trialEnd = tenant.trialEnd!;
        const msUntilExpiry = trialEnd.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));
        bridgePlanExpiring({
          niche: 'all',
          days: daysUntilExpiry,
          plan: tenant.plan ?? 'gratuito',
          tenantId: tenant.id,
        });
        trialAlerts++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:plan-expiry] bridgePlanExpiring failed for tenant ${tenant.id}:`,
          bridgeErr
        );
      }
    }

    // ── Subscription period ending ──
    const expiringSubscriptions = await db.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { gt: now, lte: horizon3d },
      },
      select: {
        id: true,
        tenantId: true,
        planType: true,
        currentPeriodEnd: true,
      },
    });

    for (const sub of expiringSubscriptions) {
      try {
        const periodEnd = sub.currentPeriodEnd!;
        const msUntilExpiry = periodEnd.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));
        bridgePlanExpiring({
          niche: 'all',
          days: daysUntilExpiry,
          plan: sub.planType ?? 'gratuito',
          tenantId: sub.tenantId,
        });
        subscriptionAlerts++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:plan-expiry] bridgePlanExpiring failed for subscription ${sub.id}:`,
          bridgeErr
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      trialAlerts,
      subscriptionAlerts,
      totalAlerts: trialAlerts + subscriptionAlerts,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${trialAlerts + subscriptionAlerts} alerta(s) de expiração enviados`,
    });
  } catch (error) {
    console.error('[Cron:plan-expiry] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
