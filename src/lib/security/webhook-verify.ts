import crypto from 'crypto';

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
  timestamp?: string;
}

function safeEqualHex(received: string, expected: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function safeEqualText(received: string, expected: string): boolean {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

export function verifyWhatsAppWebhook(rawBody: string, signatureHeader: string | null, appSecret?: string): WebhookVerificationResult {
  const secret = appSecret || process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE: No hub.signature header' };
  if (!secret) return { valid: false, reason: 'MISSING_APP_SECRET: META_APP_SECRET / WHATSAPP_APP_SECRET not configured' };
  if (!signatureHeader.startsWith('sha256=')) return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Expected sha256= prefix' };

  const receivedHash = signatureHeader.slice(7);
  const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(receivedHash, expectedHash)
    ? { valid: true }
    : { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed' };
}

export function verifyMercadoPagoWebhook(rawBody: string, signatureHeader: string | null, webhookSecret: string): WebhookVerificationResult {
  if (!webhookSecret) return { valid: false, reason: 'MISSING_WEBHOOK_SECRET: MP_WEBHOOK_SECRET not configured' };
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE: No x-signature header' };

  const parts = signatureHeader.split(',');
  const ts = parts.find(p => p.startsWith('ts='))?.slice(3) || '';
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3) || '';
  if (!ts || !v1 || !/^\d+$/.test(ts)) return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Missing or malformed ts/v1' };

  const timestampMs = Number(ts) * 1000;
  if (!Number.isSafeInteger(timestampMs)) return { valid: false, reason: 'INVALID_TIMESTAMP: Timestamp out of range' };

  // Reject both stale and implausibly future signatures to close replay/time-skew gaps.
  const age = Date.now() - timestampMs;
  if (age > 300_000 || age < -60_000) return { valid: false, reason: 'SIGNATURE_EXPIRED: Webhook timestamp outside accepted window' };

  const expected = crypto.createHmac('sha256', webhookSecret).update(`id:${ts};request:`).update(rawBody).digest('hex');
  return safeEqualHex(v1, expected)
    ? { valid: true, timestamp: ts }
    : { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed' };
}

export function verifySyncSecret(receivedSecret: string | null, expectedSecret: string): WebhookVerificationResult {
  if (!receivedSecret) return { valid: false, reason: 'MISSING_SECRET: No X-Sync-Secret header' };
  if (!expectedSecret) return { valid: false, reason: 'MISSING_CONFIG: CALENDAR_SYNC_SECRET not configured' };
  return safeEqualText(receivedSecret, expectedSecret)
    ? { valid: true }
    : { valid: false, reason: 'SECRET_MISMATCH: Sync secret verification failed' };
}

export function validateWebhookTenant(payloadPhoneNumber: string | undefined, resolvedTenantId: string | null): WebhookVerificationResult {
  if (!payloadPhoneNumber) return { valid: false, reason: 'MISSING_PHONE: No phone number in webhook payload' };
  if (!resolvedTenantId) return { valid: false, reason: 'TENANT_NOT_FOUND: No tenant resolved for phone number' };
  return { valid: true };
}
