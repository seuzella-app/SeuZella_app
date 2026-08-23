/**
 * SEU ZÉLLA — Checkout Security Engine
 * 
 * Gerador e validador de assinaturas HMAC para sessões de checkout e tokens anti-replay.
 */

import crypto from 'crypto';

const SECRET_KEY = process.env.NEXTAUTH_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || 'zella-checkout-fallback-secret-2026';

export function generateCheckoutSignature(subscriptionId: string, tenantId: string, timestamp: number): string {
  const payload = `${subscriptionId}:${tenantId}:${timestamp}`;
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('hex');
}

export function verifyCheckoutSignature(subscriptionId: string, tenantId: string, timestamp: number, signature: string): boolean {
  // Anti-replay: expiração em 30 minutos (1800000 ms)
  const now = Date.now();
  if (now - timestamp > 1800000) {
    return false;
  }

  const expected = generateCheckoutSignature(subscriptionId, tenantId, timestamp);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
