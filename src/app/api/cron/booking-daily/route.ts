// ============================================================================
// ZÉLLA — Cron: Booking Daily Reminders (Daily 06:00 BRT = 09:00 UTC)
// ============================================================================
// Para cada reserva com checkIn === today ou checkOut === today,
// chama bridgeReservationEvent com status 'checkin_today' ou 'checkout_today'.
// Schedule Vercel: 0 9 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bridgeReservationEvent } from '@/lib/notifications/bridges';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runDaily(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runDaily(request);
}

async function runDaily(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron:booking-daily] No auth — running in mock mode');
  }

  let checkinCount = 0;
  let checkoutCount = 0;

  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // ── Reservations with checkIn today ──
    const checkinToday = await db.booking.findMany({
      where: { checkIn: { gte: startOfDay, lt: endOfDay } },
      select: {
        id: true,
        tenantId: true,
        guestName: true,
        roomName: true,
        checkIn: true,
        checkOut: true,
      },
    });

    for (const booking of checkinToday) {
      try {
        bridgeReservationEvent({
          niche: 'pousada',
          bookingId: booking.id,
          guestName: booking.guestName || 'Hóspede',
          roomName: booking.roomName || 'Quarto',
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          status: 'checkin_today',
          tenantId: booking.tenantId,
        });
        checkinCount++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:booking-daily] bridgeReservationEvent checkin_today failed for booking ${booking.id}:`,
          bridgeErr
        );
      }
    }

    // ── Reservations with checkOut today ──
    const checkoutToday = await db.booking.findMany({
      where: { checkOut: { gte: startOfDay, lt: endOfDay } },
      select: {
        id: true,
        tenantId: true,
        guestName: true,
        roomName: true,
        checkIn: true,
        checkOut: true,
      },
    });

    for (const booking of checkoutToday) {
      try {
        bridgeReservationEvent({
          niche: 'pousada',
          bookingId: booking.id,
          guestName: booking.guestName || 'Hóspede',
          roomName: booking.roomName || 'Quarto',
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          status: 'checkout_today',
          tenantId: booking.tenantId,
        });
        checkoutCount++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:booking-daily] bridgeReservationEvent checkout_today failed for booking ${booking.id}:`,
          bridgeErr
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      checkinToday: checkinCount,
      checkoutToday: checkoutCount,
      totalProcessed: checkinCount + checkoutCount,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${checkinCount} check-in(s) e ${checkoutCount} check-out(s) notificado(s)`,
    });
  } catch (error) {
    console.error('[Cron:booking-daily] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
