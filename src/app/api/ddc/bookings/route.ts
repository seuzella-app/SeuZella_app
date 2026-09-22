import { NextRequest, NextResponse } from 'next/server';
import { emitTenantEvent, buildPushForEvent } from '@/lib/realtime/emit-tenant-event';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId, mapBooking } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';
import { bridgeReservationEvent } from '@/lib/notifications/bridges';
import { withAdvisoryLock } from '@/lib/db/concurrency';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.bookings', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.bookings', what: 'ddc.bookings.entry', resource: 'api', result: 'ALLOW' });
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // FASE 02B (FRENTE 10/55): DB indisponível = lista vazia honesta + flag
      // (antes retornava demoBookings — reservas fictícias R$700/1500/500).
      return NextResponse.json({ success: true, data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 }, meta: { source: 'database_unavailable', degraded: true } });
    }
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const guestId = searchParams.get('guestId');
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status === 'completed' ? { in: ['checked_in', 'checked_out'] } : status;
    if (guestId) where.guestId = guestId;
    const bookings = await db.booking.findMany({ where, include: { guest: { select: { id: true, name: true, phone: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: { items: bookings.map(mapBooking), total: bookings.length, page: 1, limit: bookings.length, totalPages: 1 } });
  } catch (error) {
    console.error('[DDC bookings] Prisma error:', error);
    return NextResponse.json({ success: true, data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json();
    if (!body.guestId || !body.checkIn || !body.checkOut || body.total === undefined || body.total === null) return NextResponse.json({ success: false, error: { code: '400', message: 'Missing required fields' } }, { status: 400 });
    const total = Number(body.total);
    if (!Number.isFinite(total) || total < 0) return NextResponse.json({ success: false, error: { code: 'INVALID_TOTAL', message: 'Valor total da reserva inválido.' } }, { status: 400 });
    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) return NextResponse.json({ success: false, error: { code: 'INVALID_DATES', message: 'Data de check-out deve ser posterior ao check-in' } }, { status: 400 });

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const targetRoom = body.roomId || body.roomName || '';
    const lockKey = `booking:${tenantId}:${String(body.roomId || targetRoom || 'unassigned')}`;

    const transactionResult = await withAdvisoryLock(lockKey, async (tx) => {
      const overlapConditions: Array<{ roomId?: string; roomName?: string }> = [];
      if (body.roomId) overlapConditions.push({ roomId: body.roomId });
      if (targetRoom) overlapConditions.push({ roomName: targetRoom });
      if (overlapConditions.length > 0) {
        const overlap = await tx.booking.findFirst({ where: { tenantId, status: { notIn: ['cancelled', 'canceled', 'rejected'] }, OR: overlapConditions, AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }] } });
        if (overlap) return { conflict: true, message: 'Quarto indisponível para o período selecionado. Conflito de reserva existente.' };
      }

      const newBooking = await tx.booking.create({
        data: { tenantId, guestId: body.guestId, guestName: body.guestName || '', roomName: targetRoom, roomId: body.roomId || undefined, checkIn, checkOut, nights, guests: body.guests || 1, totalValue: total, status: body.status || 'pending', paymentMethod: body.paymentMethod || 'pix', paymentStatus: body.paymentStatus || 'pending', source: body.source || 'whatsapp_ai' },
      });

      // RULE_A is a financial ledger obligation: booking and commission commit atomically.
      if (body.specialDateId || body.isSpecialDate) {
        const { calculateUpsell } = await import('@/lib/billing/upsell-calculator');
        const baseRate = Number(body.baseRate ?? total / nights);
        const specialRate = total / nights;
        const upsellCalc = calculateUpsell({ baseRate, specialRate, nights, attributedToZehla: body.source === 'whatsapp_ai' || body.attributedToZehla === true, isSpecialDate: true });
        if (upsellCalc.upsellDue && upsellCalc.upsellAmount > 0) {
          await tx.upsellRecord.create({
            data: { tenantId, roomId: body.roomId || null, reservationId: newBooking.id, guestId: body.guestId || null, type: 'special_date_tariff', description: 'Tarifa especial em data comemorativa aprovada pelo anfitrião', quantity: nights, unitPrice: roundCurrency(specialRate), totalPrice: upsellCalc.reservationValue, comissionRate: upsellCalc.commissionRate, comissionAmount: upsellCalc.upsellAmount, status: 'confirmed', suggestedByZehla: true, notes: upsellCalc.reason },
          });
        }
      }
      return { conflict: false, booking: newBooking };
    });

    if (transactionResult.conflict || !transactionResult.booking) return NextResponse.json({ success: false, error: { code: 'DOUBLE_BOOKING_CONFLICT', message: transactionResult.message || 'Conflito de reserva detectado.' } }, { status: 409 });
    const { booking } = transactionResult;

    try {
      bridgeReservationEvent({ niche: 'pousada', bookingId: booking.id, guestName: body.guestName || 'Hóspede', roomName: body.roomId || body.roomName || 'Quarto', checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString(), status: 'created', tenantId });
    } catch (notifErr) {
      console.error('[DDC bookings POST] notification bridge error:', notifErr);
    }
    const reservationPayload = { bookingId: booking.id, guestId: booking.guestId, guestName: booking.guestName, roomName: booking.roomName, checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString(), total: booking.totalValue, status: booking.status };
    void emitTenantEvent(tenantId, 'reservation:created', reservationPayload, buildPushForEvent('reservation:created', reservationPayload));
    return NextResponse.json({ success: true, data: mapBooking(booking) }, { status: 201 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code;
    if (errCode === '23P01' || errCode === 'P2002' || errMessage.includes('booking_no_overlap') || errMessage.includes('exclusion constraint') || errMessage.includes('conflicting key value violates exclusion constraint')) return NextResponse.json({ success: false, error: { code: 'DOUBLE_BOOKING_CONFLICT', message: 'Quarto indisponível para o período selecionado. Conflito de reserva existente.' } }, { status: 409 });
    console.error('[DDC bookings POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: '500', message: 'Failed to create booking' } }, { status: 500 });
  }
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
