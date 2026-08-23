// ============================================================================
// ZÉLLA — Cron: Subscription Renewal Reminder (Daily 09:00 BRT = 12:00 UTC)
// ============================================================================
// Verifica subscriptions que terminam em 3 dias (warning) ou 24h (urgent).
// Dispara bridgePlanExpiring para o dono saber que precisa renovar.
//
// Schedule Vercel: 0 12 * * *
//
// NOTA: O Seu Zélla NÃO tem mais trial gratuito. Apenas assinaturas pagas.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bridgePlanExpiring } from '@/lib/notifications/bridges';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

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
    // Auth unificada: M2M EdDSA JWT primeiro, fallback CRON_SECRET
  const auth = await verifyCronAuth(request, 'billing:read');
  if (!auth.ok) return auth.response!;

  let subscriptionAlerts = 0;

  try {
    const now = new Date();
    const horizon3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ── Subscription period ending (renovação de mensalidade) ──
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
          plan: sub.planType ?? 'lite',
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
      subscriptionAlerts,
      totalAlerts: subscriptionAlerts,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${subscriptionAlerts} alerta(s) de renovação enviados`,
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
