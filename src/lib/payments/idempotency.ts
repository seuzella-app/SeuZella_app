// ==============================================================================
// SEUZÉLLA — Payment Idempotency Layer
// Supports Asaas + Mercado Pago webhook retries for SaaS subscriptions and
// guest reservations. Subscription billing uses PaymentTransaction; guest
// reservation payments use the dedicated reservation_payments ledger.
// ==============================================================================

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { GatewayId, PaymentStatus, WebhookEvent } from './types';

function eventKey(event: WebhookEvent): string {
  return `${event.gateway}:${event.providerEventId || event.gatewayPaymentId}:${event.status}`;
}

export async function isAlreadyProcessed(event: WebhookEvent): Promise<boolean> {
  const terminalStatuses: PaymentStatus[] = ['approved', 'rejected', 'cancelled', 'refunded'];
  if (!terminalStatuses.includes(event.status)) return false;

  const externalId = event.providerEventId || event.gatewayPaymentId;
  if (event.referenceType === 'reservation') {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "reservation_payments"
      WHERE "reservation_id" = ${event.referenceId}
        AND "gateway" = ${event.gateway}
        AND "provider_event_id" = ${externalId}
        AND "status" = ${event.status}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  const existing = await db.paymentTransaction.findFirst({
    where: { subscriptionId: event.referenceId, externalId, status: event.status },
    select: { id: true },
  });
  return existing !== null;
}

export async function recordWebhookEvent(
  event: WebhookEvent,
  amount: number,
  paymentMethod: string,
): Promise<{ id: string; deduplicated: boolean }> {
  const externalId = event.providerEventId || event.gatewayPaymentId;
  const lockKey = eventKey(event);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    if (event.referenceType === 'reservation') {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "reservation_payments"
        WHERE "reservation_id" = ${event.referenceId}
          AND "gateway" = ${event.gateway}
          AND "provider_event_id" = ${externalId}
          AND "status" = ${event.status}
        LIMIT 1
      `;
      if (existing[0]) return { id: existing[0].id, deduplicated: true };

      const paymentId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "reservation_payments"
          ("id", "reservation_id", "tenant_id", "gateway", "gateway_payment_id", "provider_event_id", "reference_type", "amount", "payment_method", "status", "metadata")
        SELECT
          ${paymentId}, "id", "tenant_id", ${event.gateway}, ${event.gatewayPaymentId}, ${externalId}, 'reservation', ${amount}, ${paymentMethod}, ${event.status}, ${JSON.stringify({
            gateway: event.gateway,
            providerEventId: event.providerEventId,
            gatewayPaymentId: event.gatewayPaymentId,
            referenceId: event.referenceId,
            referenceType: event.referenceType,
            event: event.event,
            receivedAt: event.receivedAt,
            raw: event.raw,
          })}
        FROM "reservations"
        WHERE "id" = ${event.referenceId}
      `;
      return { id: paymentId, deduplicated: false };
    }

    const existing = await tx.paymentTransaction.findFirst({
      where: { subscriptionId: event.referenceId, externalId, status: event.status },
      select: { id: true },
    });

    if (existing) return { id: existing.id, deduplicated: true };

    const row = await tx.paymentTransaction.create({
      data: {
        subscriptionId: event.referenceId,
        amount,
        status: event.status,
        paymentMethod,
        externalId,
        type: `webhook:${event.gateway}:${event.event}`,
        metadata: JSON.stringify({
          gateway: event.gateway,
          providerEventId: event.providerEventId,
          gatewayPaymentId: event.gatewayPaymentId,
          referenceId: event.referenceId,
          referenceType: event.referenceType,
          event: event.event,
          receivedAt: event.receivedAt,
          raw: event.raw,
        }),
      },
    });
    return { id: row.id, deduplicated: false };
  });
}

export async function activateSubscriptionIfNotActive(
  subscriptionId: string,
  planTier: string,
  gateway: GatewayId,
  gatewayPaymentId: string,
): Promise<{ activated: boolean; reason: string }> {
  return db.$transaction(async (tx) => {
    const lockKey = `subscription:${gateway}:${subscriptionId}:${gatewayPaymentId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, status: true, paymentStatus: true, tenantId: true },
    });
    if (!subscription) return { activated: false, reason: 'subscription_not_found' };

    if (subscription.status === 'active' && subscription.paymentStatus === 'approved') {
      return { activated: false, reason: 'already_active' };
    }

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active', paymentStatus: 'approved', paymentId: gatewayPaymentId },
    });

    await tx.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: 'active' },
    });

    return { activated: true, reason: 'activated' };
  });
}
