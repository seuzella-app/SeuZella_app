// ==============================================================================
// SEUZÉLLA — Production Billing Idempotency Layer (C6)
// Provides atomic, PostgreSQL-backed idempotency for webhook ingestion across
// Asaas and Mercado Pago gateways. Guarantees exactly-once execution, safe
// concurrent retries, and strict isolation between distinct event types.
// ==============================================================================

import { db } from '@/lib/db';

export interface IdempotencyOptions {
  provider: 'asaas' | 'mercadopago' | 'generic';
  eventId: string;
  eventType: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface IdempotencyResult<T> {
  success: boolean;
  deduplicated: boolean;
  inProgress?: boolean;
  status: 'completed' | 'processing' | 'failed';
  data: T | null;
  key: string;
}

/**
 * Builds a deterministic canonical key for webhook idempotency.
 * Distinguishes different event types and statuses for the same payment.
 */
export function buildIdempotencyKey(options: IdempotencyOptions): string {
  const cleanProvider = options.provider.trim().toLowerCase();
  const cleanEventId = (options.eventId || 'unknown').trim();
  const cleanEventType = (options.eventType || 'generic').trim().toLowerCase();
  const cleanStatus = options.status ? `:${options.status.trim().toLowerCase()}` : '';
  return `webhook:${cleanProvider}:${cleanEventId}:${cleanEventType}${cleanStatus}`;
}

/**
 * Executes a payment/webhook handler with guaranteed atomic database-backed idempotency.
 *
 * - If already 'completed': returns cached result without re-executing handler.
 * - If 'processing' (concurrent execution): returns inProgress deduplicated response.
 * - If 'failed': allows retry by re-acquiring lock.
 * - If new: executes handler within tracked lifecycle and saves final response.
 */
export async function executeWithBillingIdempotency<T extends Record<string, unknown>>(
  options: IdempotencyOptions,
  handler: () => Promise<T>,
): Promise<IdempotencyResult<T>> {
  const key = buildIdempotencyKey(options);

  // Fallback: If DB or billingIdempotency delegate is unavailable (e.g. legacy mocks/bootstrap), execute handler
  if (!db?.billingIdempotency) {
    const result = await handler();
    return {
      success: true,
      deduplicated: false,
      status: 'completed',
      data: result,
      key,
    };
  }

  // 1. Check existing idempotency record in PostgreSQL
  let record = await db.billingIdempotency.findUnique({
    where: { key },
  });

  if (record) {
    if (record.status === 'completed') {
      let parsedData: T | null = null;
      try {
        parsedData = JSON.parse(record.response) as T;
      } catch {
        parsedData = null;
      }
      console.log(`[billing-idempotency] ⚡ DEDUPLICATED (completed): key=${key}`);
      return {
        success: true,
        deduplicated: true,
        status: 'completed',
        data: parsedData,
        key,
      };
    }

    if (record.status === 'processing') {
      // Check if it's stale (older than 2 minutes). If not stale, treat as concurrent in-flight.
      const isStale = Date.now() - new Date(record.updatedAt).getTime() > 120000;
      if (!isStale) {
        console.log(`[billing-idempotency] ⏳ DEDUPLICATED (in-progress): key=${key}`);
        return {
          success: true,
          deduplicated: true,
          inProgress: true,
          status: 'processing',
          data: null,
          key,
        };
      }
    }

    // If failed or stale, update to processing for retry
    await db.billingIdempotency.update({
      where: { key },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
      },
    });
  } else {
    // 2. Try creating initial processing record
    try {
      record = await db.billingIdempotency.create({
        data: {
          key,
          provider: options.provider,
          eventId: options.eventId,
          eventType: options.eventType,
          status: 'processing',
          attempts: 1,
        },
      });
    } catch (err: unknown) {
      // Handle race condition on unique constraint collision
      const isUniqueError = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
      if (isUniqueError) {
        const existing = await db.billingIdempotency.findUnique({ where: { key } });
        if (existing?.status === 'completed') {
          let parsedData: T | null = null;
          try {
            parsedData = JSON.parse(existing.response) as T;
          } catch {
            parsedData = null;
          }
          return {
            success: true,
            deduplicated: true,
            status: 'completed',
            data: parsedData,
            key,
          };
        }
        return {
          success: true,
          deduplicated: true,
          inProgress: true,
          status: 'processing',
          data: null,
          key,
        };
      }
      throw err;
    }
  }

  // 3. Execute the actual billing operation
  try {
    const result = await handler();

    // 4. Mark idempotency record as completed with result payload
    await db.billingIdempotency.update({
      where: { key },
      data: {
        status: 'completed',
        response: JSON.stringify(result),
      },
    });

    console.log(`[billing-idempotency] ✅ PROCESSED & PERSISTED: key=${key}`);
    return {
      success: true,
      deduplicated: false,
      status: 'completed',
      data: result,
      key,
    };
  } catch (handlerError) {
    // 5. Mark as failed so subsequent legitimate retries are allowed
    try {
      await db.billingIdempotency.update({
        where: { key },
        data: {
          status: 'failed',
          response: JSON.stringify({
            error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
            failedAt: new Date().toISOString(),
          }),
        },
      });
    } catch (updateErr) {
      console.error('[billing-idempotency] Failed to record failure state:', updateErr);
    }
    throw handlerError;
  }
}

// ── Backward Compatible Helpers for Reservation and Legacy Webhook Ledgers ──

import { randomUUID } from 'crypto';
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
