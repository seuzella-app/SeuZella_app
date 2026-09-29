/**
 * RBW Fase T — reconciliation: detector PURO produz discrepâncias, nunca muta.
 */
import { describe, it, expect } from 'vitest';
import {
  detectReconciliationDiscrepancies,
  type SubscriptionRow,
  type TenantRow,
  type PaymentTransactionRow,
  type ReservationRow,
  type ReservationPaymentRow,
} from '@/lib/payments/reconciliation';

const base = {
  subscriptions: [] as SubscriptionRow[],
  tenants: [] as TenantRow[],
  paymentTransactions: [] as PaymentTransactionRow[],
  reservations: [] as ReservationRow[],
  reservationPayments: [] as ReservationPaymentRow[],
};

describe('RBW-T · detectReconciliationDiscrepancies', () => {
  it('PAID_TENANT_INACTIVE: pagamento aprovado + tenant suspenso', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      subscriptions: [{ id: 'sub_1', tenantId: 't_1', status: 'active', paymentStatus: 'approved' }],
      tenants: [{ id: 't_1', status: 'suspended' }],
      paymentTransactions: [{ id: 'tx_1', subscriptionId: 'sub_1', status: 'approved', externalId: 'gw_1' }],
    });
    expect(out.map(d => d.type)).toContain('PAID_TENANT_INACTIVE');
    expect(out[0].suggestedAction).not.toContain('automaticamente');
  });

  it('DUPLICATE_PAYMENT: duas aprovadas na mesma assinatura', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      subscriptions: [{ id: 'sub_1', tenantId: 't_1', status: 'active', paymentStatus: 'approved' }],
      tenants: [{ id: 't_1', status: 'active' }],
      paymentTransactions: [
        { id: 'tx_1', subscriptionId: 'sub_1', status: 'approved', externalId: 'gw_1' },
        { id: 'tx_2', subscriptionId: 'sub_1', status: 'approved', externalId: 'gw_2' },
      ],
    });
    expect(out.filter(d => d.type === 'DUPLICATE_PAYMENT')).toHaveLength(1);
  });

  it('ACTIVE_PAYMENT_INVALID: assinatura ativa sem aprovação nenhuma', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      subscriptions: [{ id: 'sub_1', tenantId: 't_1', status: 'active', paymentStatus: 'pending' }],
      tenants: [{ id: 't_1', status: 'active' }],
      paymentTransactions: [],
    });
    expect(out.map(d => d.type)).toContain('ACTIVE_PAYMENT_INVALID');
  });

  it('PAYMENT_WITHOUT_SUBSCRIPTION: transação órfã é high severity', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      tenants: [],
      paymentTransactions: [{ id: 'tx_x', subscriptionId: null, status: 'approved', externalId: 'gw_x' }],
    });
    const d = out.find(x => x.type === 'PAYMENT_WITHOUT_SUBSCRIPTION');
    expect(d?.severity).toBe('high');
  });

  it('REFUNDED_ACTIVE_ACCESS: reembolso terminal + acesso ativo', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      subscriptions: [{ id: 'sub_1', tenantId: 't_1', status: 'active', paymentStatus: 'refunded' }],
      tenants: [{ id: 't_1', status: 'active' }],
      paymentTransactions: [{ id: 'tx_1', subscriptionId: 'sub_1', status: 'refunded', externalId: 'gw_1' }],
    });
    expect(out.map(d => d.type)).toContain('REFUNDED_ACTIVE_ACCESS');
  });

  it('RESERVATION_PAID_NOT_CONFIRMED: reserva paga aguardando confirmação', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      reservations: [{ id: 'res_1', tenantId: 't_1', status: 'PENDING_PAYMENT' }],
      reservationPayments: [{ id: 'rp_1', reservationId: 'res_1', status: 'approved' }],
    });
    expect(out.map(d => d.type)).toContain('RESERVATION_PAID_NOT_CONFIRMED');
  });

  it('estado coerente → ZERO discrepâncias', () => {
    const out = detectReconciliationDiscrepancies({
      ...base,
      subscriptions: [{ id: 'sub_1', tenantId: 't_1', status: 'active', paymentStatus: 'approved' }],
      tenants: [{ id: 't_1', status: 'active' }],
      paymentTransactions: [{ id: 'tx_1', subscriptionId: 'sub_1', status: 'approved', externalId: 'gw_1' }],
      reservations: [{ id: 'res_1', tenantId: 't_1', status: 'CONFIRMED' }],
      reservationPayments: [{ id: 'rp_1', reservationId: 'res_1', status: 'approved' }],
    });
    expect(out).toHaveLength(0);
  });
});
