// ============================================================================
// ZÉLLA — Cron: Plan Limits Check (Daily 08:00 BRT = 11:00 UTC)
// ============================================================================
// Para cada tenant LITE, chama checkPlanLimits para verificar se
// atingiu 80% (warning) ou 100% (critical) dos limites do plano.
// Schedule Vercel: 0 11 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPlanLimits } from '@/lib/notifications/plan-limits-checker';

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
    console.log('[Cron:plan-limits-check] No auth — running in mock mode');
  }

  let tenantsProcessed = 0;
  let notificationsSent = 0;

  try {
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
        plan: 'lite',
      },
      select: { id: true, name: true, plan: true },
    });

    for (const tenant of tenants) {
      try {
        const result = await checkPlanLimits(tenant.id, tenant.plan ?? 'lite');
        tenantsProcessed++;
        notificationsSent += result.notificationsSent.length;
      } catch (tenantErr) {
        console.error(
          `[Cron:plan-limits-check] Failed for tenant ${tenant.id}:`,
          tenantErr
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tenantsProcessed,
      notificationsSent,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${notificationsSent} notificação(ões) de limite enviadas para ${tenantsProcessed} tenant(s)`,
    });
  } catch (error) {
    console.error('[Cron:plan-limits-check] Error:', error);
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
