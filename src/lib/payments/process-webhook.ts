import { db } from '@/lib/db';
import type { WebhookEvent } from './types';

/**
 * Canonical payment webhook state machine for Asaas and Mercado Pago.
 * Event deduplication, audit persistence and business state transition occur
 * in one PostgreSQL transaction protected by a transaction-scoped advisory lock.
 */
export async function processPaymentWebhookEvent(event: WebhookEvent): Promise<{ deduplicated: boolean; subscriptionId: string }> {
  if (!event.providerEventId) throw new Error('PAYMENT_WEBHOOK_EVENT_ID_MISSING');
  if (!event.subscriptionId) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_ID_MISSING');

  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { id: event.subscriptionId },
      select: { id: true, tenantId: true, planType: true, status: true, paymentStatus: true },
    });
    if (!subscription) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_NOT_FOUND');

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
          data: { status: 'active', paymentStatus: 'approved', paymentId: event.gatewayPaymentId, subscriptionAt: new Date() },
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
