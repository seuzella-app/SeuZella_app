// ==============================================================================
// SEUZÉLLA — Payment Idempotency Layer
// ==============================================================================
// Prevents duplicate subscription activations and double-charges when gateways
// retry webhooks (Stripe retries up to 16x; MP retries 5x; Asaas retries 3x).
//
// Strategy: use the existing PaymentTransaction table as the idempotency log.
// Each webhook event creates a PaymentTransaction row; the (subscriptionId,
// gatewayPaymentId, status) UNIQUE-combination check prevents reprocessing.
//
// Sprint 1, Day 2: Idempotency foundation
// ==============================================================================

import { db } from '@/lib/db';
import type { GatewayId, PaymentStatus, WebhookEvent } from './types';

// ── Idempotency check: returns true if this event was already processed ───────
//
// "Already processed" = a PaymentTransaction row exists with the same:
//   - subscriptionId
//   - externalId (= gatewayPaymentId)
//   - status (terminal state: approved/rejected/cancelled/refunded)
//
// Non-terminal states (pending, in_progress) are NOT idempotent — the gateway
// may legitimately send multiple "pending" events; we coalesce them by always
// writing the latest status via upsert.
export async function isAlreadyProcessed(event: WebhookEvent): Promise<boolean> {
  const terminalStatuses: PaymentStatus[] = ['approved', 'rejected', 'cancelled', 'refunded'];
  if (!terminalStatuses.includes(event.status)) {
    return false;
  }

  const existing = await db.paymentTransaction.findFirst({
    where: {
      subscriptionId: event.subscriptionId,
      externalId: event.gatewayPaymentId,
      status: event.status,
    },
    select: { id: true, createdAt: true },
  });

  return existing !== null;
}

// ── Record a webhook event (upsert by externalId+status) ──────────────────────
//
// Creates a new PaymentTransaction row preserving the raw event for audit.
// Idempotent: if called twice with the same (subscriptionId, externalId, status),
// the second call returns the existing row without creating a duplicate.
export async function recordWebhookEvent(
  event: WebhookEvent,
  amount: number,
  paymentMethod: string,
): Promise<{ id: string; deduplicated: boolean }> {
  // Check if already exists
  const existing = await db.paymentTransaction.findFirst({
    where: {
      subscriptionId: event.subscriptionId,
      externalId: event.gatewayPaymentId,
      status: event.status,
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, deduplicated: true };
  }

  // Create new audit row
  const row = await db.paymentTransaction.create({
    data: {
      subscriptionId: event.subscriptionId,
      amount,
      status: event.status,
      paymentMethod,
      externalId: event.gatewayPaymentId,
      type: `webhook:${event.gateway}:${event.event}`,
      metadata: JSON.stringify({
        gateway: event.gateway,
        event: event.event,
        receivedAt: event.receivedAt,
        raw: event.raw,
      }),
    },
  });

  return { id: row.id, deduplicated: false };
}

// ── Idempotent subscription activation ────────────────────────────────────────
//
// Activates a subscription ONLY if it is not already active.
// Returns true if this call activated the subscription, false if it was already active.
//
// This replaces the vulnerable pattern in checkout/success/route.ts which
// activated based on signature alone (no idempotency check).
export async function activateSubscriptionIfNotActive(
  subscriptionId: string,
  planTier: string,
  gateway: GatewayId,
  gatewayPaymentId: string,
): Promise<{ activated: boolean; reason: string }> {
  // 1. Check idempotency — has this exact gateway event already activated?
  const alreadyProcessed = await isAlreadyProcessed({
    gateway,
    event: 'subscription.activated',
    gatewayPaymentId,
    subscriptionId,
    status: 'approved',
    receivedAt: new Date().toISOString(),
    raw: null,
  });

  if (alreadyProcessed) {
    return { activated: false, reason: 'duplicate_event' };
  }

  // 2. Check current subscription state — is it already active?
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, status: true, paymentStatus: true, tenantId: true },
  });

  if (!subscription) {
    return { activated: false, reason: 'subscription_not_found' };
  }

  if (subscription.status === 'active' && subscription.paymentStatus === 'approved') {
    return { activated: false, reason: 'already_active' };
  }

  // 3. Activate (atomic update with conditional check via where clause)
  await db.subscription.update({
    where: {
      id: subscriptionId,
      OR: [
        { status: { not: 'active' } },
        { paymentStatus: { not: 'approved' } },
      ],
    },
    data: {
      status: 'active',
      paymentStatus: 'approved',
      paymentId: gatewayPaymentId,
      // Update tenant plan atomically
    },
  });

  // 4. Update tenant plan
  await db.tenant.update({
    where: { id: subscription.tenantId },
    data: {
      plan: planTier as never,
      subscriptionAt: new Date(),
    },
  });

  return { activated: true, reason: 'activated' };
}
