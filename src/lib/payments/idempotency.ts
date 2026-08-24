// ==============================================================================
// SEUZÉLLA — Payment Idempotency Layer
// Supports Asaas + Mercado Pago webhook retries for SaaS subscriptions and
// guest reservations.
// ==============================================================================

import { db } from '@/lib/db';
import type { GatewayId, PaymentStatus, WebhookEvent } from './types';

function eventKey(event: WebhookEvent): string {
  return `${event.gateway}:${event.providerEventId || event.gatewayPaymentId}:${event.status}`;
}

function referenceWhere(event: WebhookEvent) {
  if (event.referenceType === 'reservation') {
    return { reservationId: event.referenceId };
  }
  return { subscriptionId: event.referenceId };
}

export async function isAlreadyProcessed(event: WebhookEvent): Promise<boolean> {
  const terminalStatuses: PaymentStatus[] = ['approved', 'rejected', 'cancelled', 'refunded'];
  if (!terminalStatuses.includes(event.status)) return false;

  const externalId = event.providerEventId || event.gatewayPaymentId;
  const existing = await db.paymentTransaction.findFirst({
    where: { ...referenceWhere(event), externalId, status: event.status },
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

    const existing = await tx.paymentTransaction.findFirst({
      where: { ...referenceWhere(event), externalId, status: event.status },
      select: { id: true },
    });

    if (existing) return { id: existing.id, deduplicated: true };

    const row = await tx.paymentTransaction.create({
      data: {
        ...(event.referenceType === 'reservation'
          ? { reservationId: event.referenceId }
          : { subscriptionId: event.referenceId }),
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
    await tx.tenant.update({ where: { id: subscription.tenantId }, data: { plan: planTier as never, subscriptionAt: new Date() } });

    return { activated: true, reason: 'activated' };
  });
}
