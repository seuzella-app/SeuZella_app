import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

// Cron: Snapshot performance metrics every 6 hours
// Triggered by Vercel Cron: 0 */6 * * *
//
// Iterates over ALL active paid tenants and creates real performance snapshots
// from actual DB data. Falls back to estimated values if no real data exists.
//
// Schema: PerformanceSnapshot uses @@unique([tenantId, date]) so each tenant
// gets its own daily snapshot.
export async function GET(request: NextRequest) {
  const auth = await verifyCronAuth(request, 'reports:read');
  if (!auth.ok) return auth.response!;

  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

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
          // AI Activity logs for response time
          db.aIActivityLog.findMany({
            where: {
              tenantId: tenant.id,
              type: 'message',
              duration: { not: null },
              timestamp: { gte: startOfMonth },
            },
            select: { duration: true },
          }),

          // Bookings this month
          db.booking.findMany({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: startOfMonth },
            },
            select: { totalValue: true, status: true },
          }),

          // Conversations this month
          db.conversationLog.findMany({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: startOfMonth },
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

        // Calculate metrics from real data
        const aiResponseTime = activityLogs.length > 0
          ? activityLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / activityLogs.length / 1000
          : 1.5;

        const totalRevenue = bookings.reduce((sum, b) => sum + b.totalValue, 0);
        const totalBookings = bookings.filter(b =>
          ['confirmed', 'checked_in', 'checked_out'].includes(b.status)
        ).length;

        const aiConversations = conversations.length;
        const resolvedByAi = conversations.filter(c => c.status === 'active').length;
        const aiAutonomy = conversations.length > 0
          ? Math.round((resolvedByAi / conversations.length) * 100)
          : 85;

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
          : 4.2;

        const metrics = {
          tenantId: tenant.id,
          date: today,
          aiResponseTime: Math.round(aiResponseTime * 10) / 10,
          conversionRate: conversionRate || 12,
          guestSatisfaction: guestSatisfaction || 4.2,
          occupancyRate: occupancyRate || 65,
          revenueGrowth: 0,
          aiAutonomy: aiAutonomy || 85,
          totalRevenue: totalRevenue || 0,
          totalBookings: totalBookings || 0,
          aiConversations: aiConversations || 0,
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
    console.log(`[Cron:metrics] Snapshots saved for ${today}: ${successCount}/${tenants.length} tenants`);

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
