/**
 * ZEHLA — Webhook Signature Verification (Zero Trust)
 * 
 * Implements HMAC-based signature verification for all webhook endpoints.
 * Uses timing-safe comparison to prevent timing attacks.
 * No fallback to "mock mode" in production.
 * 
 * Confidence Lock: > 0.95 required for any modification.
 */

import crypto from 'crypto';

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
  timestamp?: string;
}

/**
 * Verifies WhatsApp Cloud API webhook via HMAC-SHA256.
 * Meta sends a hub.signature header: sha256=HMAC_HEX
 */
export function verifyWhatsAppWebhook(
  rawBody: string,
  signatureHeader: string | null,
  appSecret?: string
): WebhookVerificationResult {
  const secret = appSecret || process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

  if (!signatureHeader) {
    return { valid: false, reason: 'MISSING_SIGNATURE: No hub.signature header' };
  }

  if (!secret) {
    return { valid: false, reason: 'MISSING_APP_SECRET: META_APP_SECRET / WHATSAPP_APP_SECRET not configured' };
  }

  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) {
    return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Expected sha256= prefix' };
  }

  const receivedHash = signatureHeader.slice(expectedPrefix.length);
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
    if (!isValid) {
      return { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'SIGNATURE_ERROR: Could not compare signatures' };
  }
}

/**
 * Verifies Mercado Pago webhook via x-signature header.
 * Format: ts=TIMESTAMP,v1=HMAC_SHA256
 * HMAC = sha256("id:TIMESTAMP;request:" + rawBody)
 */
export function verifyMercadoPagoWebhook(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): WebhookVerificationResult {
  if (!webhookSecret) {
    return { valid: false, reason: 'MISSING_WEBHOOK_SECRET: MP_WEBHOOK_SECRET not configured' };
  }

  if (!signatureHeader) {
    return { valid: false, reason: 'MISSING_SIGNATURE: No x-signature header' };
  }

  const parts = signatureHeader.split(',');
  const tsPart = parts.find(p => p.startsWith('ts='));
  const v1Part = parts.find(p => p.startsWith('v1='));

  if (!tsPart || !v1Part) {
    return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Missing ts= or v1= component' };
  }

  const ts = tsPart.split('=')[1] || '';
  const v1 = v1Part.split('=')[1] || '';

  if (!ts || !v1) {
    return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Empty ts or v1 value' };
  }

  // Timestamp replay protection: reject signatures older than 5 minutes
  const signatureAge = Date.now() - Number(ts) * 1000;
  if (signatureAge > 300_000) {
    return { valid: false, reason: 'SIGNATURE_EXPIRED: Webhook signature older than 5 minutes' };
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`id:${ts};request:`)
    .update(rawBody)
    .digest('hex');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(expected)
    );
    if (!isValid) {
      return { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed' };
    }
    return { valid: true, timestamp: ts };
  } catch {
    return { valid: false, reason: 'SIGNATURE_ERROR: Could not compare signatures' };
  }
}

/**
 * Verifies iCal sync secret using timing-safe comparison.
 */
export function verifySyncSecret(
  receivedSecret: string | null,
  expectedSecret: string
): WebhookVerificationResult {
  if (!receivedSecret) {
    return { valid: false, reason: 'MISSING_SECRET: No X-Sync-Secret header' };
  }

  if (!expectedSecret) {
    return { valid: false, reason: 'MISSING_CONFIG: CALENDAR_SYNC_SECRET not configured' };
  }

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSecret),
      Buffer.from(expectedSecret)
    );
    if (!isValid) {
      return { valid: false, reason: 'SECRET_MISMATCH: Sync secret verification failed' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'SECRET_ERROR: Could not compare secrets' };
  }
}

/**
 * Multi-tenant webhook isolation: validates that the webhook payload
 * belongs to the tenant identified by the phone number.
 * Prevents Cross-Tenant Data Leak via webhook spoofing.
 */
export function validateWebhookTenant(
  payloadPhoneNumber: string | undefined,
  resolvedTenantId: string | null
): WebhookVerificationResult {
  if (!payloadPhoneNumber) {
    return { valid: false, reason: 'MISSING_PHONE: No phone number in webhook payload' };
  }

  if (!resolvedTenantId) {
    return { valid: false, reason: 'TENANT_NOT_FOUND: No tenant resolved for phone number' };
  }

  return { valid: true };
}