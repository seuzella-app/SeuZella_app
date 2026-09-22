import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

function dateRange(period: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let prevStart: Date;

  if (period === 'week') {
    start = new Date(today); start.setDate(start.getDate() - 7);
    prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(today); start.setDate(start.getDate() - 30);
    prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 30);
  } else {
    start = today;
    prevStart = new Date(today); prevStart.setDate(prevStart.getDate() - 1);
  }
  return { start, prevStart, today };
}

const emptyMetrics = (period: string) => ({
  attendedToday: 0, attendedChange: 0,
  bookingsClosed: 0, bookingsChange: 0,
  revenue: 0, revenueChange: 0,
  occupancy: 0, occupancyChange: 0,
  conversion: 0, conversionChange: 0,
  aiScore: 0, aiScoreChange: 0,
  lastUpdated: new Date()
});

// Estados semânticos de fonte (FASE 02B — FRENTE 12):
//   source: 'database'             → dados reais via tabelas cruas
//   source: 'snapshot'             → dados reais via PerformanceSnapshot
//   source: 'database_unavailable' → DB indisponível: ZEROS honestos + degraded
//   source: 'fallback-zeros'       → erro de runtime: ZEROS honestos
// NUNCA retorna métricas fabricadas (demo) com aparência de dado real.

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.metrics', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.metrics', what: 'ddc.metrics.entry', resource: 'api', result: 'ALLOW' });
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // FASE 02B (FRENTE 10/12): DB indisponível = zeros honestos + flag.
      // Removeu o gerador de demo com receita fabricada (12.450/87.230/345.670).
      const period = request.nextUrl.searchParams.get('period') || 'today';
      return NextResponse.json({
        success: true,
        data: emptyMetrics(period),
        meta: { period, timestamp: new Date().toISOString(), source: 'database_unavailable', degraded: true },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const period = request.nextUrl.searchParams.get('period') || 'today';
    const { start, prevStart } = dateRange(period);

    // Try PerformanceSnapshots first
    const snapshots = await db.performanceSnapshot.findMany({
      where: { tenantId, date: { gte: start.toISOString().split('T')[0] } },
      orderBy: { date: 'asc' },
    });

    const prevSnapshots = await db.performanceSnapshot.findMany({
      where: { tenantId, date: { gte: prevStart.toISOString().split('T')[0], lt: start.toISOString().split('T')[0] } },
    });

    if (snapshots.length > 0) {
      const sum = (arr: any[], field: string) => arr.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
      const avg = (arr: any[], field: string) => arr.length > 0 ? sum(arr, field) / arr.length : 0;

      const prevSum = (field: string) => sum(prevSnapshots, field);
      const prevAvg = (field: string) => avg(prevSnapshots, field);
      const pctChange = (curr: number, prev: number) => prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : 0;

      return NextResponse.json({
        success: true,
        data: {
          attendedToday: snapshots.reduce((s, r) => s + r.aiConversations, 0),
          attendedChange: pctChange(
            snapshots.reduce((s, r) => s + r.aiConversations, 0),
            prevSnapshots.reduce((s, r) => s + r.aiConversations, 0)
          ),
          bookingsClosed: snapshots.reduce((s, r) => s + r.totalBookings, 0),
          bookingsChange: pctChange(
            snapshots.reduce((s, r) => s + r.totalBookings, 0),
            prevSnapshots.reduce((s, r) => s + r.totalBookings, 0)
          ),
          revenue: sum(snapshots, 'totalRevenue'),
          revenueChange: pctChange(sum(snapshots, 'totalRevenue'), prevSum('totalRevenue')),
          occupancy: Number(avg(snapshots, 'occupancyRate').toFixed(1)),
          occupancyChange: Number((avg(snapshots, 'occupancyRate') - prevAvg('occupancyRate')).toFixed(1)),
          conversion: Number(avg(snapshots, 'conversionRate').toFixed(1)),
          conversionChange: Number((avg(snapshots, 'conversionRate') - prevAvg('conversionRate')).toFixed(1)),
          aiScore: Number(avg(snapshots, 'aiAutonomy').toFixed(0)),
          aiScoreChange: Number((avg(snapshots, 'aiAutonomy') - prevAvg('aiAutonomy')).toFixed(0)),
          lastUpdated: new Date()
        },
        meta: { period, timestamp: new Date().toISOString(), source: 'snapshot' }
      });
    }

    // Fallback: calculate from raw tables
    const [bookings, conversations, activityLogs, allBookings, prevConversations] = await Promise.all([
      db.booking.findMany({ where: { tenantId, createdAt: { gte: start } } }),
      db.conversationLog.findMany({ where: { tenantId, createdAt: { gte: start } } }),
      db.aIActivityLog.findMany({ where: { tenantId, timestamp: { gte: start }, type: 'message' } }),
      db.booking.findMany({ where: { tenantId } }),
      db.conversationLog.findMany({ where: { tenantId, createdAt: { gte: prevStart, lt: start } } }),
    ]);

    // FASE 02B (FRENTE 11/14): receita soma APENAS status de receita real.
    // pending/cancelled/refunded não são receita (divergência objetiva eliminada).
    const isRevenueStatus = (status: string) => ['confirmed', 'checked_in', 'checked_out'].includes(status);
    const revenue = bookings.filter(b => isRevenueStatus(b.status)).reduce((s, b) => s + b.totalValue, 0);
    const prevBookings = await db.booking.findMany({ where: { tenantId, createdAt: { gte: prevStart, lt: start } } });
    const prevRevenue = prevBookings.filter(b => isRevenueStatus(b.status)).reduce((s, b) => s + b.totalValue, 0);
    const pctChange = (curr: number, prev: number) => prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : 0;
    const totalRooms = await db.room.count({ where: { property: { tenantId } } });
    const occupancy = totalRooms > 0 ? Number((bookings.filter(b => b.status === 'checked_in').length / totalRooms * 100).toFixed(1)) : 0;
    const avgResponse = activityLogs.length > 0 ? activityLogs.reduce((s, l) => s + (l.duration || 0), 0) / activityLogs.length / 1000 : 0;

    return NextResponse.json({
      success: true,
      data: {
        attendedToday: conversations.length,
        // FIX: comparar conversas com conversas do período anterior
        // (antes comparava conversas com BOOKINGS do período anterior).
        attendedChange: pctChange(conversations.length, prevConversations.length),
        bookingsClosed: bookings.filter(b => ['confirmed', 'checked_in', 'checked_out'].includes(b.status)).length,
        bookingsChange: pctChange(bookings.length, prevBookings.length),
        revenue,
        revenueChange: pctChange(revenue, prevRevenue),
        occupancy,
        occupancyChange: 0,
        conversion: allBookings.length > 0 ? Number((bookings.filter(b => ['confirmed', 'checked_in'].includes(b.status)).length / conversations.length * 100).toFixed(1)) : 0,
        conversionChange: 0,
        aiScore: conversations.length > 0 ? Number(conversations.reduce((s, c) => s + c.aiConfidence, 0) / conversations.length) : 0,
        aiScoreChange: 0,
        lastUpdated: new Date()
      },
      meta: { period, timestamp: new Date().toISOString(), source: 'database' }
    });
  } catch (error) {
    console.error('[DDC metrics] Prisma error, returning zeros:', error);
    const period = request.nextUrl.searchParams.get('period') || 'today';
    return NextResponse.json({
      success: true,
      data: emptyMetrics(period),
      meta: { period, timestamp: new Date().toISOString(), source: 'fallback-zeros' }
    });
  }
}
