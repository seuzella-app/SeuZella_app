/**
 * ============================================================================
 * PAYMENT RECONCILIATION — detector de discrepâncias financeiras
 * (MISSÃO RBW — Fase T)
 * ============================================================================
 *
 * PRINCÍPIO ABSOLUTO: reconciliação PRIMEIRO PRODUZ DISCREPÂNCIA; NUNCA muta
 * estado automaticamente (nenhum write aqui). A correção é humana/policy.
 *
 * Discrepâncias detectadas (todas com evidência mínima, sem PII):
 *   PAID_TENANT_INACTIVE        — pagamento aprovado + tenant inativo
 *   ACTIVE_PAYMENT_INVALID      — tenant ativo + última transação não aprovada
 *   DUPLICATE_PAYMENT           — ≥2 transações aprovadas p/ a mesma assinatura
 *   PAYMENT_WITHOUT_SUBSCRIPTION — transação órfã (subscriptionId nulo/inexistente)
 *   RESERVATION_PAID_NOT_CONFIRMED — pagamento aprovado + reserva não CONFIRMED
 *   REFUNDED_ACTIVE_ACCESS      — reembolso terminal + acesso ativo
 *   OUT_OF_ORDER_STATE          — paymentStatus regride na máquina canônica
 * ============================================================================
 */

import type { CanonicalPaymentStatus } from '@/lib/payments/subscription-state-apply';
import { validatePaymentWebhookTransition } from '@/lib/payments/webhook-transition';

export type ReconciliationDiscrepancyType =
  | 'PAID_TENANT_INACTIVE'
  | 'ACTIVE_PAYMENT_INVALID'
  | 'DUPLICATE_PAYMENT'
  | 'PAYMENT_WITHOUT_SUBSCRIPTION'
  | 'RESERVATION_PAID_NOT_CONFIRMED'
  | 'REFUNDED_ACTIVE_ACCESS'
  | 'OUT_OF_ORDER_STATE';

export interface ReconciliationDiscrepancy {
  type: ReconciliationDiscrepancyType;
  severity: 'high' | 'medium';
  tenantId: string | null;
  subscriptionId?: string;
  reservationId?: string;
  paymentTransactionId?: string;
  externalId?: string;
  detail: string;
  /** Correção sugerida — SEM execução automática. */
  suggestedAction: string;
  detectedAt: string;
}

export interface SubscriptionRow {
  id: string;
  tenantId: string;
  status: string;
  paymentStatus: string | null;
}
export interface TenantRow {
  id: string;
  status: string;
}
export interface PaymentTransactionRow {
  id: string;
  subscriptionId: string | null;
  status: string;
  externalId: string | null;
}
export interface ReservationRow {
  id: string;
  tenantId: string;
  status: string;
}
export interface ReservationPaymentRow {
  id: string;
  reservationId: string;
  status: string;
}

/** True quando o acesso depende de assinatura paga (planos pagos). */
export function isPaidPlanStatus(subscriptionStatus: string): boolean {
  const s = String(subscriptionStatus || '').toLowerCase();
  return ['active', 'approved'].includes(s);
}

/**
 * Classificador PURO: recebe as linhas já coletadas e produz as discrepâncias.
 * Testável sem banco; o coletor (collectReconciliationDiscrepancies) apenas
 * alimenta esta função com dados reais.
 */
export function detectReconciliationDiscrepancies(input: {
  subscriptions: SubscriptionRow[];
  tenants: TenantRow[];
  paymentTransactions: PaymentTransactionRow[];
  reservations: ReservationRow[];
  reservationPayments?: ReservationPaymentRow[];
  now?: Date;
}): ReconciliationDiscrepancy[] {
  const now = (input.now ?? new Date()).toISOString();
  const out: ReconciliationDiscrepancy[] = [];
  const tenantById = new Map(input.tenants.map(t => [t.id, t]));
  const txBySubscription = new Map<string, PaymentTransactionRow[]>();

  for (const tx of input.paymentTransactions) {
    if (!tx.subscriptionId) {
      out.push({
        type: 'PAYMENT_WITHOUT_SUBSCRIPTION',
        severity: 'high',
        tenantId: null,
        paymentTransactionId: tx.id,
        externalId: tx.externalId ?? undefined,
        detail: `Transação ${tx.id} sem assinatura vinculada`,
        suggestedAction: 'Investir origem (checkout órfão) e vincular ou arquivar — NUNCA ativar acesso por transação órfã',
        detectedAt: now,
      });
      continue;
    }
    const list = txBySubscription.get(tx.subscriptionId) ?? [];
    list.push(tx);
    txBySubscription.set(tx.subscriptionId, list);
  }

  for (const sub of input.subscriptions) {
    const tenant = tenantById.get(sub.tenantId);
    const txs = txBySubscription.get(sub.id) ?? [];
    const approvedTxs = txs.filter(t => t.status === 'approved');

    // DUPLICATE_PAYMENT — 2+ aprovadas para a mesma assinatura
    if (approvedTxs.length > 1) {
      const ids = approvedTxs.map(t => t.externalId || t.id).join(', ');
      out.push({
        type: 'DUPLICATE_PAYMENT',
        severity: 'high',
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        detail: `${approvedTxs.length} transações aprovadas (${ids}) para a assinatura ${sub.id}`,
        suggestedAction: 'Auditar cobranças no gateway e estornar a(s) excedente(s) manualmente',
        detectedAt: now,
      });
    }

    // PAID_TENANT_INACTIVE — cobrança aprovada + tenant inativo
    if (approvedTxs.length > 0 && tenant && tenant.status !== 'active') {
      out.push({
        type: 'PAID_TENANT_INACTIVE',
        severity: 'high',
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        detail: `Pagamento aprovado (${approvedTxs[0].externalId || approvedTxs[0].id}) mas tenant ${tenant.status}`,
        suggestedAction: 'Revisar webhook perdido e reativar via fluxo canônico com evidência de pagamento',
        detectedAt: now,
      });
    }

    // ACTIVE_PAYMENT_INVALID — ativo sem aprovação correspondente
    if (isPaidPlanStatus(sub.status) && sub.paymentStatus !== 'approved' && approvedTxs.length === 0) {
      out.push({
        type: 'ACTIVE_PAYMENT_INVALID',
        severity: 'medium',
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        detail: `Assinatura ${sub.status}/${sub.paymentStatus} sem transação aprovada`,
        suggestedAction: 'Suspender acesso ou localizar a aprovação perdida antes de qualquer mutação',
        detectedAt: now,
      });
    }

    // REFUNDED_ACTIVE_ACCESS — reembolso terminal + acesso ativo
    const refundedTxs = txs.filter(t => t.status === 'refunded');
    if (refundedTxs.length > 0 && approvedTxs.length === 0 && isPaidPlanStatus(sub.status)) {
      out.push({
        type: 'REFUNDED_ACTIVE_ACCESS',
        severity: 'high',
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        detail: `Reembolso registrado (${refundedTxs[0].externalId || refundedTxs[0].id}) mas acesso ativo`,
        suggestedAction: 'Encerrar acesso conforme política de reembolso — decisão humana',
        detectedAt: now,
      });
    }

    // OUT_OF_ORDER_STATE — paymentStatus atual regride na máquina canônica
    if (sub.paymentStatus) {
      // Ex.: assinatura aprovada que recebeu estado anterior (pending) — a
      // máquina rejeitaria a transição de regressão; presença aqui indica
      // escrita fora do dono único (Fase C+D).
      const regressionProbe = validatePaymentWebhookTransition(sub.paymentStatus, 'pending' as CanonicalPaymentStatus);
      if (sub.paymentStatus === 'approved' && regressionProbe.accepted) {
        out.push({
          type: 'OUT_OF_ORDER_STATE',
          severity: 'medium',
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          detail: `Assinatura approved aceitaria regressão para pending — indica escrita fora do dono único`,
          suggestedAction: 'Auditar writers de subscription.paymentStatus; canalizar tudo por applySubscriptionPaymentStatus',
          detectedAt: now,
        });
      }
    }
  }

  // RESERVATION_PAID_NOT_CONFIRMED — pagamentos de reserva vivem em
  // reservation_payments (não em paymentTransaction).
  const reservationPayments = input.reservationPayments ?? [];
  const approvedByReservation = new Map<string, number>();
  for (const rp of reservationPayments) {
    if (rp.status === 'approved') {
      approvedByReservation.set(rp.reservationId, (approvedByReservation.get(rp.reservationId) ?? 0) + 1);
    }
  }
  for (const res of input.reservations) {
    const approvedCount = approvedByReservation.get(res.id) ?? 0;
    if (approvedCount > 0 && !['CONFIRMED', 'confirmed', 'REFUNDED', 'refunded', 'CANCELLED', 'cancelled', 'CHECKED_IN', 'checked_in', 'CHECKED_OUT', 'checked_out'].includes(res.status)) {
      out.push({
        type: 'RESERVATION_PAID_NOT_CONFIRMED',
        severity: 'high',
        tenantId: res.tenantId,
        reservationId: res.id,
        detail: `Pagamento aprovado da reserva mas status=${res.status}`,
        suggestedAction: 'Verificar webhook de reserva perdido e confirmar via fluxo canônico',
        detectedAt: now,
      });
    }
  }

  return out;
}

/**
 * Coletor (produção): busca as linhas no banco e delega ao classificador puro.
 * Somente leitura — nunca muta estado.
 */
export async function collectReconciliationDiscrepancies(): Promise<ReconciliationDiscrepancy[]> {
  const { db } = await import('@/lib/db');
  const subscriptions = await (db as any).subscription.findMany({
    select: { id: true, tenantId: true, status: true, paymentStatus: true },
  });
  const tenants = await (db as any).tenant.findMany({ select: { id: true, status: true } });
  const paymentTransactions = await (db as any).paymentTransaction.findMany({
    select: { id: true, subscriptionId: true, status: true, externalId: true },
  });
  const reservations = await (db as any).reservation.findMany({
    select: { id: true, tenantId: true, status: true },
  });
  const reservationPayments = await (db as any).$queryRaw<Array<{ id: string; reservation_id: string; status: string }>>`
    SELECT "id", "reservation_id", "status" FROM "reservation_payments"
  `.catch(() => [] as Array<{ id: string; reservation_id: string; status: string }>);
  return detectReconciliationDiscrepancies({
    subscriptions,
    tenants,
    paymentTransactions,
    reservations,
    reservationPayments: (reservationPayments as Array<{ id: string; reservation_id: string; status: string }>).map(rp => ({
      id: rp.id,
      reservationId: rp.reservation_id,
      status: rp.status,
    })),
  });
}
