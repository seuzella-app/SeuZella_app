import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenantId } from '@/lib/security/tenant-context';
import { withSecurity, type SecurityContext } from '@/lib/security/api-shield';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_RESERVATIONS = 20;

/**
 * Canonical read boundary for the Mobile DDC.
 * Mobile and Desktop consume the same tenant-scoped domain data; the client
 * never supplies an authoritative tenant id.
 */
async function handler(_request: NextRequest, _ctx: SecurityContext) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const now = new Date();
    const [tenant, reservations] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, niche: true, plan: true, domain: true },
      }),
      prisma.reservation.findMany({
        where: {
          tenantId,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          checkOut: { gt: now },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          totalPrice: true,
          source: true,
          guest: { select: { id: true, name: true, phone: true } },
          room: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: 'asc' },
        take: MAX_RESERVATIONS,
      }),
    ]);

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'TENANT_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenant,
          reservations: reservations.map((reservation) => ({
            id: reservation.id,
            guest: reservation.guest,
            room: reservation.room,
            checkIn: reservation.checkIn.toISOString(),
            checkOut: reservation.checkOut.toISOString(),
            status: reservation.status,
            totalPrice: reservation.totalPrice,
            source: reservation.source,
          })),
          generatedAt: new Date().toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  } catch (error) {
    console.error('[DDC_MOBILE_STATE] failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'MOBILE_STATE_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET(request: NextRequest) {
  return withSecurity(request, handler);
}
