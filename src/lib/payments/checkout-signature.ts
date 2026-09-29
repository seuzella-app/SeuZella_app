/**
 * ============================================================================
 * PAYMENT CHECKOUT SIGNATURE — autoridade única de assinatura de checkout
 * (MISSÃO REAL-BUSINESS-WORKFLOW-HARDENING — Fase H)
 * ============================================================================
 *
 * Problema que esta lib fecha: /api/checkout/success exige
 * `subscription_id` + `sig` (HMAC-SHA256), mas o PRODUTOR (/api/checkout/create)
 * montava o successUrl SEM `sig` — o redirect de sucesso falhava sempre em
 * `invalid_signature`. Não removemos a assinatura (nunca): corrigimos o
 * produtor usando ESTA fonte canônica única (sign + verify no mesmo lugar).
 *
 * Regras:
 *  - Secret = getNextAuthSecret() (o mesmo já verificado pelo success).
 *  - Comparação SEMPRE timing-safe.
 *  - Sem logs do secret ou da assinatura.
 * ============================================================================
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { getNextAuthSecret } from '@/lib/env';

export function signCheckoutSubscription(subscriptionId: string, secret?: string): string {
  const key = secret || getNextAuthSecret();
  return createHmac('sha256', key).update(String(subscriptionId)).digest('hex');
}

export function verifyCheckoutSubscriptionSignature(
  subscriptionId: string,
  signature: string | null | undefined,
  secret?: string,
): boolean {
  if (!subscriptionId || !signature) return false;
  const expected = signCheckoutSubscription(subscriptionId, secret);
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Monta o successUrl canônico com `subscription_id` + `sig`. */
export function buildCheckoutSuccessUrl(baseUrl: string, subscriptionId: string, secret?: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/checkout/success?subscription_id=${encodeURIComponent(subscriptionId)}&sig=${encodeURIComponent(signCheckoutSubscription(subscriptionId, secret))}`;
}
