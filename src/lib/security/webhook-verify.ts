import crypto from 'crypto';

export interface WebhookVerificationResult { valid: boolean; reason?: string; timestamp?: string; }

const MP_MAX_SKEW_MS = 5 * 60 * 1000;
const MP_MAX_FUTURE_MS = 60 * 1000;
const MIN_SECRET_LENGTH = 32;

function safeEqualHex(received: string, expected: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex')); } catch { return false; }
}
function safeEqualText(received: string, expected: string): boolean {
  const a = Buffer.from(received, 'utf8'); const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}
function strongSecret(secret: string): boolean { return secret.length >= MIN_SECRET_LENGTH; }

export function verifyWhatsAppWebhook(rawBody: string, signatureHeader: string | null, appSecret?: string): WebhookVerificationResult {
  const secret = appSecret || process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE' };
  if (!secret) return { valid: false, reason: 'MISSING_APP_SECRET' };
  if (process.env.NODE_ENV === 'production' && !strongSecret(secret)) return { valid: false, reason: 'WEAK_APP_SECRET' };
  if (signatureHeader.length !== 71 || !signatureHeader.startsWith('sha256=')) return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(signatureHeader.slice(7), expectedHash) ? { valid: true } : { valid: false, reason: 'SIGNATURE_MISMATCH' };
}

export function verifyMercadoPagoWebhook(rawBody: string, signatureHeader: string | null, webhookSecret: string, resourceId?: string, requestId?: string): WebhookVerificationResult {
  if (!webhookSecret) return { valid: false, reason: 'MISSING_WEBHOOK_SECRET' };
  if (process.env.NODE_ENV === 'production' && !strongSecret(webhookSecret)) return { valid: false, reason: 'WEAK_WEBHOOK_SECRET' };
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE' };
  if (process.env.NODE_ENV === 'production' && (!resourceId || !requestId)) return { valid: false, reason: 'MISSING_MANIFEST_IDENTIFIERS' };
  const parts = signatureHeader.split(',').map(part => part.trim());
  const ts = parts.find(p => p.startsWith('ts='))?.slice(3) || '';
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3) || '';
  if (!ts || !v1 || !/^\d+$/.test(ts)) return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  const timestampMs = Number(ts) * 1000;
  if (!Number.isSafeInteger(timestampMs)) return { valid: false, reason: 'INVALID_TIMESTAMP' };
  const age = Date.now() - timestampMs;
  if (age > MP_MAX_SKEW_MS || age < -MP_MAX_FUTURE_MS) return { valid: false, reason: 'SIGNATURE_EXPIRED' };
  const manifest = `id:${resourceId || ''};request-id:${requestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
  return safeEqualHex(v1, expected) ? { valid: true, timestamp: ts } : { valid: false, reason: 'SIGNATURE_MISMATCH' };
}

export function verifySyncSecret(receivedSecret: string | null, expectedSecret: string): WebhookVerificationResult {
  if (!receivedSecret) return { valid: false, reason: 'MISSING_SECRET' };
  if (!expectedSecret) return { valid: false, reason: 'MISSING_CONFIG' };
  if (process.env.NODE_ENV === 'production' && !strongSecret(expectedSecret)) return { valid: false, reason: 'WEAK_CONFIGURED_SECRET' };
  return safeEqualText(receivedSecret, expectedSecret) ? { valid: true } : { valid: false, reason: 'SECRET_MISMATCH' };
}

export function validateWebhookTenant(payloadPhoneNumber: string | undefined, resolvedTenantId: string | null): WebhookVerificationResult {
  if (!payloadPhoneNumber) return { valid: false, reason: 'MISSING_PHONE' };
  if (!resolvedTenantId) return { valid: false, reason: 'TENANT_NOT_FOUND' };
  return { valid: true };
}
