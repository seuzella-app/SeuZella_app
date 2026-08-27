import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWithBillingIdempotency, buildIdempotencyKey } from '@/lib/payments/idempotency';

// ── In-Memory Store Simulating PostgreSQL billing_idempotency table ──
const memoryStore = new Map<string, {
  id: string;
  key: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: 'processing' | 'completed' | 'failed';
  response: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}>();

// ── In-Memory Store Simulating PostgreSQL payment_transactions table with @@unique([paymentMethod, externalId]) ──
const paymentTransactions = new Map<string, {
  id: string;
  subscriptionId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  externalId: string;
}>();

interface MockIdempotencyData {
  key: string;
  provider: string;
  eventId: string;
  eventType: string;
  status?: 'processing' | 'completed' | 'failed';
  response?: string;
  attempts?: number;
}

interface MockPaymentTxData {
  subscriptionId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  externalId: string;
}

vi.mock('@/lib/db', () => ({
  db: {
    billingIdempotency: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const item = memoryStore.get(where.key);
        return item ? { ...item } : null;
      }),
      create: vi.fn(async ({ data }: { data: MockIdempotencyData }) => {
        if (memoryStore.has(data.key)) {
          const err = new Error('Unique constraint failed on key') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const record = {
          id: `idem_${Date.now()}_${Math.random()}`,
          key: data.key,
          provider: data.provider,
          eventId: data.eventId,
          eventType: data.eventType,
          status: data.status || 'processing',
          response: data.response || '{}',
          attempts: data.attempts || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStore.set(data.key, record);
        return { ...record };
      }),
      update: vi.fn(async ({ where, data }: { where: { key: string }; data: { status?: 'processing' | 'completed' | 'failed'; response?: string; attempts?: { increment: number } } }) => {
        const item = memoryStore.get(where.key);
        if (!item) throw new Error(`Record with key ${where.key} not found`);
        if (data.status) item.status = data.status;
        if (data.response) item.response = data.response;
        if (data.attempts?.increment) item.attempts += data.attempts.increment;
        item.updatedAt = new Date();
        memoryStore.set(where.key, item);
        return { ...item };
      }),
    },
    paymentTransaction: {
      findFirst: vi.fn(async ({ where }: { where: { subscriptionId?: string; externalId?: string; status?: string } }) => {
        for (const tx of paymentTransactions.values()) {
          if (where.subscriptionId && tx.subscriptionId !== where.subscriptionId) continue;
          if (where.externalId && tx.externalId !== where.externalId) continue;
          if (where.status && tx.status !== where.status) continue;
          return { ...tx };
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: MockPaymentTxData }) => {
        // Enforce @@unique([paymentMethod, externalId])
        const compositeKey = `${data.paymentMethod}:${data.externalId}`;
        if (paymentTransactions.has(compositeKey)) {
          const err = new Error('Unique constraint failed on paymentMethod_externalId') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: `tx_${Date.now()}_${Math.random()}`,
          subscriptionId: data.subscriptionId,
          amount: data.amount,
          status: data.status,
          paymentMethod: data.paymentMethod,
          externalId: data.externalId,
        };
        paymentTransactions.set(compositeKey, row);
        return { ...row };
      }),
    },
  },
}));

describe('LOTE 2 — Database Constraints & Cron Billing Idempotency', () => {
  beforeEach(() => {
    memoryStore.clear();
    paymentTransactions.clear();
    vi.clearAllMocks();
  });

  describe('L2.1 & L2.2: PaymentTransaction Database Uniqueness', () => {
    it('should reject duplicate PaymentTransaction with same paymentMethod and externalId', async () => {
      const { db } = await import('@/lib/db');

      // First insert succeeds
      const first = await (db as unknown as { paymentTransaction: { create: (q: { data: MockPaymentTxData }) => Promise<{ id: string }> } }).paymentTransaction.create({
        data: {
          subscriptionId: 'sub_123',
          amount: 247.0,
          status: 'RECEIVED',
          paymentMethod: 'asaas',
          externalId: 'pay_asaas_001',
        },
      });
      expect(first.id).toBeDefined();

      // Duplicate insert with same paymentMethod and externalId throws P2002
      await expect(
        (db as unknown as { paymentTransaction: { create: (q: { data: MockPaymentTxData }) => Promise<{ id: string }> } }).paymentTransaction.create({
          data: {
            subscriptionId: 'sub_123',
            amount: 247.0,
            status: 'RECEIVED',
            paymentMethod: 'asaas',
            externalId: 'pay_asaas_001',
          },
        })
      ).rejects.toThrow(/Unique constraint failed/);
    });

    it('should allow same externalId if paymentMethod differs (cross-gateway isolation)', async () => {
      const { db } = await import('@/lib/db');
      const dbTx = db as unknown as { paymentTransaction: { create: (q: { data: MockPaymentTxData }) => Promise<{ id: string }> } };

      const asaasTx = await dbTx.paymentTransaction.create({
        data: {
          subscriptionId: 'sub_123',
          amount: 247.0,
          status: 'RECEIVED',
          paymentMethod: 'asaas',
          externalId: 'tx_shared_id_999',
        },
      });

      const mpTx = await dbTx.paymentTransaction.create({
        data: {
          subscriptionId: 'sub_456',
          amount: 197.0,
          status: 'approved',
          paymentMethod: 'mercadopago',
          externalId: 'tx_shared_id_999',
        },
      });

      expect(asaasTx.id).toBeDefined();
      expect(mpTx.id).toBeDefined();
      expect(asaasTx.id).not.toBe(mpTx.id);
    });
  });

  describe('L2.3 & L2.4: Deterministic Cron Monthly Billing Idempotency', () => {
    it('should build correct deterministic canonical key for monthly billing', () => {
      const key = buildIdempotencyKey({
        provider: 'asaas',
        eventId: 'monthly-billing:tenant_abc:2026-09',
        eventType: 'cron.monthly_invoice',
        status: 'issued',
      });

      expect(key).toBe('webhook:asaas:monthly-billing:tenant_abc:2026-09:cron.monthly_invoice:issued');
    });

    it('should execute handler exactly once and deduplicate subsequent calls in the same billing cycle', async () => {
      const mockAsaasApi = vi.fn().mockResolvedValue({
        id: 'pay_asaas_monthly_001',
        invoiceUrl: 'https://sandbox.asaas.com/i/monthly_001',
        value: 247.0,
      });

      // 1st Execution (e.g. Cron triggered at 03:00)
      const res1 = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_hotel_1:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi()
      );

      expect(res1.success).toBe(true);
      expect(res1.deduplicated).toBe(false);
      expect(res1.data?.id).toBe('pay_asaas_monthly_001');
      expect(mockAsaasApi).toHaveBeenCalledTimes(1);

      // 2nd Execution (e.g. Cron retry at 03:05 or manual trigger)
      const res2 = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_hotel_1:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi()
      );

      expect(res2.success).toBe(true);
      expect(res2.deduplicated).toBe(true);
      expect(res2.data?.id).toBe('pay_asaas_monthly_001');
      // Handler was NOT called again — zero double billing!
      expect(mockAsaasApi).toHaveBeenCalledTimes(1);
    });

    it('should maintain strict isolation across different billing months for the same tenant', async () => {
      const mockAsaasApi = vi.fn().mockImplementation((month: string) =>
        Promise.resolve({
          id: `pay_asaas_${month}`,
          invoiceUrl: `https://sandbox.asaas.com/i/${month}`,
        })
      );

      // August billing
      const resAug = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_hotel_1:2026-08',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi('2026-08')
      );

      // September billing
      const resSep = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_hotel_1:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi('2026-09')
      );

      expect(resAug.deduplicated).toBe(false);
      expect(resSep.deduplicated).toBe(false);
      expect(resAug.data?.id).toBe('pay_asaas_2026-08');
      expect(resSep.data?.id).toBe('pay_asaas_2026-09');
      expect(mockAsaasApi).toHaveBeenCalledTimes(2);
    });

    it('should maintain strict isolation across different tenants in the same billing cycle', async () => {
      const mockAsaasApi = vi.fn().mockImplementation((tenantId: string) =>
        Promise.resolve({
          id: `pay_asaas_${tenantId}`,
          invoiceUrl: `https://sandbox.asaas.com/i/${tenantId}`,
        })
      );

      // Tenant A
      const resA = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_A:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi('tenant_A')
      );

      // Tenant B
      const resB = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_B:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => mockAsaasApi('tenant_B')
      );

      expect(resA.deduplicated).toBe(false);
      expect(resB.deduplicated).toBe(false);
      expect(resA.data?.id).toBe('pay_asaas_tenant_A');
      expect(resB.data?.id).toBe('pay_asaas_tenant_B');
      expect(mockAsaasApi).toHaveBeenCalledTimes(2);
    });

    it('should allow legitimate retry if previous execution failed with error', async () => {
      let attempt = 0;
      const unreliableAsaasApi = vi.fn().mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Asaas API 503 Service Unavailable');
        }
        return {
          id: 'pay_asaas_recovered_001',
          invoiceUrl: 'https://sandbox.asaas.com/i/recovered_001',
        };
      });

      // 1st Attempt fails
      await expect(
        executeWithBillingIdempotency(
          {
            provider: 'asaas',
            eventId: 'monthly-billing:tenant_fail:2026-09',
            eventType: 'cron.monthly_invoice',
            status: 'issued',
          },
          async () => unreliableAsaasApi()
        )
      ).rejects.toThrow('Asaas API 503 Service Unavailable');

      // Verify failure was recorded in idempotency store
      const key = buildIdempotencyKey({
        provider: 'asaas',
        eventId: 'monthly-billing:tenant_fail:2026-09',
        eventType: 'cron.monthly_invoice',
        status: 'issued',
      });
      expect(memoryStore.get(key)?.status).toBe('failed');

      // 2nd Attempt succeeds (retry)
      const resRetry = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_fail:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => unreliableAsaasApi()
      );

      expect(resRetry.success).toBe(true);
      expect(resRetry.deduplicated).toBe(false);
      expect(resRetry.data?.id).toBe('pay_asaas_recovered_001');
      expect(memoryStore.get(key)?.status).toBe('completed');
    });

    it('should handle concurrent in-progress executions without duplicate billing', async () => {
      // Simulate slow external API
      const slowAsaasApi = vi.fn(async () => {
        return { id: 'pay_slow_001' };
      });

      // Manually place record in 'processing' state
      const key = buildIdempotencyKey({
        provider: 'asaas',
        eventId: 'monthly-billing:tenant_concurrent:2026-09',
        eventType: 'cron.monthly_invoice',
        status: 'issued',
      });
      memoryStore.set(key, {
        id: 'idem_concurrent',
        key,
        provider: 'asaas',
        eventId: 'monthly-billing:tenant_concurrent:2026-09',
        eventType: 'cron.monthly_invoice',
        status: 'processing',
        response: '{}',
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date(), // fresh, not stale
      });

      const res = await executeWithBillingIdempotency(
        {
          provider: 'asaas',
          eventId: 'monthly-billing:tenant_concurrent:2026-09',
          eventType: 'cron.monthly_invoice',
          status: 'issued',
        },
        async () => slowAsaasApi()
      );

      expect(res.success).toBe(true);
      expect(res.deduplicated).toBe(true);
      expect(res.inProgress).toBe(true);
      expect(res.status).toBe('processing');
      expect(slowAsaasApi).not.toHaveBeenCalled();
    });
  });
});
