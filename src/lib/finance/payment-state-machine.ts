/**
 * ============================================================================
 * 💳 PAYMENT STATE MACHINE — Máquina de Estados Financeira Imutável
 * ============================================================================
 *
 * Princípio:
 * Pagamentos são modelados como uma State Machine formal, nunca como um
 * simples campo de texto.
 *
 * Regras Estritas:
 * 1. Transições permitidas avançam o ciclo de vida.
 * 2. Transições proibidas (ex: webhook atrasado PAID tentando reverter um
 *    REFUNDED ou CANCELLED) são rejeitadas com erro tipado e auditadas.
 * ============================================================================
 */

import { logger } from '@/lib/logger';

export type PaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'CHARGEBACK';

// Matriz canônica de transições válidas
const VALID_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  CREATED: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
  PENDING: ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'ACTIVE', 'REFUNDED', 'CHARGEBACK'],
  CONFIRMED: ['ACTIVE', 'REFUNDED', 'CHARGEBACK'],
  ACTIVE: ['REFUNDED', 'CHARGEBACK'],
  // Estados terminais / pós-resolução — proibido voltar para PAID/ACTIVE
  FAILED: ['PENDING'], // Permitido retry de pagamento
  CANCELLED: [],
  REFUNDED: [],
  EXPIRED: ['PENDING'], // Permitida reemissão de cobrança
  CHARGEBACK: [],
};

export class InvalidStateTransitionError extends Error {
  public fromState: PaymentState;
  public toState: PaymentState;
  public paymentId?: string;

  constructor(fromState: PaymentState, toState: PaymentState, paymentId?: string) {
    super(`Transição de estado financeira inválida: [${fromState}] -> [${toState}] para o pagamento ${paymentId || 'N/A'}`);
    this.name = 'InvalidStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.paymentId = paymentId;
  }
}

export interface StateTransitionResult {
  allowed: boolean;
  from: PaymentState;
  to: PaymentState;
  isIdempotentNoop: boolean;
  error?: string;
}

/**
 * Valida e autoriza uma transição na Payment State Machine.
 */
export function validatePaymentTransition(
  currentStatus: string,
  targetStatus: string,
  paymentId?: string
): StateTransitionResult {
  const current = (currentStatus || 'CREATED').toUpperCase() as PaymentState;
  const target = targetStatus.toUpperCase() as PaymentState;

  // Idempotência: mesmo estado recebido novamente (ex: webhook duplicate)
  if (current === target) {
    return {
      allowed: true,
      from: current,
      to: target,
      isIdempotentNoop: true,
    };
  }

  const allowedTargets = VALID_TRANSITIONS[current] || [];
  const isAllowed = allowedTargets.includes(target);

  if (!isAllowed) {
    logger.warn('[PAYMENT_STATE_MACHINE] Tentativa de transição de estado proibida bloqueada', {
      paymentId,
      currentStatus: current,
      targetStatus: target,
    });

    return {
      allowed: false,
      from: current,
      to: target,
      isIdempotentNoop: false,
      error: `Transição proibida: [${current}] não pode mudar para [${target}].`,
    };
  }

  return {
    allowed: true,
    from: current,
    to: target,
    isIdempotentNoop: false,
  };
}
