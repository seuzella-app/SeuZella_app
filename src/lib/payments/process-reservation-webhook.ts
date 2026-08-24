import { db } from '@/lib/db';
import type { WebhookEvent } from './types';

export async function processReservationPaymentWebhookEvent(event: WebhookEvent): Promise<{ deduplicated: boolean; reservationId: string }> {
  const reservationId = event.referenceId || event.subscriptionId || '';
  if (!event.providerEventId) throw new Error('RESERVATION_PAYMENT_EVENT_ID_MISSING');
  if (!reservationId) throw new Error('RESERVATION_PAYMENT_REFERENCE_ID_MISSING');

  return db.$transaction(async (tx) => {
    const lockKey = `reservation-payment-event:${event.gateway}:${event.providerEventId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const duplicate = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "reservation_payments"
      WHERE "gateway" = ${event.gateway}
        AND "provider_event_id" = ${event.providerEventId}
      LIMIT 1
    `;
    if (duplicate[0]) return { deduplicated: true, reservationId };

    const reservation = await tx.reservation.findUnique({ where: { id: reservationId }, select: { id: true, tenantId: true } });
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
      const paymentId = crypto.randomUUID();
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

    if (event.status === 'approved' && (!existing || existing.status !== 'approved')) {
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

    return { deduplicated: false, reservationId: reservation.id };
  });
}
