import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';

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
  return { start, prevStart };
}

const emptyMetrics = () => ({
  attendedToday: 0, attendedChange: 0,
  bookingsClosed: 0, bookingsChange: 0,
  revenue: 0, revenueChange: 0,
  occupancy: 0, occupancyChange: 0,
  conversion: 0, conversionChange: 0,
  aiScore: 0, aiScoreChange: 0,
  lastUpdated: new Date(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const period = request.nextUrl.searchParams.get('period') || 'today';
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({
        success: true,
        data: emptyMetrics(),
        meta: { period, timestamp: new Date().toISOString(), source: 'database_unavailable', degraded: true },
      });
    }

    const { start, prevStart } = dateRange(period);

    const snapshots = await db.performanceSnapshot.findMany({
      where: { tenantId, date: { gte: start.toISOString().split('T')[0] } },
      orderBy: { date: 'asc' },
    });

    const prevSnapshots = await db.performanceSnapshot.findMany({
      where: { tenantId, date: { gte: prevStart.toISOString().split('T')[0], lt: start.toISOString().split('T')[0] } },
    });

    if (snapshots.length > 0) {
      const sum = (arr: typeof snapshots, field: keyof (typeof snapshots)[number]) =>
        arr.reduce((s, r) => s + (Number(r[field]) || 0), 0);
      const avg = (arr: typeof snapshots, field: keyof (typeof snapshots)[number]) => arr.length > 0 ? sum(arr, field) / arr.length : 0;
      const pctChange = (curr: number, prev: number) => prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : 0;

      const currentConversations = sum(snapshots, 'aiConversations');
      const previousConversations = sum(prevSnapshots, 'aiConversations');
      const currentBookings = sum(snapshots, 'totalBookings');
      const previousBookings = sum(prevSnapshots, 'totalBookings');
      const currentRevenue = sum(snapshots, 'totalRevenue');
      const previousRevenue = sum(prevSnapshots, 'totalRevenue');

      return NextResponse.json({
        success: true,
        data: {
          attendedToday: currentConversations,
          attendedChange: pctChange(currentConversations, previousConversations),
          bookingsClosed: currentBookings,
          bookingsChange: pctChange(currentBookings, previousBookings),
          revenue: currentRevenue,
          revenueChange: pctChange(currentRevenue, previousRevenue),
          occupancy: Number(avg(snapshots, 'occupancyRate').toFixed(1)),
          occupancyChange: Number((avg(snapshots, 'occupancyRate') - avg(prevSnapshots, 'occupancyRate')).toFixed(1)),
          conversion: Number(avg(snapshots, 'conversionRate').toFixed(1)),
          conversionChange: Number((avg(snapshots, 'conversionRate') - avg(prevSnapshots, 'conversionRate')).toFixed(1)),
          aiScore: Number(avg(snapshots, 'aiAutonomy').toFixed(0)),
          aiScoreChange: Number((avg(snapshots, 'aiAutonomy') - avg(prevSnapshots, 'aiAutonomy')).toFixed(0)),
          lastUpdated: new Date(),
        },
        meta: { period, timestamp: new Date().toISOString(), source: 'performance_snapshot' },
      });
    }

    const [bookings, conversations] = await Promise.all([
      db.booking.findMany({ where: { tenantId, createdAt: { gte: start } } }),
      db.conversationLog.findMany({ where: { tenantId, createdAt: { gte: start } } }),
    ]);

    const closedStatuses = ['confirmed', 'checked_in', 'checked_out'];
    const revenueBookings = bookings.filter((booking) => closedStatuses.includes(booking.status));
    const revenue = revenueBookings.reduce((s, b) => s + b.totalValue, 0);
    const prevBookings = await db.booking.findMany({ where: { tenantId, createdAt: { gte: prevStart, lt: start } } });
    const prevRevenue = prevBookings
      .filter((booking) => closedStatuses.includes(booking.status))
      .reduce((s, b) => s + b.totalValue, 0);
    const pctChange = (curr: number, prev: number) => prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : 0;
    const totalRooms = await db.room.count({ where: { property: { tenantId } } });
    const occupancy = totalRooms > 0 ? Number((bookings.filter(b => b.status === 'checked_in').length / totalRooms * 100).toFixed(1)) : 0;
    const closedBookings = revenueBookings.length;
    const conversion = conversations.length > 0 ? Number((closedBookings / conversations.length * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        attendedToday: conversations.length,
        attendedChange: pctChange(conversations.length, prevBookings.length),
        bookingsClosed: closedBookings,
        bookingsChange: pctChange(closedBookings, prevBookings.filter((booking) => closedStatuses.includes(booking.status)).length),
        revenue,
        revenueChange: pctChange(revenue, prevRevenue),
        occupancy,
        occupancyChange: 0,
        conversion,
        conversionChange: 0,
        aiScore: conversations.length > 0 ? Number(conversations.reduce((s, c) => s + c.aiConfidence, 0) / conversations.length) : 0,
        aiScoreChange: 0,
        lastUpdated: new Date(),
      },
      meta: { period, timestamp: new Date().toISOString(), source: 'database' },
    });
  } catch (error) {
    console.error('[DDC metrics] Database error:', error);
    const period = request.nextUrl.searchParams.get('period') || 'today';
    return NextResponse.json({
      success: true,
      data: emptyMetrics(),
      meta: { period, timestamp: new Date().toISOString(), source: 'database_error', degraded: true },
    });
  }
}
