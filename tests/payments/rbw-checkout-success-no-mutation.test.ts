/**
 * ============================================================================
 * RBW v2 · TESTE CRÍTICO DE ATIVAÇÃO (item 6 da missão + item 3.1)
 * ============================================================================
 * PROVA: /api/checkout/success NÃO é autoridade financeira.
 *
 *   1. subscription pending  + GET success  → continua pending, tenant não
 *      ativa, NENHUM período criado/estendido (zero writes);
 *   2. rejected + GET success               → não ativa (zero writes);
 *   3. WEBHOOK APPROVED (dono único)        → active + approved + tenant
 *      ativo + plano correto + período correto;
 *   4. REPLAY do success (active+approved)  → NO-OP total (nenhum campo
 *      financeiro muda — a rota não escreve nada);
 *   5. assinatura de OUTRO tenant           → bloqueada (forbidden);
 *   6. assinatura adulterada (sig errada)   → bloqueada (invalid_signature).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession: { user: { id?: string; email?: string; tenantId?: string } | null } = { user: null };

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => (mockSession.user ? { user: mockSession.user } : null)),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/env', () => ({ getNextAuthSecret: () => 'rbw-v2-test-secret' }));

const dbMock: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, {
    get(_t, prop: string) {
      if (!dbMock[prop]) dbMock[prop] = {};
      return dbMock[prop];
    },
  }),
}));

vi.mock('@/lib/infra/wiring', () => ({
  guardRequest: vi.fn(() => null),
  auditRouteEvent: vi.fn(),
}));

vi.mock('@/lib/credits/engine', () => ({
  registerConversion: vi.fn(async () => ({ ok: true })),
}));

import { GET } from '@/app/api/checkout/success/route';
import { applySubscriptionPaymentStatus } from '@/lib/payments/subscription-state-apply';
import { signCheckoutSubscription } from '@/lib/payments/checkout-signature';

const SECRET = 'rbw-v2-test-secret';
const successUrl = (subId: string, sig?: string) =>
  new NextRequest(
    `http://localhost/api/checkout/success?subscription_id=${encodeURIComponent(subId)}&sig=${encodeURIComponent(sig ?? signCheckoutSubscription(subId, SECRET))}`,
  );

function subRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    tenantId: 'tenant_A',
    planType: 'parceiro',
    status: 'pending',
    paymentStatus: 'pending',
    amount: 247,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    ...overrides,
  };
}

describe('RBW v2 · CHECKOUT SUCCESS NÃO É AUTORIDADE FINANCEIRA', () => {
  let subUpdate: ReturnType<typeof vi.fn>;
  let tenantUpdate: ReturnType<typeof vi.fn>;
  let propertyCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = { id: 'u_1', email: 'a@b.com', tenantId: 'tenant_A' };
    subUpdate = vi.fn(async () => ({}));
    tenantUpdate = vi.fn(async () => ({}));
    propertyCreate = vi.fn(async () => ({}));
    dbMock.subscription = { findUnique: vi.fn(async () => subRow()), update: subUpdate };
    dbMock.tenant = { findUnique: vi.fn(async () => ({ id: 'tenant_A', email: 'a@b.com' })), update: tenantUpdate };
    dbMock.property = { count: vi.fn(async () => 0), create: propertyCreate };
  });

  it('1. PENDING + GET success → continua pending, ZERO mutações, redirect payment=pending', async () => {
    const res = await GET(successUrl('sub_1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('payment=pending');
    expect(subUpdate).not.toHaveBeenCalled();
    expect(tenantUpdate).not.toHaveBeenCalled();
    expect(propertyCreate).not.toHaveBeenCalled();
  });

  it('2. REJECTED + GET success → não ativa (zero writes), redirect payment=rejected', async () => {
    dbMock.subscription.findUnique = vi.fn(async () => subRow({ status: 'pending', paymentStatus: 'rejected' }));
    const res = await GET(successUrl('sub_1'));
    expect(res.headers.get('location')).toContain('payment=rejected');
    expect(subUpdate).not.toHaveBeenCalled();
    expect(tenantUpdate).not.toHaveBeenCalled();
  });

  it('3. WEBHOOK APPROVED (dono único) → ativa com plano/período corretos', async () => {
    // tx fake representando a aprovação canônica pelo webhook
    let state = subRow();
    const tx = {
      subscription: {
        findUnique: vi.fn(async () => ({ ...state })),
        update: vi.fn(async (args: any) => { state = { ...state, ...args.data }; return {}; }),
      },
      tenant: { update: vi.fn(async (args: any) => { Object.assign(state, {}); return {}; }) },
    };
    const result = await applySubscriptionPaymentStatus({
      subscriptionId: 'sub_1',
      tenantId: 'tenant_A',
      planTier: 'parceiro',
      canonicalStatus: 'approved',
      gateway: 'asaas',
      gatewayPaymentId: 'gw_1',
      tx: tx as unknown as Parameters<typeof applySubscriptionPaymentStatus>[0]['tx'],
    });
    expect(result.applied).toBe(true);
    expect(state.status).toBe('active');
    expect(state.paymentStatus).toBe('approved');
    expect(state.currentPeriodStart).toBeInstanceOf(Date);
    expect(state.currentPeriodEnd).toBeInstanceOf(Date);
    expect(tx.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plan: 'parceiro', status: 'active' }),
    }));
  });

  it('4. REPLAY do success após ativação → NO-OP, nenhum campo financeiro muda', async () => {
    const originalStart = new Date('2026-01-01T00:00:00.000Z');
    const originalEnd = new Date('2026-02-01T00:00:00.000Z');
    dbMock.subscription.findUnique = vi.fn(async () => subRow({
      status: 'active',
      paymentStatus: 'approved',
      currentPeriodStart: originalStart,
      currentPeriodEnd: originalEnd,
    }));
    const res = await GET(successUrl('sub_1'));
    expect(res.headers.get('location')).toContain('payment=success');
    expect(subUpdate).not.toHaveBeenCalled();
    expect(tenantUpdate).not.toHaveBeenCalled();
    // E o replay do APPLY também não estende período:
    const tx = {
      subscription: {
        findUnique: vi.fn(async () => subRow({ status: 'active', paymentStatus: 'approved', currentPeriodStart: originalStart, currentPeriodEnd: originalEnd })),
        update: vi.fn(async () => ({})),
      },
      tenant: { update: vi.fn(async () => ({})) },
    };
    const replay = await applySubscriptionPaymentStatus({
      subscriptionId: 'sub_1',
      tenantId: 'tenant_A',
      planTier: 'parceiro',
      canonicalStatus: 'approved',
      gateway: 'asaas',
      gatewayPaymentId: 'gw_1',
      tx: tx as unknown as Parameters<typeof applySubscriptionPaymentStatus>[0]['tx'],
    });
    expect(replay.transition).toBe('idempotent_noop');
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });

  it('5. assinatura de OUTRO tenant → bloqueada (forbidden, zero writes)', async () => {
    dbMock.subscription.findUnique = vi.fn(async () => subRow({ tenantId: 'tenant_B' }));
    const res = await GET(successUrl('sub_1'));
    expect(res.headers.get('location')).toContain('error=forbidden');
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it('6. assinatura adulterada (sig inválida) → bloqueada (invalid_signature, zero writes)', async () => {
    const res = await GET(successUrl('sub_1', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'));
    expect(res.headers.get('location')).toContain('error=invalid_signature');
    expect(subUpdate).not.toHaveBeenCalled();
    expect(dbMock.subscription.findUnique).not.toHaveBeenCalled();
  });
});
