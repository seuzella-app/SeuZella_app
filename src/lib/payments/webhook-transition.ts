import type { PaymentStatus } from './types';
import {
  validatePaymentTransition,
  type PaymentState,
} from '@/lib/finance/payment-state-machine';

export type PaymentLifecycleState = PaymentState;

export function normalizePaymentState(status: PaymentStatus | string | null | undefined): PaymentState {
  if (!status) return 'CREATED';
  const normalized = String(status).toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'PAID') return 'PAID';
  if (normalized === 'PENDING' || normalized === 'IN_PROGRESS') return 'PENDING';
  if (normalized === 'REJECTED' || normalized === 'FAILED') return 'FAILED';
  if (normalized === 'CANCELLED' || normalized === 'EXPIRED') return 'CANCELLED';
  if (normalized === 'REFUNDED') return 'REFUNDED';
  if (normalized === 'CONFIRMED' || normalized === 'ACTIVE') return 'CONFIRMED';
  // RBW Fase D: CHARGEBACK é estado real da máquina (terminal, nunca reativa) —
  // antes caía no default CREATED e a validação de transição de chargeback
  // ficava impossível.
  if (normalized === 'CHARGEBACK') return 'CHARGEBACK';
  return 'CREATED';
}

/**
 * Validates a gateway event against the domain state before persistence.
 * The webhook handler should record the raw event regardless of the result,
 * but only persist the returned state when accepted=true.
 */
export function validatePaymentWebhookTransition(
  currentStatus: PaymentStatus | string | null | undefined,
  incomingStatus: PaymentStatus | string,
): { accepted: true; nextState: PaymentLifecycleState } | { accepted: false; reason: string; nextState: PaymentLifecycleState } {
  const current = normalizePaymentState(currentStatus);
  const incoming = normalizePaymentState(incomingStatus);

  const result = validatePaymentTransition({
    currentState: current,
    targetState: incoming,
  });

  if (result.allowed) {
    return { accepted: true, nextState: incoming };
  } else {
    return {
      accepted: false,
      reason: result.reason || `OUT_OF_ORDER_OR_INVALID_TRANSITION:${current}->${incoming}`,
      nextState: current,
    };
  }
}
