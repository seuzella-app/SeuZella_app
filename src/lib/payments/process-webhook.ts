import { db } from '@/lib/db';
import { processReservationPaymentWebhookEvent } from './process-reservation-webhook';
import { validatePaymentWebhookTransition } from './webhook-transition';
import type { WebhookEvent } from './types';

/**
 * Canonical payment webhook dispatcher for Asaas and Mercado Pago.
 * The provider reference is resolved against the internal business domains:
 * Subscription for SaaS billing or Reservation for guest charges.
 *
 * referenceType is authoritative when supplied; the database is still the
 * source of truth for identity, preventing provider metadata from selecting a
 * tenant/domain arbitrarily.
 */
export async function processPaymentWebhookEvent(event: WebhookEvent): Promise<{
  deduplicated: boolean;
  referenceType: 'subscription' | 'reservation';
  subscriptionId?: string;
  reservationId?: string;
}> {
  if (!event.providerEventId) throw new Error('PAYMENT_WEBHOOK_EVENT_ID_MISSING');
  const referenceId = event.referenceId || event.subscriptionId || '';
  if (!referenceId) throw new Error('PAYMENT_WEBHOOK_REFERENCE_ID_MISSING');

  if (event.referenceType === 'reservation') {
    const reservation = await db.reservation.findUnique({ where: { id: referenceId }, select: { id: true } });
    if (!reservation) throw new Error('PAYMENT_WEBHOOK_REFERENCE_NOT_FOUND');
    const result = await processReservationPaymentWebhookEvent({ ...event, referenceId, referenceType: 'reservation' });
    return { ...result, referenceType: 'reservation' };
  }

  if (event.referenceType === 'subscription') {
    const subscription = await db.subscription.findUnique({ where: { id: referenceId }, select: { id: true } });
    if (!subscription) throw new Error('PAYMENT_WEBHOOK_REFERENCE_NOT_FOUND');
    const result = await processSubscriptionWebhookEvent({ ...event, referenceId, subscriptionId: subscription.id, referenceType: 'subscription' });
    return { ...result, referenceType: 'subscription' };
  }

  // Legacy/untyped events are resolved conservatively against the internal DB.
  const subscription = await db.subscription.findUnique({ where: { id: referenceId }, select: { id: true } });
  if (subscription) {
    const result = await processSubscriptionWebhookEvent({ ...event, referenceId, subscriptionId: subscription.id, referenceType: 'subscription' });
    return { ...result, referenceType: 'subscription' };
  }

  const reservation = await db.reservation.findUnique({ where: { id: referenceId }, select: { id: true } });
  if (reservation) {
    const result = await processReservationPaymentWebhookEvent({ ...event, referenceId, referenceType: 'reservation' });
    return { ...result, referenceType: 'reservation' };
  }

  throw new Error('PAYMENT_WEBHOOK_REFERENCE_NOT_FOUND');
}

async function processSubscriptionWebhookEvent(event: WebhookEvent): Promise<{ deduplicated: boolean; subscriptionId: string }> {
  const subscriptionId = event.referenceId || event.subscriptionId || '';
  if (!subscriptionId) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_ID_MISSING');

  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, tenantId: true, planType: true, status: true, paymentStatus: true },
    });
    if (!subscription) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_NOT_FOUND');

    // C4.3: Validação determinística de transição de máquina de estados para assinaturas
    if (subscription.paymentStatus) {
      const transition = validatePaymentWebhookTransition(subscription.paymentStatus, event.status);
      if (!transition.accepted) {
        console.warn(`[SUBSCRIPTION_PAYMENT] Transição rejeitada: ${subscription.paymentStatus} -> ${event.status} (${transition.reason})`);
        return { deduplicated: true, subscriptionId: subscription.id };
      }
    }

    const lockKey = `payment-event:${event.gateway}:${event.providerEventId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.paymentTransaction.findFirst({
      where: { subscriptionId: subscription.id, externalId: event.providerEventId },
      select: { id: true },
    });
    if (existing) return { deduplicated: true, subscriptionId: subscription.id };

    const paymentMethod = event.gateway === 'asaas' ? 'asaas' : 'mercadopago';
    await tx.paymentTransaction.create({
      data: {
        subscriptionId: subscription.id,
        amount: event.amount ?? 0,
        status: event.status,
        paymentMethod,
        externalId: event.providerEventId,
        type: `webhook:${event.gateway}:${event.event}`,
        metadata: JSON.stringify({
          gateway: event.gateway,
          providerEventId: event.providerEventId,
          gatewayPaymentId: event.gatewayPaymentId,
          event: event.event,
          receivedAt: event.receivedAt,
          raw: event.raw,
        }),
      },
    });

    switch (event.status) {
      case 'approved':
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active', paymentStatus: 'approved', paymentId: event.gatewayPaymentId },
        });
        await tx.tenant.update({
          where: { id: subscription.tenantId },
          data: { plan: subscription.planType as never, status: 'active', subscriptionAt: new Date() },
        });
        break;
      case 'pending':
      case 'in_progress':
        await tx.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'pending', paymentId: event.gatewayPaymentId } });
        break;
      case 'rejected':
        await tx.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'rejected', paymentId: event.gatewayPaymentId } });
        break;
      case 'cancelled':
        await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'cancelled', paymentStatus: 'cancelled', paymentId: event.gatewayPaymentId, cancelAtPeriodEnd: true } });
        break;
      case 'refunded':
        await tx.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'refunded', paymentId: event.gatewayPaymentId } });
        break;
      default:
        break;
    }

    return { deduplicated: false, subscriptionId: subscription.id };
  });
}
