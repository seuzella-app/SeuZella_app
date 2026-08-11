// ============================================================================
// ZÉLLA — Cron: Achievements Check (Daily 00:30 BRT = 03:30 UTC)
// ============================================================================
// Para cada tenant ativo, chama checkAchievements(tenantId) que avalia os
// 5 triggers: first_booking, milestone_10, milestone_100, revenue_record, partner_level_up.
// Schedule Vercel: 30 3 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAchievements, incrementBookingConfirmed } from '@/lib/notifications/achievement-engine';

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
    console.log('[Cron:achievements-check] No auth — running in mock mode');
  }

  let tenantsProcessed = 0;
  let achievementsTriggered = 0;
  const errors: string[] = [];

  try {
    // ── Iterate active tenants ──
    const tenants = await db.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, plan: true },
    });

    for (const tenant of tenants) {
      try {
        // ── Count confirmed bookings for this tenant ──
        const confirmedCount = await db.booking.count({
          where: {
            tenantId: tenant.id,
            status: { in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
          },
        });

        // Update progress tracker (in-memory)
        incrementBookingConfirmed(tenant.id, confirmedCount);

        // ── Run all 5 trigger checks ──
        const result = await checkAchievements(tenant.id);
        tenantsProcessed++;
        achievementsTriggered += result.triggered.length;
        if (result.errors.length > 0) {
          errors.push(`${tenant.id}: ${result.errors.join('; ')}`);
        }
      } catch (tenantErr) {
        console.error(
          `[Cron:achievements-check] Failed for tenant ${tenant.id}:`,
          tenantErr
        );
        errors.push(
          `${tenant.id}: ${tenantErr instanceof Error ? tenantErr.message : 'unknown'}`
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tenantsProcessed,
      achievementsTriggered,
      errors: errors.slice(0, 10),
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${achievementsTriggered} conquista(s) disparada(s) para ${tenantsProcessed} tenant(s)`,
    });
  } catch (error) {
    console.error('[Cron:achievements-check] Error:', error);
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
