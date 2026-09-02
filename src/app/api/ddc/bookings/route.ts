import { NextRequest, NextResponse } from 'next/server';
import { recordLatency } from '@/lib/observability/latency-tracker';
import { emitTenantEvent, buildPushForEvent } from '@/lib/realtime/emit-tenant-event';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId, mapBooking } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';
// Notification bridge — Phase 2: pushes reservation events into DDC
import { bridgeReservationEvent } from '@/lib/notifications/bridges';

const demoBookings = [
  {
    id: 'demo-bk-1',
    guestId: 'demo-g-1',
    roomId: 'Suíte Vista Mar',
    checkIn: new Date(Date.now() + 86400000).toISOString(),
    checkOut: new Date(Date.now() + 3 * 86400000).toISOString(),
    total: 700.00,
    status: 'confirmed' as const,
    paymentStatus: 'paid' as const,
    propertyId: 'demo',
    guest: { id: 'demo-g-1', name: 'Carlos Mendes', phone: '5541988776655' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-bk-2',
    guestId: 'demo-g-2',
    roomId: 'Chalé Jardim',
    checkIn: new Date(Date.now() + 2 * 86400000).toISOString(),
    checkOut: new Date(Date.now() + 5 * 86400000).toISOString(),
    total: 1500.00,
    status: 'confirmed' as const,
    paymentStatus: 'paid' as const,
    propertyId: 'demo',
    guest: { id: 'demo-g-2', name: 'Maria Silva', phone: '5511977665544' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-bk-3',
    guestId: 'demo-g-3',
    roomId: 'Suíte Standard',
    checkIn: new Date(Date.now() + 5 * 86400000).toISOString(),
    checkOut: new Date(Date.now() + 7 * 86400000).toISOString(),
    total: 500.00,
    status: 'pending' as const,
    paymentStatus: 'pending' as const,
    propertyId: 'demo',
    guest: { id: 'demo-g-3', name: 'João Santos', phone: '5521966554433' },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const _latencyStart = Date.now();
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({
        success: true,
        data: { items: demoBookings, total: demoBookings.length, page: 1, limit: demoBookings.length, totalPages: 1 },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const {searchParams} = request.nextUrl;
    const status = searchParams.get('status');
    const guestId = searchParams.get('guestId');

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status === 'completed' ? { in: ['checked_in', 'checked_out'] } : status;
    if (guestId) where.guestId = guestId;

    const bookings = await db.booking.findMany({
      where,
      include: { guest: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: { items: bookings.map(mapBooking), total: bookings.length, page: 1, limit: bookings.length, totalPages: 1 }
    });
  } catch (error) {
    console.error('[DDC bookings] Prisma error:', error);
    return NextResponse.json({ success: true, data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 } });
  }
}

export async function POST(request: NextRequest) {
  const _latencyStart = Date.now();
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json();
    if (!body.guestId || !body.checkIn || !body.checkOut || !body.total) {
      return NextResponse.json({ success: false, error: { code: '400', message: 'Missing required fields' } }, { status: 400 });
    }
    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'Data de check-out deve ser posterior ao check-in' } },
        { status: 400 }
      );
    }

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const targetRoom = body.roomId || body.roomName || '';

    const transactionResult = await db.$transaction(async (tx) => {
      // 🔒 Anti Double Booking Overlap Enforcement
      const overlapConditions: Array<{ roomId?: string; roomName?: string }> = [];
      if (body.roomId) overlapConditions.push({ roomId: body.roomId });
      if (targetRoom) overlapConditions.push({ roomName: targetRoom });

      if (overlapConditions.length > 0) {
        const overlap = await tx.booking.findFirst({
          where: {
            tenantId,
            status: { notIn: ['cancelled', 'canceled', 'rejected'] },
            OR: overlapConditions,
            AND: [
              { checkIn: { lt: checkOut } },
              { checkOut: { gt: checkIn } },
            ],
          },
        });

        if (overlap) {
          return {
            conflict: true,
            message: 'Quarto indisponível para o período selecionado. Conflito de reserva existente.',
          };
        }
      }

      const newBooking = await tx.booking.create({
        data: {
          tenantId,
          guestId: body.guestId,
          guestName: body.guestName || '',
          roomName: targetRoom,
          roomId: body.roomId || undefined,
          checkIn,
          checkOut,
          nights,
          guests: body.guests || 1,
          totalValue: body.total,
          status: body.status || 'pending',
          paymentMethod: body.paymentMethod || 'pix',
          paymentStatus: body.paymentStatus || 'pending',
          source: body.source || 'whatsapp_ai',
        },
      });

      // R3: Create UpsellRecord if this is a special date reservation (RULE_A)
      if (body.specialDateId || body.isSpecialDate) {
        try {
          const { calculateUpsell } = await import('@/lib/billing/upsell-calculator');
          const baseRate = body.baseRate || body.total / nights;
          const specialRate = body.total / nights;
          const upsellCalc = calculateUpsell({
            baseRate,
            specialRate,
            nights,
            attributedToZehla: body.source === 'whatsapp_ai' || body.attributedToZehla === true,
            isSpecialDate: true,
          });

          if (upsellCalc.upsellDue && upsellCalc.upsellAmount > 0) {
            await (tx as any).upsellRecord.create({
              data: {
                tenantId,
                roomId: body.roomId || null,
                reservationId: newBooking.id,
                guestId: body.guestId || null,
                type: 'special_date_tariff',
                description: 'Tarifa especial em data comemorativa aprovada pelo anfitrião',
                quantity: nights,
                unitPrice: Math.round(specialRate * 100) / 100,
                totalPrice: upsellCalc.reservationValue,
                comissionRate: upsellCalc.commissionRate,
                comissionAmount: upsellCalc.upsellAmount,
                status: 'confirmed',
                suggestedByZehla: true,
                notes: upsellCalc.reason,
              },
            });
          }
        } catch {
          // UpsellRecord creation failure does not block booking
        }
      }

      return { conflict: false, booking: newBooking };
    });

    if (transactionResult.conflict || !transactionResult.booking) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DOUBLE_BOOKING_CONFLICT',
            message: transactionResult.message || 'Conflito de reserva detectado.',
          },
        },
        { status: 409 }
      );
    }

    const { booking } = transactionResult;

    // ── Notification bridge: notify owner about new reservation ──
    try {
      bridgeReservationEvent({
        niche: 'pousada',
        bookingId: booking.id,
        guestName: body.guestName || 'Hóspede',
        roomName: body.roomId || body.roomName || 'Quarto',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        status: 'created',
        tenantId,
      });
    } catch (notifErr) {
      console.error('[DDC bookings POST] notification bridge error:', notifErr);
    }

    const reservationPayload = {
      bookingId: booking.id,
      guestId: booking.guestId,
      guestName: booking.guestName,
      roomName: booking.roomName,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      total: booking.totalValue,
      status: booking.status,
    };
    void emitTenantEvent(
      tenantId,
      'reservation:created',
      reservationPayload,
      buildPushForEvent('reservation:created', reservationPayload),
    );

    return NextResponse.json({ success: true, data: mapBooking(booking) }, { status: 201 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code;

    // Mapeamento estrito de violação de exclusão PostgreSQL (23P01), Prisma (P2002/P2010) ou constraint booking_no_overlap
    if (
      errCode === '23P01' ||
      errCode === 'P2002' ||
      errMessage.includes('booking_no_overlap') ||
      errMessage.includes('exclusion constraint') ||
      errMessage.includes('conflicting key value violates exclusion constraint')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DOUBLE_BOOKING_CONFLICT',
            message: 'Quarto indisponível para o período selecionado. Conflito de reserva existente.',
          },
        },
        { status: 409 }
      );
    }

    console.error('[DDC bookings POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: '500', message: 'Failed to create booking' } }, { status: 500 });
  }
}
