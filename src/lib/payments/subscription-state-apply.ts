/**
 * ============================================================================
 * SUBSCRIPTION STATE APPLY — dono ÚNICO da aplicação de status de pagamento
 * (MISSÃO RBW — Fases C+D)
 * ============================================================================
 *
 * Cadeia canônica (Fase C):
 *   Gateway Provider → Provider Webhook → Signature Verification
 *   → Event Idempotency → Canonical Payment Event → Payment State Machine
 *   → Subscription State → Tenant Activation
 *
 * Antes havia 3+ donos escrevendo subscription+tenant diretamente:
 *   1. process-webhook.ts (asaas/mercadopago) — já validava transição;
 *   2. checkout/webhook (Mercado Pago legacy) — escrevia direto, sem máquina;
 *   3. webhooks/payment (status update + provision) — escrevia direto, sem
 *      máquina, com campos divergentes.
 * Agora TODOS delegam a applySubscriptionPaymentStatus(): única porta de
 * mutação de subscription/tenant por evento de pagamento, com validação
 * determinística da máquina de estados existente (payment-state-machine.ts —
 * NÃO criamos uma segunda máquina financeira).
 *
 * Mapeamento canônico de status (Fase D) — provider → PaymentStatus:
 *   asaas:        PENDING/AWAITING_RISK_ANALYSIS → pending · RECEIVED/
 *                 CONFIRMED/RECEIVED_IN_CASH → approved · OVERDUE → expired ·
 *                 REFUNDED* → refunded · CHARGEBACK* → chargeback ·
 *                 DUNNING_REQUESTED → pending · restante → pending
 *   mercadopago:  pending/in_process → pending · approved/authorized →
 *                 approved · rejected/cancelled → rejected · refunded/
 *                 charged_back → refunded
 * (os providers já normalizam em parseWebhookEvent; esta tabela é a fonte
 *  de referência e o fallback para eventos crus legados.)
 * ============================================================================
 */

import { validatePaymentWebhookTransition } from './webhook-transition';
import type { PaymentStatus } from './types';

export type CanonicalPaymentStatus = PaymentStatus | 'chargeback' | 'expired';

interface ProviderStatusMap {
  [raw: string]: CanonicalPaymentStatus;
}

const ASAAS_STATUS_MAP: ProviderStatusMap = {
  PENDING: 'pending',
  AWAITING_RISK_ANALYSIS: 'pending',
  DUNNING_REQUESTED: 'pending',
  RECEIVED: 'approved',
  CONFIRMED: 'approved',
  RECEIVED_IN_CASH: 'approved',
  OVERDUE: 'expired',
  REFUNDED: 'refunded',
  REFUND_REQUESTED: 'refunded',
  CHARGEBACK_REQUESTED: 'chargeback',
  CHARGEBACK_DISPUTE: 'chargeback',
  CHARGEBACK_REVERSED: 'chargeback',
};

const MERCADOPAGO_STATUS_MAP: ProviderStatusMap = {
  PENDING: 'pending',
  IN_PROCESS: 'pending',
  APPROVED: 'approved',
  AUTHORIZED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'rejected',
  REFUNDED: 'refunded',
  CHARGED_BACK: 'chargeback',
};

export function normalizeProviderStatus(
  provider: 'asaas' | 'mercadopago' | string,
  rawStatus: string,
): CanonicalPaymentStatus {
  const map = provider === 'mercadopago' ? MERCADOPAGO_STATUS_MAP : ASAAS_STATUS_MAP;
  const normalized = String(rawStatus || '').trim().toUpperCase();
  return map[normalized] ?? 'pending';
}

export interface ApplySubscriptionPaymentStatusInput {
  subscriptionId: string;
  tenantId: string;
  /**
   * INFORMATIVO desde a v2: o plano autoritativo é o `planType` lido do
   * banco DENTRO da transação (o webhook nunca é autoridade de plano —
   * mesma lição da Fase A: cliente/metadata não escolhe plano). Divergência
   * é logada e o DB vence.
   */
  planTier: string;
  canonicalStatus: CanonicalPaymentStatus;
  gateway: string;
  gatewayPaymentId?: string | null;
  /**
   * INFORMATIVO desde a v2 (compat com callers): a validação de transição
   * usa o `paymentStatus` lido do banco dentro da tx (autoridade).
   */
  currentPaymentStatus?: string | null;
  /** Já rodou dentro de transação? (sim — caller fornece tx) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contrato mínimo intencional: aceita Prisma.TransactionClient e mocks de teste
  tx: {
    subscription: {
      findUnique: (args: any) => Promise<SubscriptionTxState | null>;
      update: (args: any) => Promise<unknown>;
    };
    tenant: { update: (args: any) => Promise<unknown> };
  };
}

/** Estado mínimo lido do banco dentro da tx (autoridade do replay/período). */
interface SubscriptionTxState {
  id: string;
  tenantId?: string;
  planType?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
}

/** Duração do período de aprovação — coerente com o provisionamento canônico
 * (provisionNewCustomer usa +1 mês de calendário; contrato de billing mensal).
 * NÃO é a condição de 24 meses do PARCEIRO (que é contratual, não de período). */
export function nextMonthlyPeriodEnd(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export interface ApplySubscriptionPaymentStatusResult {
  applied: boolean;
  reason: string;
  transition: 'accepted' | 'rejected' | 'idempotent_noop';
}

/**
 * Único executor de mutação subscription+tenant por evento de pagamento.
 *
 * RBW v2 (correção da auditoria do kit v1 — item 3.2):
 *  - O estado é lido do banco DENTRO da tx (autoridade) — distinção
 *    determinística entre aprovação FRESCA e REPLAY;
 *  - Aprovação fresca escreve os campos financeiros completos (período mensal
 *    + plano), preservando a semântica que existia nos caminhos antigos;
 *  - REPLAY (já active+approved) é NO-OP TOTAL: nada é escrito, o período
 *    NUNCA é estendido (1x aplica · 2x no-op · 10x no-op);
 *  - Estados fora de ordem são REJEITADOS pela máquina (nunca regridem);
 *  - REFUNDED/CHARGEBACK permanecem terminais (nunca reativam).
 */
export async function applySubscriptionPaymentStatus(
  input: ApplySubscriptionPaymentStatusInput,
): Promise<ApplySubscriptionPaymentStatusResult> {
  const { tx, canonicalStatus, subscriptionId, tenantId, planTier, gateway, gatewayPaymentId } = input;

  // RBW v2: estado autoritativo lido DENTRO da transação do caller.
  const sub = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, tenantId: true, planType: true, status: true, paymentStatus: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  if (!sub) {
    return { applied: false, reason: 'SUBSCRIPTION_NOT_FOUND', transition: 'rejected' };
  }

  // RBW v2.1: o caller NÃO escolhe o tenant alvo.
  // A subscription é a autoridade do relacionamento.
  // Divergência = FAIL-CLOSED e ZERO WRITES.
  if (!sub.tenantId || (tenantId && tenantId !== sub.tenantId)) {
    return {
      applied: false,
      reason: 'SUBSCRIPTION_TENANT_MISMATCH',
      transition: 'rejected',
    };
  }

  // A partir daqui, qualquer escrita em tenant usa SOMENTE
  // o tenant autoritativo derivado da subscription.
  const authoritativeTenantId = sub.tenantId;

  // Autoridade de plano = banco. metadata/planTier divergente é logado e
  // IGNORADO (o webhook não escolhe plano — mesma lição da Fase A).
  const planAuthority = sub.planType || planTier;
  if (planTier && sub.planType && String(planTier) !== String(sub.planType)) {
    console.warn(
      `[SUBSCRIPTION_STATE_APPLY] planTier informado (${planTier}) diverge do DB (${sub.planType}) — DB é autoridade (sub=${subscriptionId})`,
    );
  }

  // Fase D: validação determinística de transição (payment-state-machine.ts)
  // usando o paymentStatus REAL do banco. Assinatura sem estado prévio
  // (recém-criada) entra direto pelo switch abaixo.
  if (sub.paymentStatus) {
    const transition = validatePaymentWebhookTransition(
      sub.paymentStatus,
      canonicalStatus as string,
    );
    if (!transition.accepted) {
      return { applied: false, reason: transition.reason || 'TRANSITION_REJECTED', transition: 'rejected' };
    }
  }

  switch (canonicalStatus) {
    case 'approved': {
      // ── RBW v2: REPLAY GUARD (antes de QUALQUER escrita) ──────────────────
      // Já ativa+aprovada ⇒ evento duplicado/fora de ordem tardio: NO-OP.
      // O período existente NUNCA é reescrito/estendido por replay.
      if (sub.status === 'active' && sub.paymentStatus === 'approved') {
        return { applied: false, reason: 'ALREADY_ACTIVE_APPROVED', transition: 'idempotent_noop' };
      }

      // Aprovação FRESCA: escreve os campos financeiros COMPLETOS (semântica
      // que os caminhos antigos — success/legacy — faziam e a v1 perdeu).
      const periodStart = new Date();
      const periodEnd = nextMonthlyPeriodEnd(periodStart);
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'active',
          paymentStatus: 'approved',
          paymentId: gatewayPaymentId ?? undefined,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
      await tx.tenant.update({
        where: { id: authoritativeTenantId },
        data: { plan: planAuthority, status: 'active', subscriptionAt: new Date() },
      });
      break;
    }
    case 'pending':
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { paymentStatus: 'pending', paymentId: gatewayPaymentId ?? undefined },
      });
      break;
    case 'rejected':
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { paymentStatus: 'rejected', paymentId: gatewayPaymentId ?? undefined },
      });
      break;
    case 'cancelled':
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'cancelled',
          paymentStatus: 'cancelled',
          paymentId: gatewayPaymentId ?? undefined,
          cancelAtPeriodEnd: true,
        },
      });
      break;
    case 'refunded':
      // REFUNDED é terminal — NUNCA reativa acesso (máquina financeira).
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { paymentStatus: 'refunded', paymentId: gatewayPaymentId ?? undefined },
      });
      break;
    case 'expired':
    case 'chargeback':
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { paymentStatus: canonicalStatus, paymentId: gatewayPaymentId ?? undefined },
      });
      break;
    default:
      return { applied: false, reason: `UNHANDLED_STATUS:${canonicalStatus}`, transition: 'rejected' };
  }

  void gateway; // observabilidade futura (correlation), não muta estado
  void planTier; // informativo — autoridade de plano é o DB (planAuthority)
  return { applied: true, reason: 'applied', transition: 'accepted' };
}
