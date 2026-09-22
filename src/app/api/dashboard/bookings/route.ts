import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(_request: NextRequest, _ctx: any) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_request, 'dashboard.bookings', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:dashboard.bookings', what: 'dashboard.bookings.entry', resource: 'api', result: 'ALLOW' });
  try {
    const bookings = await db.booking.findMany({
      orderBy: { checkIn: 'desc' },
      take: 50,
      include: { guest: true },
    });
    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    return NextResponse.json({ success: true, bookings: [] });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'dashboard-bookings' });