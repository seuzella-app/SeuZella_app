/**
 * ============================================================================
 * 💳 PAYMENT STATE MACHINE — Máquina de Estados Financeira Estrita
 * ============================================================================
 *
 * Implementa a máquina de estados canônica do Zélla:
 *   CREATED -> PENDING -> PAID -> CONFIRMED -> ACTIVE
 *
 * Estados de Exceção / Terminais:
 *   FAILED | CANCELLED | EXPIRED | REFUNDED | CHARGEBACK
 *
 * Regra Absoluta:
 * Rejeição determinística de transições proibidas (ex: REFUNDED -> ACTIVE).
 * ============================================================================
 */

import { logger } from '@/lib/logger';

export type PaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'CHARGEBACK';

/**
 * Matriz de transições permitidas
 */
export const VALID_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  CREATED: ['PENDING', 'CANCELLED', 'EXPIRED', 'FAILED'],
  PENDING: ['AUTHORIZED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'],
  AUTHORIZED: ['PAID', 'CANCELLED', 'EXPIRED', 'FAILED'],
  PAID: ['CONFIRMED', 'ACTIVE', 'REFUNDED', 'CHARGEBACK'],
  CONFIRMED: ['ACTIVE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED'],
  ACTIVE: ['REFUNDED', 'CHARGEBACK', 'EXPIRED'],
  FAILED: ['PENDING', 'CREATED'], // Permite nova tentativa
  CANCELLED: [],                  // Estado terminal
  EXPIRED: [],                    // Estado terminal
  REFUNDED: [],                   // Estado terminal — NUNCA reativa
  CHARGEBACK: [],                 // Estado terminal — NUNCA reativa
};

export interface StateTransitionResult {
  allowed: boolean;
  from: PaymentState;
  to: PaymentState;
  isIdempotentNoop: boolean;
  reason?: string;
  error?: string;
}

export interface TransitionParams {
  currentState: PaymentState | string;
  targetState: PaymentState | string;
  paymentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Valida e autoriza uma transição na Payment State Machine.
 * Suporta chamada posicional ou com objeto de parâmetros.
 */
export function validatePaymentTransition(
  paramsOrCurrent: TransitionParams | string,
  targetStatusArg?: string,
  paymentIdArg?: string
): StateTransitionResult {
  let currentStatus: string;
  let targetStatus: string;
  let paymentId: string | undefined;

  if (typeof paramsOrCurrent === 'object' && paramsOrCurrent !== null) {
    currentStatus = String(paramsOrCurrent.currentState || 'CREATED');
    targetStatus = String(paramsOrCurrent.targetState || 'PENDING');
    paymentId = paramsOrCurrent.paymentId;
  } else {
    currentStatus = String(paramsOrCurrent || 'CREATED');
    targetStatus = String(targetStatusArg || 'PENDING');
    paymentId = paymentIdArg;
  }

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
    const reason = `Transição proibida de ${current} para ${target}. Transições permitidas a partir de ${current}: [${allowedTargets.join(', ')}]`;
    logger.warn('[PAYMENT_STATE_MACHINE] Tentativa de transição de estado proibida bloqueada', {
      paymentId,
      currentStatus: current,
      targetStatus: target,
      reason,
    });

    return {
      allowed: false,
      from: current,
      to: target,
      isIdempotentNoop: false,
      reason,
      error: `Transição proibida: ${current} -> ${target}`,
    };
  }

  return {
    allowed: true,
    from: current,
    to: target,
    isIdempotentNoop: false,
  };
}
