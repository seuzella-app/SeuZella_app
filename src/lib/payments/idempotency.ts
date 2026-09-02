// ==============================================================================
// SEUZÉLLA — Production Billing Idempotency Layer (C6)
// PostgreSQL-backed durable idempotency for billing/webhook execution.
// ==============================================================================

import { db } from '@/lib/db';

export interface IdempotencyOptions {
  provider: 'asaas' | 'mercadopago' | 'generic';
  eventId: string;
  eventType: string;
  status?: string;
  metadata?: Record<string, unknown>;
  /** Optional semantic request fingerprint for API idempotency callers. */
  fingerprint?: string;
}

export interface IdempotencyResult<T> {
  success: boolean;
  deduplicated: boolean;
  inProgress?: boolean;
  status: 'completed' | 'processing' | 'failed';
  data: T | null;
  key: string;
}

const FINGERPRINT_MARKER = '__zella_idempotency_fingerprint';
const DATA_MARKER = 'data';
const STALE_PROCESSING_MS = 120_000;

function encodeResponse<T>(data: T, fingerprint?: string): string {
  if (!fingerprint) return JSON.stringify(data);
  return JSON.stringify({ [FINGERPRINT_MARKER]: fingerprint, [DATA_MARKER]: data });
}

function decodeResponse<T>(response: string, fingerprint?: string): T | null {
  try {
    const parsed = JSON.parse(response) as unknown;
    if (!fingerprint) return parsed as T;
    if (
      parsed &&
      typeof parsed === 'object' &&
      FINGERPRINT_MARKER in parsed &&
      (parsed as Record<string, unknown>)[FINGERPRINT_MARKER] === fingerprint &&
      DATA_MARKER in parsed
    ) {
      return (parsed as Record<string, unknown>)[DATA_MARKER] as T;
    }
    return null;
  } catch {
    return null;
  }
}

function responseFingerprint(response: string): string | undefined {
  try {
    const parsed = JSON.parse(response) as unknown;
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as Record<string, unknown>)[FINGERPRINT_MARKER];
      return typeof value === 'string' ? value : undefined;
    }
  } catch {
    // Treat malformed legacy responses as non-replayable for fingerprinted calls.
  }
  return undefined;
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
 * Executes a billing/webhook handler with durable PostgreSQL-backed idempotency.
 * The unique key handles the first-writer race; completed responses are replayed
 * without executing the handler. Optional fingerprints prevent reuse of one API
 * idempotency key for a semantically different request.
 */
export async function executeWithBillingIdempotency<T extends Record<string, unknown>>(
  options: IdempotencyOptions,
  handler: () => Promise<T>,
): Promise<IdempotencyResult<T>> {
  const key = buildIdempotencyKey(options);
  const fingerprint = options.fingerprint?.trim() || undefined;

  // Production invariant: absence of the idempotency store is a hard failure.
  // Executing a billing handler without durable idempotency can double-charge on retry.
  if (!db?.billingIdempotency) throw new Error('BILLING_IDEMPOTENCY_UNAVAILABLE');

  let record = await db.billingIdempotency.findUnique({ where: { key } });

  if (record) {
    if (fingerprint) {
      const storedFingerprint = responseFingerprint(record.response);
      if (record.status === 'completed' && storedFingerprint !== fingerprint) {
        throw new Error(
          storedFingerprint
            ? 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
            : 'IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING',
        );
      }
      if (record.status === 'processing' && storedFingerprint && storedFingerprint !== fingerprint) {
        throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
      }
    }

    if (record.status === 'completed') {
      const parsedData = decodeResponse<T>(record.response, fingerprint);
      if (parsedData === null && fingerprint) throw new Error('IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING');
      console.log(`[billing-idempotency] ⚡ DEDUPLICATED (completed): key=${key}`);
      return { success: true, deduplicated: true, status: 'completed', data: parsedData, key };
    }

    if (record.status === 'processing') {
      const isStale = Date.now() - new Date(record.updatedAt).getTime() > STALE_PROCESSING_MS;
      if (!isStale) {
        console.log(`[billing-idempotency] ⏳ DEDUPLICATED (in-progress): key=${key}`);
        return { success: true, deduplicated: true, inProgress: true, status: 'processing', data: null, key };
      }
    }

    record = await db.billingIdempotency.update({
      where: { key },
      data: { status: 'processing', attempts: { increment: 1 }, response: encodeResponse({}, fingerprint) },
    });
  } else {
    try {
      record = await db.billingIdempotency.create({
        data: {
          key,
          provider: options.provider,
          eventId: options.eventId,
          eventType: options.eventType,
          status: 'processing',
          attempts: 1,
          response: encodeResponse({}, fingerprint),
        },
      });
    } catch (err: unknown) {
      const isUniqueError = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
      if (!isUniqueError) throw err;
      const existing = await db.billingIdempotency.findUnique({ where: { key } });
      if (!existing) throw new Error('BILLING_IDEMPOTENCY_RACE_UNRESOLVED');
      if (fingerprint) {
        const storedFingerprint = responseFingerprint(existing.response);
        if (storedFingerprint && storedFingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
      }
      if (existing.status === 'completed') {
        const parsedData = decodeResponse<T>(existing.response, fingerprint);
        if (parsedData === null && fingerprint) throw new Error('IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING');
        return { success: true, deduplicated: true, status: 'completed', data: parsedData, key };
      }
      return { success: true, deduplicated: true, inProgress: true, status: 'processing', data: null, key };
    }
  }

  try {
    const result = await handler();
    await db.billingIdempotency.update({
      where: { key },
      data: { status: 'completed', response: encodeResponse(result, fingerprint) },
    });
    console.log(`[billing-idempotency] ✅ PROCESSED & PERSISTED: key=${key}`);
    return { success: true, deduplicated: false, status: 'completed', data: result, key };
  } catch (handlerError) {
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
    if (subscription.status === 'active' && subscription.paymentStatus === 'approved') return { activated: false, reason: 'already_active' };

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active', paymentStatus: 'approved', paymentId: gatewayPaymentId },
    });
    await tx.tenant.update({ where: { id: subscription.tenantId }, data: { status: 'active' } });
    return { activated: true, reason: 'activated' };
  });
}
