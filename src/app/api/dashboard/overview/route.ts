import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(_request: NextRequest, _ctx: any) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_request, 'dashboard.overview', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:dashboard.overview', what: 'dashboard.overview.entry', resource: 'api', result: 'ALLOW' });
  try {
    const totalTenants = await db.tenant.count();
    const activeTenants = await db.tenant.count({ where: { status: 'active' } });
    const totalGuests = await db.guest.count();
    const totalBookings = await db.booking.count();
    const activeSubscriptions = await db.subscription.count({ where: { status: 'active' } });

    return NextResponse.json({
      success: true,
      overview: {
        totalTenants,
        activeTenants,
        totalGuests,
        totalBookings,
        activeSubscriptions,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: true, overview: { totalTenants: 0, activeTenants: 0, totalGuests: 0, totalBookings: 0, activeSubscriptions: 0 } });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'dashboard-overview' });