import type { PaymentStatus } from './types';
import {
  assertPaymentTransition,
  normalizePaymentState,
  type PaymentLifecycleState,
} from './state-machine';

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

  try {
    assertPaymentTransition(current, incoming);
    return { accepted: true, nextState: incoming };
  } catch {
    return {
      accepted: false,
      reason: `OUT_OF_ORDER_OR_INVALID_TRANSITION:${current}->${incoming}`,
      nextState: current,
    };
  }
}
