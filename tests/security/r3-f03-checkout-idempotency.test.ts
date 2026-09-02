import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  idem: new Map<string, { key: string; status: string; response: string; attempts: number; updatedAt: Date }>(),
  tenants: new Map<string, { id: string; email: string; status: string }>(),
  subscriptionCreates: 0,
  paymentCreates: 0,
}));

const mockDb = vi.hoisted(() => ({
  billingIdempotency: {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => state.idem.get(where.key) ?? null),
    create: vi.fn(async ({ data }: { data: { key: string; response: string; attempts: number } }) => {
      if (state.idem.has(data.key)) {
        const error = new Error('unique');
        (error as Error & { code?: string }).code = 'P2002';
        throw error;
      }
      const record = { ...data, status: 'processing', updatedAt: new Date() };
      state.idem.set(data.key, record);
      return record;
    }),
    update: vi.fn(async ({ where, data }: { where: { key: string }; data: Record<string, unknown> }) => {
      const current = state.idem.get(where.key)!;
      const next = { ...current, ...data, updatedAt: new Date() };
      if (data.attempts && typeof data.attempts === 'object' && 'increment' in data.attempts) next.attempts += Number((data.attempts as { increment: number }).increment);
      state.idem.set(where.key, next);
      return next;
    }),
  },
  tenant: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email) return state.tenants.get(where.email) ?? null;
      return { id: where.id, email: 'owner@example.com', status: 'active' };
    }),
    create: vi.fn(async ({ data }: { data: { email: string } }) => {
      const tenant = { id: `tenant_${state.tenants.size + 1}`, email: data.email, status: 'pending' };
      state.tenants.set(data.email, tenant);
      return tenant;
    }),
  },
  property: { create: vi.fn().mockResolvedValue({ id: 'property_1' }) },
  subscription: {
    findUnique: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      ++state.subscriptionCreates;
      const id = data.id || `sub_${state.subscriptionCreates}`;
      return { id, amount: data.amount || 197, paymentMethod: data.paymentMethod || 'pix', planType: data.planType || 'pro', paymentId: null, checkoutUrl: null, metadata: '{}' };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      return { id: where.id, amount: 197, paymentMethod: 'pix', planType: 'pro', paymentId: data.paymentId || null, checkoutUrl: data.checkoutUrl || null, metadata: data.metadata || '{}' };
    }),
  },
  paymentTransaction: {
    create: vi.fn(async () => ({ id: `payment_${++state.paymentCreates}` })),
    findFirst: vi.fn(async () => null),
  },
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/rate-limit', () => ({ authRatelimit: { limit: vi.fn().mockResolvedValue({ success: true }) } }));
vi.mock('@/lib/observability/latency-tracker', () => ({ measureLatency: vi.fn((_name: string, fn: () => unknown) => fn()) }));
vi.mock('@/lib/db/concurrency', () => ({ withAdvisoryLock: vi.fn((_key: string, fn: () => unknown) => fn()) }));
vi.mock('@/lib/payments/pricing', () => ({
  isMethodAllowed: vi.fn().mockReturnValue(true),
  getPrice: vi.fn().mockImplementation((planType: string) => ({ amount: planType === 'max' ? 497 : 197 })),
}));
vi.mock('@/lib/payments/gateway-factory', () => ({
  getDefaultGateway: vi.fn().mockReturnValue({
    id: 'mock',
    isConfigured: () => true,
    createPayment: vi.fn(async () => ({ gatewayPaymentId: `gw_payment_1`, status: 'pending', gateway: 'mock', checkoutUrl: 'http://checkout.test' })),
  }),
  getGateway: vi.fn(),
}));

import { POST } from '@/app/api/checkout/create/route';

describe('R3-F03 checkout idempotency', () => {
  beforeEach(() => {
    state.idem.clear();
    state.tenants.clear();
    state.subscriptionCreates = 0;
    state.paymentCreates = 0;
    // Reset mock call counts without clearing implementations
    mockDb.billingIdempotency.findUnique.mockClear();
    mockDb.billingIdempotency.create.mockClear();
    mockDb.billingIdempotency.update.mockClear();
    mockDb.tenant.findUnique.mockClear();
    mockDb.tenant.create.mockClear();
    mockDb.subscription.findUnique.mockClear();
    mockDb.subscription.create.mockClear();
    mockDb.subscription.update.mockClear();
    mockDb.paymentTransaction.create.mockClear();
    mockDb.paymentTransaction.findFirst.mockClear();
  });

  const request = (overrides: Record<string, unknown> = {}, key = 'checkout-key-1') => new NextRequest('http://localhost/api/checkout/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-idempotency-key': key },
    body: JSON.stringify({
      name: 'Hotel Teste',
      email: 'owner@example.com',
      propertyName: 'Hotel Teste',
      niche: 'pousada',
      planType: 'pro',
      paymentMethod: 'pix',
      ...overrides,
    }),
  });

  it('replays the completed checkout without creating a second subscription', async () => {
    const first = await POST(request());
    const firstBody = await first.json();
    const second = await POST(request());
    const secondBody = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(secondBody.data.subscriptionId).toBe(firstBody.data.subscriptionId);
    expect(state.subscriptionCreates).toBe(1);
    expect(state.paymentCreates).toBe(1);
  });

  it('rejects reuse of the same key with a different request payload', async () => {
    const first = await POST(request());
    expect(first.status).toBe(201);

    const replayWithDifferentAmountInputs = await POST(request({ planType: 'max' }));
    expect(replayWithDifferentAmountInputs.status).toBe(409);
    const body = await replayWithDifferentAmountInputs.json();
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    expect(state.subscriptionCreates).toBe(1);
  });

  it('keeps unauthenticated onboarding inside the idempotent operation', async () => {
    const first = await POST(request());
    const second = await POST(request());

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(state.tenants.size).toBe(1);
    expect(state.subscriptionCreates).toBe(1);
  });
});
