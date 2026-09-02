/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks com vi.hoisted ─────────────────────────────────────────────────────
const { mockDb, mockTx, mockBridges } = vi.hoisted(() => {
  const txInstance = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(),
    reservation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'res_123', status: 'CONFIRMED' }),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx_123', ...data })),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'sub_123', status: 'active', paymentStatus: 'approved' }),
    },
    paymentTransaction: {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pt_123', ...data })),
      update: vi.fn().mockResolvedValue({ id: 'pt_123' }),
    },
    tenant: {
      update: vi.fn().mockResolvedValue({ id: 'tenant_123', status: 'active' }),
    },
  };

  const dbInstance = {
    $transaction: vi.fn(async (callback) => callback(txInstance)),
    reservation: txInstance.reservation,
    subscription: txInstance.subscription,
    paymentTransaction: txInstance.paymentTransaction,
    transaction: txInstance.transaction,
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif_123' }),
    },
    lockCode: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    billingIdempotency: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    mockDb: dbInstance,
    mockTx: txInstance,
    mockBridges: {
      bridgePaymentEvent: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/locks/orchestrator', () => ({
  revokeReservationPins: vi.fn().mockResolvedValue({ success: true, revokedCount: 1 }),
}));

vi.mock('@/lib/notifications/bridges', () => ({
  bridgePaymentEvent: mockBridges.bridgePaymentEvent,
}));

import { processPaymentWebhookEvent } from '@/lib/payments/process-webhook';
import { executeWithBillingIdempotency, buildIdempotencyKey } from '@/lib/payments/idempotency';
import type { WebhookEvent } from '@/lib/payments/types';

describe('⚡ F05: Payment Webhook Resilience & Exactly-Once Invariant Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Webhook Deduplication & Replay Resistance', () => {
    it('processes an event on first arrival and deduplicates on second arrival (2x)', async () => {
      const event: WebhookEvent = {
        gateway: 'asaas',
        providerEventId: 'evt_asaas_123',
        gatewayPaymentId: 'pay_asaas_123',
        referenceId: 'res_123',
        referenceType: 'reservation',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        amount: 350.0,
        receivedAt: new Date().toISOString(),
        raw: { id: 'evt_asaas_123' },
      };

      // 1st arrival: no duplicate
      mockDb.reservation.findUnique.mockResolvedValueOnce({ id: 'res_123' });
      mockTx.$queryRaw
        .mockResolvedValueOnce([]) // duplicate check
        .mockResolvedValueOnce([]); // existing payments
      mockTx.reservation.findUnique.mockResolvedValueOnce({
        id: 'res_123',
        tenantId: 'tenant_123',
        checkIn: new Date('2026-10-01'),
        checkOut: new Date('2026-10-05'),
        status: 'PENDING',
        guest: { name: 'João Silva', phone: '+5511999999999' },
      });

      const firstResult = await processPaymentWebhookEvent(event);
      expect(firstResult.deduplicated).toBe(false);
      expect(firstResult.referenceType).toBe('reservation');

      // 2nd arrival: duplicate found in reservation_payments
      mockDb.reservation.findUnique.mockResolvedValueOnce({ id: 'res_123' });
      mockTx.$queryRaw.mockResolvedValueOnce([{ id: 'existing_pay_id' }]); // duplicate check returns row

      const secondResult = await processPaymentWebhookEvent(event);
      expect(secondResult.deduplicated).toBe(true);
      expect(secondResult.referenceType).toBe('reservation');
    });

    it('deduplicates 10 sequential deliveries of the exact same webhook', async () => {
      const event: WebhookEvent = {
        gateway: 'mercadopago',
        providerEventId: 'evt_mp_repeat_10',
        gatewayPaymentId: 'pay_mp_10',
        referenceId: 'sub_tenant_1',
        referenceType: 'subscription',
        event: 'payment.created',
        status: 'approved',
        amount: 247.0,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      // First run: new transaction
      mockDb.subscription.findUnique.mockResolvedValue({ id: 'sub_tenant_1' });
      mockTx.subscription.findUnique.mockResolvedValue({
        id: 'sub_tenant_1',
        tenantId: 'tenant_1',
        planType: 'PRO',
        status: 'pending',
        paymentStatus: 'pending',
      });
      mockTx.paymentTransaction.findFirst.mockResolvedValueOnce(null);

      const first = await processPaymentWebhookEvent(event);
      expect(first.deduplicated).toBe(false);

      // Subsequent 9 runs: findFirst returns existing transaction
      mockTx.paymentTransaction.findFirst.mockResolvedValue({ id: 'pt_123' });

      for (let i = 0; i < 9; i++) {
        const res = await processPaymentWebhookEvent(event);
        expect(res.deduplicated).toBe(true);
      }
    });

    it('handles concurrent duplicate webhook processing safely with Promise.all', async () => {
      const event: WebhookEvent = {
        gateway: 'asaas',
        providerEventId: 'evt_concurrent_123',
        gatewayPaymentId: 'pay_concurrent_123',
        referenceId: 'res_conc_1',
        referenceType: 'reservation',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        amount: 500,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      mockDb.reservation.findUnique.mockResolvedValue({ id: 'res_conc_1' });
      mockTx.reservation.findUnique.mockResolvedValue({
        id: 'res_conc_1',
        tenantId: 'tenant_1',
        checkIn: new Date(),
        checkOut: new Date(),
        status: 'PENDING',
        guest: { name: 'Carlos', phone: '' },
      });

      // Simulate lock & first winner inserting, second sees duplicate
      let firstCalled = false;
      mockTx.$queryRaw.mockImplementation(async () => {
        if (!firstCalled) {
          firstCalled = true;
          return []; // winner sees no duplicate
        }
        return [{ id: 'winner_payment_row' }]; // runner-up sees duplicate
      });

      const [res1, res2] = await Promise.all([
        processPaymentWebhookEvent(event),
        processPaymentWebhookEvent(event),
      ]);

      const deduplicatedCount = [res1.deduplicated, res2.deduplicated].filter(Boolean).length;
      expect(deduplicatedCount).toBe(1);
    });
  });

  describe('2. Out-of-Order Delivery & Terminal State Guards', () => {
    it('rejects obsolete "pending" or "approved" event arriving after payment was already "refunded"', async () => {
      const outOfOrderEvent: WebhookEvent = {
        gateway: 'mercadopago',
        providerEventId: 'evt_mp_out_of_order',
        gatewayPaymentId: 'pay_mp_terminal',
        referenceId: 'sub_123',
        referenceType: 'subscription',
        event: 'payment.updated',
        status: 'approved',
        amount: 247.0,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      mockDb.subscription.findUnique.mockResolvedValue({ id: 'sub_123' });
      mockTx.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_1',
        planType: 'PRO',
        status: 'active',
        paymentStatus: 'refunded', // already terminal refunded
      });

      const result = await processPaymentWebhookEvent(outOfOrderEvent);
      expect(result.deduplicated).toBe(true);
      // Ensure subscription status was not overwritten back to active/approved
      expect(mockTx.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('3. Multi-Tenant Scoping & Fail-Closed Validation', () => {
    it('throws error when providerEventId or referenceId is missing (Fail-Closed)', async () => {
      const invalidEvent1: WebhookEvent = {
        gateway: 'asaas',
        providerEventId: '',
        gatewayPaymentId: 'pay_123',
        referenceId: 'res_123',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      await expect(processPaymentWebhookEvent(invalidEvent1)).rejects.toThrow('PAYMENT_WEBHOOK_EVENT_ID_MISSING');

      const invalidEvent2: WebhookEvent = {
        gateway: 'asaas',
        providerEventId: 'evt_123',
        gatewayPaymentId: 'pay_123',
        referenceId: '',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      await expect(processPaymentWebhookEvent(invalidEvent2)).rejects.toThrow('PAYMENT_WEBHOOK_REFERENCE_ID_MISSING');
    });

    it('throws error when referenceId does not match any valid tenant resource in DB', async () => {
      const event: WebhookEvent = {
        gateway: 'asaas',
        providerEventId: 'evt_ghost_123',
        gatewayPaymentId: 'pay_ghost_123',
        referenceId: 'non_existent_id',
        referenceType: 'reservation',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      mockDb.reservation.findUnique.mockResolvedValue(null);
      await expect(processPaymentWebhookEvent(event)).rejects.toThrow('PAYMENT_WEBHOOK_REFERENCE_NOT_FOUND');
    });
  });

  describe('4. Billing Idempotency Atomic Retry & Failure Recovery', () => {
    it('allows retry when previous execution resulted in a failure', async () => {
      const options = {
        provider: 'asaas' as const,
        eventId: 'evt_retry_test_1',
        eventType: 'invoice.payment',
      };

      // 1. Initial run fails
      mockDb.billingIdempotency.findUnique.mockResolvedValueOnce(null);
      mockDb.billingIdempotency.create.mockResolvedValueOnce({ id: 'idemp_1', status: 'processing' });
      mockDb.billingIdempotency.update.mockResolvedValueOnce({ id: 'idemp_1', status: 'failed' });

      let attempts = 0;
      const failingHandler = async () => {
        attempts++;
        if (attempts === 1) throw new Error('Transient network timeout');
        return { processed: true };
      };

      await expect(executeWithBillingIdempotency(options, failingHandler)).rejects.toThrow('Transient network timeout');

      // 2. Retry succeeds
      mockDb.billingIdempotency.findUnique.mockResolvedValueOnce({
        id: 'idemp_1',
        status: 'failed',
        updatedAt: new Date(),
      });
      mockDb.billingIdempotency.update.mockResolvedValueOnce({ id: 'idemp_1', status: 'processing' });
      mockDb.billingIdempotency.update.mockResolvedValueOnce({ id: 'idemp_1', status: 'completed' });

      const retryResult = await executeWithBillingIdempotency(options, failingHandler);
      expect(retryResult.success).toBe(true);
      expect(retryResult.status).toBe('completed');
      expect(retryResult.data).toEqual({ processed: true });
    });
  });
});
