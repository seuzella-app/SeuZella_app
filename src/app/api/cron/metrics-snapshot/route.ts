import { logger } from '@/lib/infra/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

// Cron: Snapshot performance metrics (daily, executed by Vercel Cron 0 6 * * *)
//
// Semântica dos snapshots: INCREMENTO DIÁRIO (janela = hoje, 00:00 → agora).
// Cada linha PerformanceSnapshot representa o dia dela — NUNCA um acumulado
// month-to-date. Consumidores (ex.: /api/ddc/metrics) SOMAM os dias para obter
// totais semanais/mensais; somar linhas cumulativas multiplicaria a receita
// (P0 corrigido na FASE 02B: snapshot MTD somado N×).
//
// Honestidade de dados: NENHUM valor padrão fabricado. Métrica sem dados
// reais = 0 (FASE 02B — removeu 12 / 4.2 / 65 / 85 / 1.5 sintéticos).
//
// Receita: apenas reservas em status de receita real
// (confirmed/checked_in/checked_out) — pending/cancelled NÃO são receita.

const REVENUE_BOOKING_STATUSES = ['confirmed', 'checked_in', 'checked_out'] as const;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export async function GET(request: NextRequest) {
  const auth = await verifyCronAuth(request, 'reports:read');
  if (!auth.ok) return auth.response!;

  try {
    const today = new Date().toISOString().split('T')[0];
    // Janela DIÁRIA (incremento do dia) — não month-to-date (ver header).
    const windowStart = startOfToday();

    // Find ALL active paid tenants (not just the first one)
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
        plan: { not: 'gratuito' },
      },
      select: { id: true, name: true },
    });

    if (tenants.length === 0) {
      return NextResponse.json({ ok: true, message: 'No active tenants found', date: today });
    }

    const results: Array<{ tenantId: string; tenantName: string; success: boolean }> = [];

    // Process each tenant independently (one failure doesn't stop others)
    for (const tenant of tenants) {
      try {
        // ── Gather real metrics for this tenant ──
        const [activityLogs, bookings, conversations, totalRooms] = await Promise.all([
          // AI Activity logs for response time (today only — daily increment)
          db.aIActivityLog.findMany({
            where: {
              tenantId: tenant.id,
              type: 'message',
              duration: { not: null },
              timestamp: { gte: windowStart },
            },
            select: { duration: true },
          }),

          // Bookings created today (daily increment)
          db.booking.findMany({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: windowStart },
            },
            select: { totalValue: true, status: true },
          }),

          // Conversations started today (daily increment)
          db.conversationLog.findMany({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: windowStart },
            },
            select: { aiConfidence: true, status: true },
          }),

          // Total rooms for occupancy calculation
          db.room.count({
            where: {
              property: { tenantId: tenant.id },
            },
          }),
        ]);

        // Calculate metrics from real data — SEM defaults fabricados
        const aiResponseTime = activityLogs.length > 0
          ? activityLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / activityLogs.length / 1000
          : 0;

        // Receita = apenas reservas em status de receita real (pending/cancelled
        // NÃO são receita — corrige inflação persistida, FASE 02B P1-6/P2 do cron).
        const totalRevenue = bookings
          .filter(b => (REVENUE_BOOKING_STATUSES as readonly string[]).includes(b.status))
          .reduce((sum, b) => sum + b.totalValue, 0);
        const totalBookings = bookings.filter(b =>
          (REVENUE_BOOKING_STATUSES as readonly string[]).includes(b.status)
        ).length;

        const aiConversations = conversations.length;
        const resolvedByAi = conversations.filter(c => c.status === 'active').length;
        const aiAutonomy = conversations.length > 0
          ? Math.round((resolvedByAi / conversations.length) * 100)
          : 0;

        const conversionRate = conversations.length > 0 && totalBookings > 0
          ? Math.round((totalBookings / conversations.length) * 100 * 10) / 10
          : 0;

        const occupancyRate = totalRooms > 0
          ? Math.round((bookings.filter(b => b.status === 'checked_in').length / totalRooms) * 100 * 10) / 10
          : 0;

        const avgConfidence = conversations.length > 0
          ? conversations.reduce((sum, c) => sum + (c.aiConfidence || 0), 0) / conversations.length
          : 0;

        const guestSatisfaction = avgConfidence > 0
          ? Math.round(Math.min(5, (avgConfidence / 100) * 5) * 10) / 10
          : 0;

        const metrics = {
          tenantId: tenant.id,
          date: today,
          aiResponseTime: Math.round(aiResponseTime * 10) / 10,
          // FASE 02B: sem defaults sintéticos — sem dados reais = 0 (honesto).
          conversionRate,
          guestSatisfaction,
          occupancyRate,
          revenueGrowth: 0,
          aiAutonomy,
          totalRevenue,
          totalBookings,
          aiConversations,
        };

        await db.performanceSnapshot.upsert({
          where: { tenantId_date: { tenantId: tenant.id, date: today } },
          create: metrics,
          update: metrics,
        });

        results.push({ tenantId: tenant.id, tenantName: tenant.name, success: true });
      } catch (tenantError) {
        console.error(`[Cron:metrics] Error for tenant ${tenant.id}:`, tenantError);
        results.push({ tenantId: tenant.id, tenantName: tenant.name, success: false });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`[Cron:metrics] Snapshots saved for ${today}: ${successCount}/${tenants.length} tenants`);

    return NextResponse.json({
      ok: true,
      message: `Metrics snapshots saved: ${successCount}/${tenants.length} tenants`,
      date: today,
      results,
    });
  } catch (error) {
    console.error('[Cron:metrics] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Metrics snapshot failed' },
      { status: 500 }
    );
  }
}
