/**
 * SEU ZÉLLA — Checkout Security Engine
 *
 * Gerador e validador de assinaturas HMAC para sessões de checkout e tokens anti-replay.
 *
 * SEGURANÇA (P0 — fail-closed):
 * - O segredo vem EXCLUSIVAMENTE de configuração segura (NEXTAUTH_SECRET,
 *   com fallback operacional para PAYMENT_WEBHOOK_SECRET), validado pelo
 *   resolver canônico `src/lib/env` (≥ 32 caracteres, fail-closed).
 * - NÃO existe segredo hardcoded. Sem configuração válida, a geração falha
 *   (throw com mensagem que nunca expõe o valor do segredo) e a verificação
 *   retorna `false` (fail-closed), nunca `true`.
 * - Anti-replay: timestamps fora da janela de tolerância (passado expirado
 *   ou futuro) são rejeitados; timestamp inválido é rejeitado.
 * - Comparação sempre timing-safe, com pré-validação de formato/length da
 *   assinatura (64 hex = SHA-256) para não depender de exceção.
 */

import crypto from 'crypto';

import { getNextAuthSecret, requireProductionSecret } from '@/lib/env';

/** Janela anti-replay: 30 minutos (contrato preservado). */
const CHECKOUT_SIGNATURE_TOLERANCE_MS = 1_800_000;

/** Assinatura HMAC-SHA256 em hex = 64 caracteres. */
const SIGNATURE_HEX_LENGTH = 64;

/**
 * Resolve o segredo de assinatura de checkout a partir de configuração
 * segura, preservando a precedência histórica (NEXTAUTH_SECRET primeiro,
 * PAYMENT_WEBHOOK_SECRET como alternativa operacional).
 *
 * Erros propagados citam apenas o NOME da variável de ambiente — nunca o valor.
 */
function resolveCheckoutSecret(): string {
  if (process.env.NEXTAUTH_SECRET) {
    return getNextAuthSecret();
  }
  return requireProductionSecret('PAYMENT_WEBHOOK_SECRET');
}

export function generateCheckoutSignature(subscriptionId: string, tenantId: string, timestamp: number): string {
  const secret = resolveCheckoutSecret();
  const payload = `${subscriptionId}:${tenantId}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export function verifyCheckoutSignature(subscriptionId: string, tenantId: string, timestamp: number, signature: string): boolean {
  // Timestamp inválido → rejeitar (fail-closed).
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp) || timestamp <= 0) {
    return false;
  }

  // Anti-replay: fora da janela (expirado no passado OU futuro) → rejeitar.
  const now = Date.now();
  if (Math.abs(now - timestamp) > CHECKOUT_SIGNATURE_TOLERANCE_MS) {
    return false;
  }

  // Configuração ausente/fraca → fail-closed (nunca validar, nunca vazar segredo).
  let expected: string;
  try {
    expected = generateCheckoutSignature(subscriptionId, tenantId, timestamp);
  } catch {
    return false;
  }

  // Formato/length incompatível → rejeitar antes da comparação (evita throw
  // de timingSafeEqual por buffers de tamanhos diferentes).
  if (typeof signature !== 'string' || signature.length !== SIGNATURE_HEX_LENGTH || !/^[0-9a-f]+$/.test(signature)) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
