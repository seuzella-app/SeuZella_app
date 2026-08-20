import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenant } from '../../../../lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { ZaosYieldEngine } from '@/lib/ai/tools/dynamic-yield-engine';
import { YieldProfitTracker } from '@/lib/ai/tools/yield-profit-tracker';
import { detectBrazilianHighSeasonHoliday } from '@/lib/ai/tools/dynamic-yield-engine';

async function getHandler(_request: NextRequest, _ctx: any) {
  try {
    const tenantId = await requireTenant();

    // Fetch all reservations for this specific Tenant (Pousada)
    const reservations = await prisma.reservation.findMany({
      where: { tenantId },
      include: {
        guest: true,
        room: true,
      },
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

    // ── Carrega contexto do quarto para cálculo de yield ──
    // Busca o quarto + propriedade para ter baseDailyRate e totalRooms
    let baseDailyRate = 0;
    let totalRooms = 0;
    let propertyId: string | null = null;
    let occupiedRooms = 0;

    if (roomId) {
      try {
        const room = await prisma.room.findFirst({
          where: { id: roomId },
          include: { property: true },
        });
        if (room) {
          baseDailyRate = Number(room.price ?? 0);
          propertyId = room.propertyId ?? null;
          if (room.property) {
            // Conta quartos ocupados hoje para calcular ocupação atual
            const total = await prisma.room.count({
              where: { propertyId: room.propertyId },
            });
            totalRooms = total;
            occupiedRooms = await prisma.reservation.count({
              where: {
                checkIn: { lte: new Date() },
                checkOut: { gte: new Date() },
                status: { notIn: ['CANCELLED', 'cancelled', 'NO_SHOW', 'no_show'] },
              },
            });
          }
        }
      } catch (err) {
        // Falha ao carregar quarto NÃO bloqueia a reserva — yield é best-effort
        console.warn('[RESERVATION_CREATE] Não foi possível carregar quarto para yield:', err);
      }
    }

    const targetCheckIn = new Date(checkIn);
    const targetCheckOut = new Date(checkOut);

    if (isNaN(targetCheckIn.getTime()) || isNaN(targetCheckOut.getTime()) || targetCheckIn >= targetCheckOut) {
      return NextResponse.json({ error: 'Datas de check-in e check-out inválidas' }, { status: 400 });
    }

    // ── Execução Atômica via $transaction (Proteção Anti-Double-Booking) ──
    let reservation: any;
    try {
      reservation = await (prisma as any).$transaction(async (tx: any) => {
        if (roomId) {
          const overlapping = await tx.reservation.findFirst({
            where: {
              roomId,
              status: { notIn: ['CANCELLED', 'cancelled', 'NO_SHOW', 'no_show'] },
              AND: [
                { checkIn: { lt: targetCheckOut } },
                { checkOut: { gt: targetCheckIn } },
              ],
            },
          });

          if (overlapping) {
            throw new Error('ROOM_UNAVAILABLE_OVERLAPPING_DATES');
          }
        }

        return await tx.reservation.create({
          data: {
            tenantId,
            guestId,
            roomId,
            checkIn: targetCheckIn,
            checkOut: targetCheckOut,
            totalPrice,
            source: source || 'DIRECT',
          },
        });
      });
    } catch (txErr: any) {
      if (txErr.message === 'ROOM_UNAVAILABLE_OVERLAPPING_DATES') {
        return NextResponse.json(
          {
            error: 'Quarto indisponível para o período solicitado (conflito de reserva concorrente)',
            code: 'ROOM_UNAVAILABLE',
          },
          { status: 409 }
        );
      }
      throw txErr;
    }

    // ── Persiste o lucro extra gerado pelo yield (best-effort, async não bloqueante) ──
    // Para cada noite entre checkIn e checkOut, calcula o yield e registra.
    // Falhas aqui NÃO propagam para a resposta da API — reserva já está criada.
    if (baseDailyRate > 0 && totalRooms > 0) {
      try {
        const nights = computeNights(new Date(checkIn), new Date(checkOut));
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

          // Só persiste se houve lucro extra (NOMINAL não gera registro)
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

/**
 * Computa as noites entre checkIn (inclusive) e checkOut (exclusive).
 * Ex: checkIn=30/12 14h, checkOut=02/01 11h → [30/12, 31/12, 01/01]
 */
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
