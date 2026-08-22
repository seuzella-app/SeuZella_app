import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleCheckoutEvent, markRoomClean, detectCheckoutIntent, generateCheckoutConfirmation } from '@/lib/housekeeping';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';

/**
 * GET /api/ddc/housekeeping — Lista quartos com status de limpeza
 * POST /api/ddc/housekeeping — Registra check-out e dispara limpeza
 * PATCH /api/ddc/housekeeping — Marca quarto como limpo
 *
 * SECURITY FIX (Onda 5A.2):
 *   Previously read tenantId from request body/searchParams (Pattern D —
 *   INSECURE). Now resolves via resolveTenantId() from the NextAuth session.
 *   Clients CANNOT inject another tenant's data.
 */
export async function GET(request: NextRequest) {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    if (db && (db as any).room) {
      const rooms = await (db as any).room.findMany({
        where: { tenantId },
        select: { id: true, name: true, status: true, type: true },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json({ success: true, data: rooms });
    }
    return NextResponse.json({ success: true, data: [], meta: { source: 'fallback' } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    // SECURITY: tenantId always comes from session, NEVER from request body.
    // body.tenantId is ignored on purpose.
    const event = await handleCheckoutEvent({
      tenantId,
      roomId: body.roomId,
      roomName: body.roomName,
      guestName: body.guestName,
      nextCheckInTime: body.nextCheckInTime,
      cleaningTeamPhone: body.cleaningTeamPhone,
    });

    // Publish realtime event AFTER DB write succeeds — Desktop DDC and
    // Mobile DDC subscribed to this tenant receive the update instantly.
    publishTenantEvent(tenantId, 'room:updated', {
      roomId: body.roomId,
      roomName: body.roomName,
      guestName: body.guestName,
      event: 'checkout',
      nextCheckInTime: body.nextCheckInTime,
    });

    return NextResponse.json({ success: true, data: event });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    await markRoomClean({
      tenantId,
      roomId: body.roomId,
      roomName: body.roomName,
    });

    // Publish realtime event AFTER DB write succeeds.
    publishTenantEvent(tenantId, 'room:updated', {
      roomId: body.roomId,
      roomName: body.roomName,
      event: 'cleaned',
    });

    return NextResponse.json({ success: true, message: `Quarto ${body.roomName} marcado como limpo` });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
