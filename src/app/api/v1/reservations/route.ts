import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenant } from '../../../../lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { assertResourceBelongsToTenant } from '@/lib/security/resource-authorization';
import { ZaosYieldEngine, detectBrazilianHighSeasonHoliday } from '@/lib/ai/tools/dynamic-yield-engine';
import { YieldProfitTracker } from '@/lib/ai/tools/yield-profit-tracker';
import { withAdvisoryLock, mapConcurrencyError } from '@/lib/db/concurrency';
import { SpecialDatesHitlService } from '@/lib/ai/special-dates/hitl-service';
import { calculateUpsell } from '@/lib/billing/upsell-calculator';
import { linkReservationToMetaAttribution } from '@/lib/meta/meta-attribution';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(_request: NextRequest, _ctx: any) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_request, 'v1.reservations', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:v1.reservations', what: 'v1.reservations.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireTenant();
    const reservations = await prisma.reservation.findMany({ where: { tenantId }, include: { guest: true, room: true }, orderBy: { checkIn: 'asc' } });
    return NextResponse.json(reservations);
  } catch {
    return NextResponse.json({ error: 'Unauthorized or invalid tenant' }, { status: 401 });
  }
}

async function postHandler(request: NextRequest, _ctx: any) {
  try {
    const tenantId = await requireTenant();
    const body = await request.json();
    const { guestId, roomId, checkIn, checkOut, totalPrice, source } = body;

    if (guestId !== undefined && guestId !== null && typeof guestId !== 'string') return NextResponse.json({ error: 'guestId inválido' }, { status: 400 });
    if (roomId !== undefined && roomId !== null && typeof roomId !== 'string') return NextResponse.json({ error: 'roomId inválido' }, { status: 400 });
    if (totalPrice !== undefined && totalPrice !== null && (!Number.isFinite(Number(totalPrice)) || Number(totalPrice) < 0)) return NextResponse.json({ error: 'totalPrice inválido' }, { status: 400 });
    if (source !== undefined && source !== null && (typeof source !== 'string' || source.length > 64)) return NextResponse.json({ error: 'source inválido' }, { status: 400 });

    const targetCheckIn = new Date(checkIn);
    const targetCheckOut = new Date(checkOut);
    if (isNaN(targetCheckIn.getTime()) || isNaN(targetCheckOut.getTime()) || targetCheckIn >= targetCheckOut) {
      return NextResponse.json({ error: 'Datas de check-in e check-out inválidas' }, { status: 400 });
    }

    let baseDailyRate = 0;
    let totalRooms = 0;
    let propertyId: string | null = null;
    let occupiedRooms = 0;

    if (roomId) {
      try {
        const room = await prisma.room.findFirst({ where: { id: roomId, tenantId }, include: { property: true } });
        if (room) {
          assertResourceBelongsToTenant({ resource: room, tenantId, resourceName: 'Room' });
          baseDailyRate = Number(room.price ?? 0);
          propertyId = room.propertyId ?? null;
          totalRooms = await prisma.room.count({ where: { propertyId: room.propertyId, tenantId } });
          occupiedRooms = await prisma.reservation.count({ where: { tenantId, roomId, checkIn: { lte: new Date() }, checkOut: { gte: new Date() }, status: { notIn: ['CANCELLED', 'cancelled', 'REJECTED', 'rejected', 'NO_SHOW', 'no_show'] } } });
        }
      } catch (err) {
        console.warn('[RESERVATION_CREATE] Não foi possível carregar contexto de yield:', err);
      }
    }

    let reservation: any;
    const lockKey = `reservation:${tenantId}:${roomId || 'general'}`;
    try {
      reservation = await withAdvisoryLock(lockKey, async (tx: any) => {
        if (roomId) {
          const ownedRoom = await tx.room.findFirst({ where: { id: roomId, tenantId } });
          if (!ownedRoom) throw new Error('ROOM_NOT_FOUND_OR_NOT_OWNED');
          assertResourceBelongsToTenant({ resource: ownedRoom, tenantId, resourceName: 'Room' });

          const overlapping = await tx.reservation.findFirst({
            where: { tenantId, roomId, status: { notIn: ['CANCELLED', 'cancelled', 'REJECTED', 'rejected', 'NO_SHOW', 'no_show'] }, AND: [{ checkIn: { lt: targetCheckOut } }, { checkOut: { gt: targetCheckIn } }] },
          });
          if (overlapping) throw new Error('ROOM_UNAVAILABLE_OVERLAPPING_DATES');

          // ── RBW Fase E: consistência Booking × Reservation ──────────────────
          // Domínios distintos por design: Reservation = reserva operacional
          // (pagamento/PIN/check-in); Booking = estadia importada de canais
          // externos (iCal/OTA, externalUid). Uma MESMA estadia não pode existir
          // como Booking ativo E Reservation CONFIRMED ao mesmo tempo — aqui
          // a criação operacional respeita as estadias já importadas dos canais.
          const overlappingExternal = await tx.booking.findFirst({
            where: {
              tenantId,
              roomId,
              status: { in: ['confirmed', 'checked_in', 'blocked'] },
              AND: [{ checkIn: { lt: targetCheckOut } }, { checkOut: { gt: targetCheckIn } }],
            },
          });
          if (overlappingExternal) throw new Error('ROOM_UNAVAILABLE_EXTERNAL_BOOKING');
        }

        if (guestId) {
          const ownedGuest = await tx.guest.findFirst({ where: { id: guestId, tenantId } });
          if (!ownedGuest) throw new Error('GUEST_NOT_FOUND_OR_NOT_OWNED');
          assertResourceBelongsToTenant({ resource: ownedGuest, tenantId, resourceName: 'Guest' });
        }

        const nights = computeNights(targetCheckIn, targetCheckOut).length;
        const numericTotalPrice = totalPrice === undefined || totalPrice === null ? baseDailyRate * nights : Number(totalPrice);
        if (!Number.isFinite(numericTotalPrice) || numericTotalPrice < 0) throw new Error('INVALID_TOTAL_PRICE');

        // ── RBW Fase F: semântica do status na criação (política EXISTENTE,
        // documentada — não inventada): reserva criada direto pelo OPERADOR do
        // tenant (venda telefônica/balcão/whatsapp) nasce CONFIRMED sem
        // cobrança — pagamento NÃO é obrigatório neste caminho. No caminho do
        // HÓSPEDE (reservation_payments), CONFIRMED é consequência do pagamento
        // aprovado (process-reservation-webhook), e refund/cancel reverte para
        // REFUNDED/CANCELLED. Manipular status por fora destes dois caminhos
        // permanece proibido.
        return tx.reservation.create({ data: { tenantId, guestId, roomId, checkIn: targetCheckIn, checkOut: targetCheckOut, totalPrice: numericTotalPrice, source: source || 'DIRECT', status: 'CONFIRMED' } });
      });
    } catch (txErr: any) {
      const mapped = mapConcurrencyError(txErr);
      if (mapped) return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
      if (txErr?.message === 'INVALID_TOTAL_PRICE') return NextResponse.json({ error: 'Preço total inválido' }, { status: 400 });
      if (txErr?.message === 'ROOM_NOT_FOUND_OR_NOT_OWNED' || txErr?.message === 'GUEST_NOT_FOUND_OR_NOT_OWNED') return NextResponse.json({ error: 'Recurso não encontrado ou não pertence ao tenant' }, { status: 403 });
      if (txErr?.message === 'ROOM_UNAVAILABLE_EXTERNAL_BOOKING') return NextResponse.json({ error: 'Quarto indisponível: já existe estadia de canal externo (iCal/OTA) no período', code: 'ROOM_UNAVAILABLE_EXTERNAL_BOOKING' }, { status: 409 });
      throw txErr;
    }

    try {
      const nights = computeNights(targetCheckIn, targetCheckOut);
      let hasSpecialDate = false;
      let totalEffectiveSpecialRate = 0;
      for (const night of nights) {
        const activePrice = await SpecialDatesHitlService.getActivePriceForDate(tenantId, roomId || 'all', night, baseDailyRate);
        if (activePrice.isSpecialDate) { hasSpecialDate = true; totalEffectiveSpecialRate += activePrice.price; } else totalEffectiveSpecialRate += baseDailyRate;
      }
      if (hasSpecialDate && nights.length > 0) {
        const avgSpecialRate = totalEffectiveSpecialRate / nights.length;
        const upsellCalc = calculateUpsell({ baseRate: baseDailyRate, specialRate: avgSpecialRate, nights: nights.length, attributedToZehla: true, isSpecialDate: true });
        if (upsellCalc.upsellDue && upsellCalc.upsellAmount > 0) {
          await (prisma as any).upsellRecord.create({ data: { tenantId, roomId, reservationId: reservation.id, guestId, type: 'special_date_tariff', description: 'Tarifa especial em data comemorativa aprovada pelo anfitrião', quantity: nights.length, unitPrice: avgSpecialRate, totalPrice: upsellCalc.reservationValue, comissionRate: upsellCalc.commissionRate, comissionAmount: upsellCalc.upsellAmount, status: 'confirmed', suggestedByZehla: true, notes: upsellCalc.reason } });
        }
      }
    } catch (upsellErr) {
      console.warn('[RESERVATION_CREATE] Special date / upsell tracking error (reservation persisted):', upsellErr);
    }

    if (baseDailyRate > 0 && totalRooms > 0) {
      try {
        for (const night of computeNights(targetCheckIn, targetCheckOut)) {
          const holiday = detectBrazilianHighSeasonHoliday(night);
          const yieldResult = ZaosYieldEngine.calculateYieldPrice({ baseDailyRate, totalRooms, occupiedRooms: Math.min(occupiedRooms, totalRooms), targetDate: night, isSpecialHoliday: holiday !== null, holidayName: holiday ?? undefined });
          if (yieldResult.extraProfitGenerated > 0) await YieldProfitTracker.recordYield({ tenantId, propertyId, reservationId: reservation.id, roomId, targetDate: night, baseRate: baseDailyRate, yield: yieldResult, isSpecialHoliday: holiday !== null, holidayName: holiday });
        }
      } catch (yieldErr) {
        console.warn('[RESERVATION_CREATE] Yield tracking falhou (reserva OK):', yieldErr);
      }
    }

    // FIX (auditoria Meta Foundation — FASE 7): fecha a cadeia
    // CONVERSA → LEAD (Guest) → RESERVA → RECEITA atribuível. Se o hóspede veio
    // de Click-to-WhatsApp (referral comprovado e vigente), a reserva é linkada
    // ao MetaAttributionEvent — sem inferência, sem quebrar a criação.
    try {
      if (guestId && reservation?.id) {
        const guestForAttr = await prisma.guest.findUnique({
          where: { id: guestId },
          select: { phone: true },
        });
        if (guestForAttr?.phone) {
          const linked = await linkReservationToMetaAttribution({
            tenantId,
            guestPhone: guestForAttr.phone,
            reservationId: reservation.id,
            reservationValue: Number(reservation.totalPrice ?? 0) || null,
          });
          if (linked) console.log('[RESERVATION_CREATE] Meta attribution linked:', reservation.id);
        }
      }
    } catch (attrErr) {
      console.warn('[RESERVATION_CREATE] Meta attribution link failed (reservation persisted):', attrErr);
    }

    return NextResponse.json(reservation, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

function computeNights(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(checkIn); cursor.setHours(0, 0, 0, 0);
  const end = new Date(checkOut); end.setHours(0, 0, 0, 0);
  while (cursor < end) { nights.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
  return nights;
}

export const GET = withSecurity(getHandler, { routeLabel: 'v1-reservations' });
export const POST = withSecurity(postHandler, { routeLabel: 'v1-reservations' });
