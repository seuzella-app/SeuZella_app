import { db } from '@/lib/db';
import { processReservationPaymentWebhookEvent } from './process-reservation-webhook';
import { applySubscriptionPaymentStatus } from './subscription-state-apply';
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

    // RBW C+D: validação de transição + mutação de subscription/tenant passam
    // pelo dono ÚNICO (applySubscriptionPaymentStatus) — a aplicação ocorre
    // APÓS o dedup e o registro do evento bruto; estado da assinatura nunca
    // regride e evento fora de ordem é tratado como dedup.
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

    // RBW C+D: aplicação canônica do estado (única porta de mutação).
    const applyResult = await applySubscriptionPaymentStatus({
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      planTier: subscription.planType,
      canonicalStatus: event.status,
      gateway: event.gateway,
      gatewayPaymentId: event.gatewayPaymentId,
      currentPaymentStatus: subscription.paymentStatus || null,
      tx,
    });
    if (!applyResult.applied) {
      // Evento bruto já registrado acima; estado NÃO é mutado fora da máquina.
      // RBW v2: noop idempotente (replay) é normal e silencioso; rejeição de
      // transição (fora de ordem/terminal) é anômala e warn.
      if (applyResult.transition === 'idempotent_noop') {
        return { deduplicated: true, subscriptionId: subscription.id };
      }
      console.warn(`[SUBSCRIPTION_PAYMENT] Transição rejeitada: ${subscription.paymentStatus || '(vazio)'} -> ${event.status} (${applyResult.reason})`);
      return { deduplicated: true, subscriptionId: subscription.id };
    }

    return { deduplicated: false, subscriptionId: subscription.id };
  });
}
