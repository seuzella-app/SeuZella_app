import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const dbInstance = {
    billingIdempotency: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'sub_new_123' }),
    },
    user: {
      create: vi.fn().mockResolvedValue({ id: 'user_new_123' }),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'tenant_new_123' }),
    },
    paymentTransaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'prop_new_123' }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit_new_123' }),
    },
  };
  return { mockDb: dbInstance };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/email-sender', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/notifications/bridges', () => ({
  bridgePaymentEvent: vi.fn(),
  bridgeSecurityAlert: vi.fn(),
}));

import {
  buildIdempotencyKey,
  executeWithBillingIdempotency,
} from '@/lib/payments/idempotency';
import { POST as paymentWebhookPost } from '@/app/api/webhooks/payment/route';
import { POST as checkoutWebhookPost } from '@/app/api/checkout/webhook/route';

describe('C6: Billing Idempotency & Concurrency Shield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Scenario 1: Canonical Key Construction
  it('1. builds deterministic canonical key with sanitized components', () => {
    const key1 = buildIdempotencyKey({
      provider: 'asaas',
      eventId: 'pay_123456',
      eventType: 'payment.created',
      status: 'approved',
    });
    expect(key1).toBe('webhook:asaas:pay_123456:payment.created:approved');

    const key2 = buildIdempotencyKey({
      provider: 'mercadopago',
      eventId: '99887766',
      eventType: 'payment.updated',
    });
    expect(key2).toBe('webhook:mercadopago:99887766:payment.updated');
  });

  // ── Scenario 2: First-time Successful Execution
  it('2. executes fresh webhook, records in-progress and completes successfully', async () => {
    mockDb.billingIdempotency.findUnique.mockResolvedValue(null);
    mockDb.billingIdempotency.create.mockResolvedValue({
      id: 'idem_1',
      key: 'webhook:asaas:pay_fresh_1:payment.created',
      status: 'processing',
      attempts: 1,
    });
    mockDb.billingIdempotency.update.mockResolvedValue({
      id: 'idem_1',
      status: 'completed',
    });

    const handler = vi.fn().mockResolvedValue({ tenantId: 'tenant_123', status: 'created' });

    const result = await executeWithBillingIdempotency(
      {
        provider: 'asaas',
        eventId: 'pay_fresh_1',
        eventType: 'payment.created',
      },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(false);
    expect(result.status).toBe('completed');
    expect(result.data).toEqual({ tenantId: 'tenant_123', status: 'created' });

    // Verify DB lifecycle
    expect(mockDb.billingIdempotency.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'webhook:asaas:pay_fresh_1:payment.created',
        status: 'processing',
        attempts: 1,
      }),
    });
    expect(mockDb.billingIdempotency.update).toHaveBeenCalledWith({
      where: { key: 'webhook:asaas:pay_fresh_1:payment.created' },
      data: expect.objectContaining({
        status: 'completed',
      }),
    });
  });

  // ── Scenario 3: Deduplication of Completed Webhook
  it('3. returns cached response on retry without executing handler again', async () => {
    const cachedResponse = { tenantId: 'tenant_cached', plan: 'pro' };

    mockDb.billingIdempotency.findUnique.mockResolvedValue({
      id: 'idem_cached',
      key: 'webhook:asaas:pay_dup_1:payment.created',
      status: 'completed',
      response: JSON.stringify(cachedResponse),
      attempts: 1,
      updatedAt: new Date(),
    });

    const handler = vi.fn();

    const result = await executeWithBillingIdempotency(
      {
        provider: 'asaas',
        eventId: 'pay_dup_1',
        eventType: 'payment.created',
      },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.data).toEqual(cachedResponse);
    expect(mockDb.billingIdempotency.create).not.toHaveBeenCalled();
  });

  // ── Scenario 4: Concurrent Execution Collision (P2002 Unique Constraint)
  it('4. detects concurrent race condition via P2002 and safely deduplicates', async () => {
    mockDb.billingIdempotency.findUnique
      .mockResolvedValueOnce(null) // first check sees nothing
      .mockResolvedValueOnce({ // second check after P2002 finds in-progress record
        id: 'idem_concurrent',
        key: 'webhook:asaas:pay_race_1:payment.created',
        status: 'processing',
        attempts: 1,
        updatedAt: new Date(),
      });

    // Simulate Prisma Unique Constraint Violation
    const p2002Error = new Error('Unique constraint failed on key');
    (p2002Error as unknown as { code: string }).code = 'P2002';
    mockDb.billingIdempotency.create.mockRejectedValue(p2002Error);

    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await executeWithBillingIdempotency(
      {
        provider: 'asaas',
        eventId: 'pay_race_1',
        eventType: 'payment.created',
      },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.deduplicated).toBe(true);
    expect(result.inProgress).toBe(true);
    expect(result.status).toBe('processing');
  });

  // ── Scenario 5: Event Isolation (Different Event Types for Same Payment)
  it('5. isolates different event types for the same payment ID into distinct idempotency records', () => {
    const keyCreated = buildIdempotencyKey({
      provider: 'asaas',
      eventId: 'pay_shared_id',
      eventType: 'payment.created',
      status: 'approved',
    });

    const keyCanceled = buildIdempotencyKey({
      provider: 'asaas',
      eventId: 'pay_shared_id',
      eventType: 'subscription.canceled',
      status: 'canceled',
    });

    expect(keyCreated).not.toBe(keyCanceled);
    expect(keyCreated).toContain('payment.created');
    expect(keyCanceled).toContain('subscription.canceled');
  });

  // ── Scenario 6: Provider Isolation (Asaas vs Mercado Pago)
  it('6. isolates different payment providers using identical external IDs', () => {
    const keyAsaas = buildIdempotencyKey({
      provider: 'asaas',
      eventId: 'ext_123',
      eventType: 'payment.updated',
    });

    const keyMP = buildIdempotencyKey({
      provider: 'mercadopago',
      eventId: 'ext_123',
      eventType: 'payment.updated',
    });

    expect(keyAsaas).not.toBe(keyMP);
    expect(keyAsaas).toBe('webhook:asaas:ext_123:payment.updated');
    expect(keyMP).toBe('webhook:mercadopago:ext_123:payment.updated');
  });

  // ── Scenario 7: Retry After Failed Operation (Fail-Closed Recovery)
  it('7. allows retry when previous operation status was failed', async () => {
    mockDb.billingIdempotency.findUnique.mockResolvedValue({
      id: 'idem_failed',
      key: 'webhook:asaas:pay_fail_1:payment.created',
      status: 'failed',
      attempts: 1,
      updatedAt: new Date(),
    });
    mockDb.billingIdempotency.update.mockResolvedValue({
      id: 'idem_failed',
      status: 'completed',
    });

    const handler = vi.fn().mockResolvedValue({ recovered: true });

    const result = await executeWithBillingIdempotency(
      {
        provider: 'asaas',
        eventId: 'pay_fail_1',
        eventType: 'payment.created',
      },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(false);
    expect(result.status).toBe('completed');
    expect(mockDb.billingIdempotency.update).toHaveBeenCalledWith({
      where: { key: 'webhook:asaas:pay_fail_1:payment.created' },
      data: { status: 'processing', attempts: { increment: 1 }, response: expect.any(String) },
    });
  });

  // ── Scenario 8: Stale In-Flight Execution Recovery
  it('8. recovers and retries if in-progress record is older than 2 minutes', async () => {
    const staleDate = new Date(Date.now() - 150000); // 2.5 minutes ago
    mockDb.billingIdempotency.findUnique.mockResolvedValue({
      id: 'idem_stale',
      key: 'webhook:asaas:pay_stale_1:payment.created',
      status: 'processing',
      attempts: 1,
      updatedAt: staleDate,
    });
    mockDb.billingIdempotency.update.mockResolvedValue({
      id: 'idem_stale',
      status: 'completed',
    });

    const handler = vi.fn().mockResolvedValue({ recoveredFromStale: true });

    const result = await executeWithBillingIdempotency(
      {
        provider: 'asaas',
        eventId: 'pay_stale_1',
        eventType: 'payment.created',
      },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(false);
    expect(result.status).toBe('completed');
  });

  // ── Scenario 9: Payment Webhook Route End-to-End Idempotency
  it('9. deduplicates incoming POST to /api/webhooks/payment when already processed', async () => {
    const cachedProvisioning = {
      tenantId: 'tenant_e2e_cached',
      planTier: 'parceiro',
      niche: 'pousada',
      isNewTenant: false,
    };

    mockDb.billingIdempotency.findUnique.mockResolvedValue({
      id: 'idem_route_e2e',
      key: 'webhook:asaas:pay_e2e_123:payment.created:approved',
      status: 'completed',
      response: JSON.stringify(cachedProvisioning),
      attempts: 1,
      updatedAt: new Date(),
    });

    const payload = {
      event: 'payment.created',
      paymentId: 'pay_e2e_123',
      status: 'approved',
      amount: 247,
      metadata: {
        customerName: 'Hotel Teste',
        niche: 'pousada',
      },
    };

    const req = new NextRequest('http://localhost/api/webhooks/payment', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await paymentWebhookPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.deduplicated).toBe(true);
    expect(body.provisioning).toEqual(cachedProvisioning);
    // Tenant must NOT be created again
    expect(mockDb.tenant.create).not.toHaveBeenCalled();
  });

  // ── Scenario 10: Checkout Webhook Route End-to-End Idempotency
  it('10. deduplicates incoming POST to /api/checkout/webhook when already updated', async () => {
    mockDb.billingIdempotency.findUnique.mockResolvedValue({
      id: 'idem_mp_e2e',
      key: 'webhook:mercadopago:mp_payment_888:payment.updated:approved',
      status: 'completed',
      response: JSON.stringify({ updated: true, paymentId: 'mp_payment_888', status: 'approved' }),
      attempts: 1,
      updatedAt: new Date(),
    });

    mockDb.paymentTransaction.findFirst.mockResolvedValue({
      id: 'tx_mp_1',
      externalId: 'mp_payment_888',
      subscriptionId: 'sub_mp_1',
      amount: 197,
    });

    const payload = {
      action: 'payment.updated',
      data: { id: 'mp_payment_888' },
    };

    // Mock MP API lookup
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'approved' }),
    } as unknown as Response);

    process.env.MP_ACCESS_TOKEN = 'test_token_mp';

    try {
      const req = new NextRequest('http://localhost/api/checkout/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await checkoutWebhookPost(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.received).toBe(true);
      expect(body.deduplicated).toBe(true);
      // DB subscription update should NOT be re-executed
      expect(mockDb.subscription.update).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      delete process.env.MP_ACCESS_TOKEN;
    }
  });
});
