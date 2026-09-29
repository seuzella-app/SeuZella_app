/**
 * RBW Fases C+D (v2) — dono único de mutação de assinatura + máquina de estados.
 * v2: estado lido DENTRO da tx (autoridade), replay no-op NUNCA estende
 * período, períodos mensais escritos na aprovação fresca, plano com
 * autoridade do DB. Simulação local com tx fake; a máquina
 * (payment-state-machine) é a REAL.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  applySubscriptionPaymentStatus,
  normalizeProviderStatus,
  nextMonthlyPeriodEnd,
  type ApplySubscriptionPaymentStatusInput,
} from '@/lib/payments/subscription-state-apply';

interface SubState {
  id?: string;
  tenantId?: string;
  planType?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}

function fakeTx(sub: SubState = {}) {
  const subUpdates: Array<Record<string, unknown>> = [];
  const tenantUpdates: Array<Record<string, unknown>> = [];
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return {
    updates: { subUpdates, tenantUpdates },
    warnSpy,
    tx: {
      subscription: {
        findUnique: vi.fn(async () => ({
          id: 'sub_1',
          tenantId: 'tenant_1',
          planType: 'parceiro',
          status: 'pending',
          paymentStatus: 'pending',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          ...sub,
        })),
        update: vi.fn(async (args: any) => { subUpdates.push(args.data); return {}; }),
      },
      tenant: { update: vi.fn(async (args: any) => { tenantUpdates.push(args.data); return {}; }) },
    },
  };
}

function run(overrides: Partial<ApplySubscriptionPaymentStatusInput>, sub: SubState = {}) {
  const f = fakeTx(sub);
  const promise = applySubscriptionPaymentStatus({
    subscriptionId: 'sub_1',
    tenantId: 'tenant_1',
    planTier: 'parceiro',
    canonicalStatus: 'approved',
    gateway: 'asaas',
    gatewayPaymentId: 'gw_1',
    currentPaymentStatus: 'pending',
    ...overrides,
    tx: overrides.tx ?? (f.tx as unknown as ApplySubscriptionPaymentStatusInput['tx']),
  });
  return { ...f, promise };
}

describe('RBW-C+D · normalizeProviderStatus (mapa canônico Fase D)', () => {
  it('asaas: CONFIRMED/RECEIVED → approved; OVERDUE → expired; CHARGEBACK_* → chargeback', () => {
    expect(normalizeProviderStatus('asaas', 'CONFIRMED')).toBe('approved');
    expect(normalizeProviderStatus('asaas', 'RECEIVED')).toBe('approved');
    expect(normalizeProviderStatus('asaas', 'OVERDUE')).toBe('expired');
    expect(normalizeProviderStatus('asaas', 'CHARGEBACK_DISPUTE')).toBe('chargeback');
    expect(normalizeProviderStatus('asaas', 'PENDING')).toBe('pending');
  });

  it('mercadopago: approved/authorized → approved; charged_back → chargeback; rejected/cancelled → rejected', () => {
    expect(normalizeProviderStatus('mercadopago', 'AUTHORIZED')).toBe('approved');
    expect(normalizeProviderStatus('mercadopago', 'CHARGED_BACK')).toBe('chargeback');
    expect(normalizeProviderStatus('mercadopago', 'CANCELLED')).toBe('rejected');
    expect(normalizeProviderStatus('mercadopago', 'in_process')).toBe('pending');
  });

  it('status desconhecido → pending (conservador, nunca aprovado)', () => {
    expect(normalizeProviderStatus('asaas', 'STATUS_EXOTICO')).toBe('pending');
  });
});

describe('RBW v2 · nextMonthlyPeriodEnd (contrato mensal)', () => {
  it('+1 mês de calendário (coerente com provisionNewCustomer; NÃO é 24 meses)', () => {
    const start = new Date('2026-01-15T12:00:00.000Z');
    const end = nextMonthlyPeriodEnd(start);
    expect(end.getUTCMonth()).toBe(1); // fevereiro
    expect(end.getUTCDate()).toBe(15); // mesmo dia do mês seguinte
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe('RBW-C+D · applySubscriptionPaymentStatus (dono único)', () => {
  it('pending → approved: ativa assinatura + tenant com plano canônico', async () => {
    const { promise, updates, tx } = run({});
    const result = await promise;
    expect(result.applied).toBe(true);
    expect(result.transition).toBe('accepted');
    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(updates.subUpdates[0]).toMatchObject({ status: 'active', paymentStatus: 'approved', paymentId: 'gw_1' });
    expect(updates.tenantUpdates[0]).toMatchObject({ plan: 'parceiro', status: 'active' });
  });

  it('RBW v2 · aprovação FRESCA escreve período financeiro mensal completo', async () => {
    const { promise, updates } = run({});
    const before = Date.now();
    const result = await promise;
    const after = Date.now();
    expect(result.applied).toBe(true);
    const period = updates.subUpdates[0] as { currentPeriodStart: Date; currentPeriodEnd: Date };
    expect(period.currentPeriodStart).toBeInstanceOf(Date);
    expect(period.currentPeriodEnd).toBeInstanceOf(Date);
    expect((period.currentPeriodStart as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((period.currentPeriodStart as Date).getTime()).toBeLessThanOrEqual(after);
    expect((period.currentPeriodEnd as Date).getTime()).toBeGreaterThan(before);
  });

  it('RBW v2 · REPLAY (já active+approved): NO-OP — nada escrito, período NUNCA estendido', async () => {
    const originalStart = new Date('2026-01-01T00:00:00.000Z');
    const originalEnd = new Date('2026-02-01T00:00:00.000Z');
    const { promise, tx, updates } = run(
      { canonicalStatus: 'approved', currentPaymentStatus: 'approved' },
      { status: 'active', paymentStatus: 'approved', currentPeriodStart: originalStart, currentPeriodEnd: originalEnd },
    );
    const result = await promise;
    expect(result.applied).toBe(false);
    expect(result.transition).toBe('idempotent_noop');
    expect(result.reason).toBe('ALREADY_ACTIVE_APPROVED');
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(updates.subUpdates).toHaveLength(0);
  });

  it('RBW v2.1 · tenantId divergente do caller é FAIL-CLOSED e zero-write', async () => {
    const { promise, tx, updates } = run(
      { tenantId: 'tenant_errado', canonicalStatus: 'approved', currentPaymentStatus: 'pending' },
      { tenantId: 'tenant_autoritativo', status: 'pending', paymentStatus: 'pending' },
    );

    const result = await promise;

    expect(result.applied).toBe(false);
    expect(result.transition).toBe('rejected');
    expect(result.reason).toBe('SUBSCRIPTION_TENANT_MISMATCH');

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(updates.subUpdates).toHaveLength(0);
    expect(updates.tenantUpdates).toHaveLength(0);
  });

  it('RBW v2 · replay 2x e 10x consecutivos: todos no-op, período intacto', async () => {
    const originalEnd = new Date('2026-02-01T00:00:00.000Z');
    for (let i = 0; i < 10; i++) {
      const { promise, tx, updates } = run(
        { canonicalStatus: 'approved', currentPaymentStatus: 'approved' },
        { status: 'active', paymentStatus: 'approved', currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'), currentPeriodEnd: originalEnd },
      );
      const result = await promise;
      expect(result.transition).toBe('idempotent_noop');
      expect(tx.subscription.update).not.toHaveBeenCalled();
      expect(updates.subUpdates).toHaveLength(0);
    }
  });

  it('RBW v2 · autoridade de plano = DB: planTier divergente é ignorado (DB vence)', async () => {
    const { promise, updates, warnSpy } = run({ planTier: 'max' }, { planType: 'parceiro' });
    const result = await promise;
    expect(result.applied).toBe(true);
    expect(updates.tenantUpdates[0]).toMatchObject({ plan: 'parceiro' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('diverge do DB'));
  });

  it('FORA DE ORDEM: approved → pending é REJEITADO (estado nunca regride)', async () => {
    const { promise, tx } = run(
      { canonicalStatus: 'pending', currentPaymentStatus: 'approved' },
      { status: 'active', paymentStatus: 'approved' },
    );
    const result = await promise;
    expect(result.applied).toBe(false);
    expect(result.transition).toBe('rejected');
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('REFUNDED é terminal: refunded → approved NUNCA reativa acesso', async () => {
    const { promise, tx } = run(
      { canonicalStatus: 'approved', currentPaymentStatus: 'refunded' },
      { status: 'active', paymentStatus: 'refunded' },
    );
    const result = await promise;
    expect(result.applied).toBe(false);
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('approved → refunded aplica reembolso (sem mutação de tenant)', async () => {
    const { promise, updates, tx } = run(
      { canonicalStatus: 'refunded', currentPaymentStatus: 'approved' },
      { status: 'active', paymentStatus: 'approved' },
    );
    const result = await promise;
    expect(result.applied).toBe(true);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(updates.subUpdates[0]).toMatchObject({ paymentStatus: 'refunded' });
  });

  it('chargeback: PAID → CHARGEBACK é transição válida da máquina (normalize corrigido)', async () => {
    const { promise } = run(
      { canonicalStatus: 'chargeback', currentPaymentStatus: 'approved' },
      { status: 'active', paymentStatus: 'approved' },
    );
    const result = await promise;
    expect(result.applied).toBe(true);
  });

  it('expired: PENDING → CANCELLED (expired normaliza para cancelamento)', async () => {
    const { promise, updates } = run({ canonicalStatus: 'expired', currentPaymentStatus: 'pending' });
    const result = await promise;
    expect(result.applied).toBe(true);
    expect(updates.subUpdates[0]).toMatchObject({ paymentStatus: 'expired' });
  });

  it('rejected: pending → rejected aplica sem tocar tenant', async () => {
    const { promise, tx, updates } = run({ canonicalStatus: 'rejected', currentPaymentStatus: 'pending' });
    const result = await promise;
    expect(result.applied).toBe(true);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(updates.subUpdates[0]).toMatchObject({ paymentStatus: 'rejected' });
  });

  it('assinatura inexistente no DB → rejeitado (fail-closed, sem escrita)', async () => {
    const f = fakeTx();
    (f.tx.subscription.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await applySubscriptionPaymentStatus({
      subscriptionId: 'sub_fantasma',
      tenantId: 'tenant_1',
      planTier: 'pro',
      canonicalStatus: 'approved',
      gateway: 'asaas',
      gatewayPaymentId: 'gw_1',
      tx: f.tx as unknown as ApplySubscriptionPaymentStatusInput['tx'],
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('SUBSCRIPTION_NOT_FOUND');
    expect(f.tx.subscription.update).not.toHaveBeenCalled();
  });
});
