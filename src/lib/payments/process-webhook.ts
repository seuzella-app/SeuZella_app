import { db } from '@/lib/db';
import type { WebhookEvent } from './types';
import { recordWebhookEvent } from './idempotency';

export async function processPaymentWebhookEvent(event: WebhookEvent): Promise<{ deduplicated: boolean; subscriptionId: string }> {
  if (!event.providerEventId) throw new Error('PAYMENT_WEBHOOK_EVENT_ID_MISSING');
  if (!event.subscriptionId) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_ID_MISSING');

  const subscription = await db.subscription.findUnique({
    where: { id: event.subscriptionId },
    select: { id: true, tenantId: true, planType: true, status: true, paymentStatus: true },
  });
  if (!subscription) throw new Error('PAYMENT_WEBHOOK_SUBSCRIPTION_NOT_FOUND');

  const paymentMethod = event.gateway === 'asaas' ? 'asaas' : 'mercadopago';
  const recorded = await recordWebhookEvent(event, event.amount ?? 0, paymentMethod);
  if (recorded.deduplicated) return { deduplicated: true, subscriptionId: subscription.id };

  await db.$transaction(async (tx) => {
    const lockKey = `payment-state:${event.gateway}:${subscription.id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    switch (event.status) {
      case 'approved':
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            paymentStatus: 'approved',
            paymentId: event.gatewayPaymentId,
            subscriptionAt: new Date(),
          },
        });
        await tx.tenant.update({ where: { id: subscription.tenantId }, data: { plan: subscription.planType as never, status: 'active', subscriptionAt: new Date() } });
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
  });

  return { deduplicated: false, subscriptionId: subscription.id };
}
