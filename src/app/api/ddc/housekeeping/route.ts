import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleCheckoutEvent, markRoomClean, detectCheckoutIntent, generateCheckoutConfirmation } from '@/lib/housekeeping';

/**
 * GET /api/ddc/housekeeping?tenantId=xxx — Lista quartos com status de limpeza
 * POST /api/ddc/housekeeping — Registra check-out e dispara limpeza
 * PATCH /api/ddc/housekeeping — Marca quarto como limpo
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ success: false, error: 'MISSING_TENANT' }, { status: 400 });

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
  try {
    const body = await request.json();
    const event = await handleCheckoutEvent({
      tenantId: body.tenantId,
      roomId: body.roomId,
      roomName: body.roomName,
      guestName: body.guestName,
      nextCheckInTime: body.nextCheckInTime,
      cleaningTeamPhone: body.cleaningTeamPhone,
    });
    return NextResponse.json({ success: true, data: event });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    await markRoomClean({ tenantId: body.tenantId, roomId: body.roomId, roomName: body.roomName });
    return NextResponse.json({ success: true, message: `Quarto ${body.roomName} marcado como limpo` });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
