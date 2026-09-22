import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenant } from '../../../../lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(_request: NextRequest, _ctx: any) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_request, 'v1.metrics', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:v1.metrics', what: 'v1.metrics.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireTenant();
    
    // Calculate simple metrics for the dashboard
    const now = new Date();
    
    // 1. Total active reservations today
    const activeReservations = await prisma.reservation.count({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lte: now },
        checkOut: { gte: now }
      }
    });

    // 2. Total Rooms
    const totalRooms = await prisma.room.count({
      where: { tenantId }
    });

    // 3. Occupancy Rate
    const occupancyRate = totalRooms > 0 ? (activeReservations / totalRooms) * 100 : 0;

    return NextResponse.json({
      activeReservations,
      totalRooms,
      occupancyRate: Math.round(occupancyRate),
      timestamp: now.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or invalid tenant' }, { status: 401 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'v1-metrics' });