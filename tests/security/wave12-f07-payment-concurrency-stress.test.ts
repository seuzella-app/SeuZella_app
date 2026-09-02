/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockStorageState } = vi.hoisted(() => {
  return {
    mockStorageState: {
      records: new Map<string, any>(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    billingIdempotency: {
      findUnique: vi.fn(async ({ where }: any) => {
        const item = mockStorageState.records.get(where.key);
        return item ? { ...item } : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        if (mockStorageState.records.has(data.key)) {
          const err = new Error('Unique constraint failed on the fields: (`key`)');
          (err as any).code = 'P2002';
          throw err;
        }
        const record = { ...data, updatedAt: new Date() };
        mockStorageState.records.set(data.key, record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = mockStorageState.records.get(where.key);
        if (!existing) throw new Error('Record not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockStorageState.records.set(where.key, updated);
        return updated;
      }),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

import { executeWithBillingIdempotency } from '@/lib/payments/idempotency';

describe('⚡ F07: Payment Concurrency & Idempotency Atomicity Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageState.records.clear();
  });

  describe('1. executeWithBillingIdempotency High Concurrency Stress', () => {
    it('executes handler exactly 1 time across 2 concurrent invocations (1 processed, 1 deduplicated)', async () => {
      const options = {
        provider: 'asaas' as const,
        eventId: 'evt_stress_2',
        eventType: 'payment.received',
      };

      let executionCount = 0;

      const handler = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { chargeId: 'chg_123', status: 'CONFIRMED' };
      };

      const [res1, res2] = await Promise.all([
        executeWithBillingIdempotency(options, handler),
        executeWithBillingIdempotency(options, handler),
      ]);

      expect(executionCount).toBe(1);
      const processed = [res1, res2].filter((r) => !r.deduplicated);
      const deduplicated = [res1, res2].filter((r) => r.deduplicated);

      expect(processed.length).toBe(1);
      expect(deduplicated.length).toBe(1);
      expect(processed[0].data).toEqual({ chargeId: 'chg_123', status: 'CONFIRMED' });
    });

    it('handles 10 concurrent requests atomically: exactly 1 processed, 9 deduplicated', async () => {
      const options = {
        provider: 'mercadopago' as const,
        eventId: 'evt_stress_10',
        eventType: 'payment.approved',
      };

      let executionCount = 0;

      const handler = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { invoiceId: 'inv_10', balance: 247.0 };
      };

      const results = await Promise.all(
        Array.from({ length: 10 }, () => executeWithBillingIdempotency(options, handler)),
      );

      expect(executionCount).toBe(1);
      const processed = results.filter((r) => !r.deduplicated);
      const deduplicated = results.filter((r) => r.deduplicated);

      expect(processed.length).toBe(1);
      expect(deduplicated.length).toBe(9);
    });

    it('handles 50 concurrent requests under extreme stress: exactly 1 processed, 49 deduplicated', async () => {
      const options = {
        provider: 'asaas' as const,
        eventId: 'evt_stress_50',
        eventType: 'payment.confirmed',
      };

      let executionCount = 0;

      const handler = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 2));
        return { payoutId: 'payout_50', success: true };
      };

      const results = await Promise.all(
        Array.from({ length: 50 }, () => executeWithBillingIdempotency(options, handler)),
      );

      expect(executionCount).toBe(1);
      const processed = results.filter((r) => !r.deduplicated);
      const deduplicated = results.filter((r) => r.deduplicated);

      expect(processed.length).toBe(1);
      expect(deduplicated.length).toBe(49);
    });
  });

  describe('2. Multi-Tenant Scoping & Event Isolation', () => {
    it('isolates different event types for the same payment ID into distinct atomic keys', async () => {
      const optReceived = { provider: 'asaas' as const, eventId: 'pay_999', eventType: 'payment_received' };
      const optRefunded = { provider: 'asaas' as const, eventId: 'pay_999', eventType: 'payment_refunded' };

      const resReceived = await executeWithBillingIdempotency(optReceived, async () => ({ event: 'received' }));
      const resRefunded = await executeWithBillingIdempotency(optRefunded, async () => ({ event: 'refunded' }));

      expect(resReceived.deduplicated).toBe(false);
      expect(resRefunded.deduplicated).toBe(false);
      expect(resReceived.key).not.toBe(resRefunded.key);
      expect(mockStorageState.records.size).toBe(2);
    });
  });
});
