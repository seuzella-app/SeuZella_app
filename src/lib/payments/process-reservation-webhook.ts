import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { activateReservationAccess, createReservationPaymentConfirmationNotification } from './reservation-payment-effects';
import type { WebhookEvent } from './types';

export async function processReservationPaymentWebhookEvent(event: WebhookEvent): Promise<{ deduplicated: boolean; reservationId: string }> {
  const reservationId = event.referenceId || event.subscriptionId || '';
  if (!event.providerEventId) throw new Error('RESERVATION_PAYMENT_EVENT_ID_MISSING');
  if (!reservationId) throw new Error('RESERVATION_PAYMENT_REFERENCE_ID_MISSING');

  const result = await db.$transaction(async (tx) => {
    const lockKey = `reservation-payment-event:${event.gateway}:${event.providerEventId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const duplicate = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "reservation_payments"
      WHERE "gateway" = ${event.gateway}
        AND "provider_event_id" = ${event.providerEventId}
      LIMIT 1
    `;
    if (duplicate[0]) return { deduplicated: true, reservationId, tenantId: '', guestName: '', guestPhone: '', checkIn: new Date(0), checkOut: new Date(0), newlyApproved: false };

    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        tenantId: true,
        checkIn: true,
        checkOut: true,
        guest: { select: { name: true, phone: true } },
      },
    });
    if (!reservation) throw new Error('RESERVATION_NOT_FOUND');

    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "reservation_payments"
      WHERE "reservation_id" = ${reservation.id}
        AND "gateway" = ${event.gateway}
        AND "gateway_payment_id" = ${event.gatewayPaymentId}
      ORDER BY "created_at" DESC
      LIMIT 1
    `;

    const existing = rows[0];
    if (!existing) {
      const paymentId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "reservation_payments"
          ("id", "tenant_id", "reservation_id", "gateway", "gateway_payment_id", "provider_event_id", "reference_type", "amount", "payment_method", "status", "metadata")
        VALUES
          (${paymentId}, ${reservation.tenantId}, ${reservation.id}, ${event.gateway}, ${event.gatewayPaymentId}, ${event.providerEventId}, 'reservation', ${event.amount ?? 0}, ${event.gateway}, ${event.status}, ${JSON.stringify({ event: event.event, raw: event.raw })})
      `;
    } else {
      await tx.$executeRaw`
        UPDATE "reservation_payments"
        SET "provider_event_id" = ${event.providerEventId},
            "status" = ${event.status},
            "metadata" = ${JSON.stringify({ event: event.event, raw: event.raw })},
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${existing.id}
      `;
    }

    const newlyApproved = event.status === 'approved' && (!existing || existing.status !== 'approved');
    if (newlyApproved) {
      await tx.transaction.create({
        data: {
          tenantId: reservation.tenantId,
          reservationId: reservation.id,
          type: `RESERVATION_PAYMENT:${event.gateway}`,
          amount: event.amount ?? 0,
          method: event.gateway,
          status: 'COMPLETED',
        },
      });
    }

    return {
      deduplicated: false,
      reservationId: reservation.id,
      tenantId: reservation.tenantId,
      guestName: reservation.guest.name,
      guestPhone: reservation.guest.phone ?? '',
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      newlyApproved,
    };
  });

  if (!result.deduplicated && result.newlyApproved) {
    try {
      await createReservationPaymentConfirmationNotification({
        tenantId: result.tenantId,
        reservationId: result.reservationId,
        guestName: result.guestName,
        amount: event.amount ?? 0,
        gateway: event.gateway,
      });
    } catch (notificationError) {
      console.error('[RESERVATION_PAYMENT] confirmation notification failed:', notificationError);
    }

    try {
      await activateReservationAccess({
        tenantId: result.tenantId,
        reservationId: result.reservationId,
        guestName: result.guestName,
        guestPhone: result.guestPhone || undefined,
        checkIn: result.checkIn,
        checkOut: result.checkOut,
      });
    } catch (accessError) {
      console.error('[RESERVATION_PAYMENT] lock access automation failed:', accessError);
    }
  }

  return { deduplicated: result.deduplicated, reservationId: result.reservationId };
}
