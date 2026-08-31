import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenant } from '../../../../lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { ZaosYieldEngine } from '@/lib/ai/tools/dynamic-yield-engine';
import { YieldProfitTracker } from '@/lib/ai/tools/yield-profit-tracker';
import { detectBrazilianHighSeasonHoliday } from '@/lib/ai/tools/dynamic-yield-engine';

import { withAdvisoryLock, mapConcurrencyError } from '@/lib/db/concurrency';

async function getHandler(_request: NextRequest, _ctx: any) {
  try {
    const tenantId = await requireTenant();
    const reservations = await prisma.reservation.findMany({
      where: { tenantId },
      include: { guest: true, room: true },
      orderBy: { checkIn: 'asc' },
    });
    return NextResponse.json(reservations);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or invalid tenant' }, { status: 401 });
  }
}

async function postHandler(request: NextRequest, _ctx: any) {
  try {
    const tenantId = await requireTenant();
    const body = await request.json();
    const { guestId, roomId, checkIn, checkOut, totalPrice, source } = body;

    const targetCheckIn = new Date(checkIn);
    const targetCheckOut = new Date(checkOut);
    if (isNaN(targetCheckIn.getTime()) || isNaN(targetCheckOut.getTime()) || targetCheckIn >= targetCheckOut) {
      return NextResponse.json({ error: 'Datas de check-in e check-out inválidas' }, { status: 400 });
    }

    let baseDailyRate = 0;
    let totalRooms = 0;
    let propertyId: string | null = null;
    let occupiedRooms = 0;

    // Read-only pricing context is tenant-scoped. Never use a room selected only by ID.
    if (roomId) {
      try {
        const room = await prisma.room.findFirst({
          where: { id: roomId, tenantId },
          include: { property: true },
        });
        if (room) {
          baseDailyRate = Number(room.price ?? 0);
          propertyId = room.propertyId ?? null;
          const total = await prisma.room.count({ where: { propertyId: room.propertyId, tenantId } });
          totalRooms = total;
          occupiedRooms = await prisma.reservation.count({
            where: {
              tenantId,
              roomId,
              checkIn: { lte: new Date() },
              checkOut: { gte: new Date() },
              status: { notIn: ['CANCELLED', 'cancelled', 'REJECTED', 'rejected', 'NO_SHOW', 'no_show'] },
            },
          });
        }
      } catch (err) {
        console.warn('[RESERVATION_CREATE] Não foi possível carregar contexto de yield:', err);
      }
    }

    // DB transaction with Advisory Lock is the final authority for tenant ownership and overlap prevention.
    let reservation: any;
    const lockKey = `reservation:${tenantId}:${roomId || 'general'}`;
    try {
      reservation = await withAdvisoryLock(lockKey, async (tx: any) => {
        if (roomId) {
          const ownedRoom = await tx.room.findFirst({ where: { id: roomId, tenantId } });
          if (!ownedRoom) throw new Error('ROOM_NOT_FOUND_OR_NOT_OWNED');

          const overlapping = await tx.reservation.findFirst({
            where: {
              tenantId,
              roomId,
              status: { notIn: ['CANCELLED', 'cancelled', 'REJECTED', 'rejected', 'NO_SHOW', 'no_show'] },
              AND: [
                { checkIn: { lt: targetCheckOut } },
                { checkOut: { gt: targetCheckIn } },
              ],
            },
          });
          if (overlapping) throw new Error('ROOM_UNAVAILABLE_OVERLAPPING_DATES');
        }

        if (guestId) {
          const ownedGuest = await tx.guest.findFirst({ where: { id: guestId, tenantId } });
          if (!ownedGuest) throw new Error('GUEST_NOT_FOUND_OR_NOT_OWNED');
        }

        return tx.reservation.create({
          data: {
            tenantId,
            guestId,
            roomId,
            checkIn: targetCheckIn,
            checkOut: targetCheckOut,
            totalPrice,
            source: source || 'DIRECT',
            status: 'CONFIRMED',
          },
        });
      });
    } catch (txErr: any) {
      const mapped = mapConcurrencyError(txErr);
      if (mapped) {
        return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
      }
      throw txErr;
    }

    if (baseDailyRate > 0 && totalRooms > 0) {
      try {
        const nights = computeNights(targetCheckIn, targetCheckOut);
        for (const night of nights) {
          const holiday = detectBrazilianHighSeasonHoliday(night);
          const yieldResult = ZaosYieldEngine.calculateYieldPrice({
            baseDailyRate,
            totalRooms,
            occupiedRooms: Math.min(occupiedRooms, totalRooms),
            targetDate: night,
            isSpecialHoliday: holiday !== null,
            holidayName: holiday ?? undefined,
          });
          if (yieldResult.extraProfitGenerated > 0) {
            await YieldProfitTracker.recordYield({
              tenantId,
              propertyId,
              reservationId: reservation.id,
              roomId,
              targetDate: night,
              baseRate: baseDailyRate,
              yield: yieldResult,
              isSpecialHoliday: holiday !== null,
              holidayName: holiday,
            });
          }
        }
      } catch (yieldErr) {
        console.warn('[RESERVATION_CREATE] Yield tracking falhou (reserva OK):', yieldErr);
      }
    }

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

function computeNights(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(checkIn);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

export const GET = withSecurity(getHandler, { routeLabel: 'v1-reservations' });
export const POST = withSecurity(postHandler, { routeLabel: 'v1-reservations' });
