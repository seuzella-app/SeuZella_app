/**
 * Alexa Rate Limit + Replay Protection
 * ============================================================================
 *
 * SECURITY for /api/alexa/smart-home endpoint:
 *   1. Rate limit: 60 requests/min per tenantId (prevents abuse)
 *   2. Replay protection: track used JTI (JWT ID) — same token cannot be
 *      used twice within 5 minutes
 *
 * WHY: Alexa sends directives via webhook. Without replay protection, an
 * attacker who captures a directive could replay it (e.g. unlock a door
 * hours after the legitimate command). Without rate limit, a malicious
 * skill could DoS the lock provider APIs.
 *
 * ARCHITECTURE
 * ------------
 * In-memory for now (single Vercel instance). For multi-instance, swap
 * the Map for Redis (same pattern as tenant-pubsub.ts).
 */

import { logger } from '@/lib/logger';

const ALEXA_RATE_LIMIT_PER_MIN = 60;
const ALEXA_REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const rateLimitCounts = new Map<string, { count: number; windowStart: number }>();
const usedJtis = new Map<string, number>(); // jti → expiry timestamp

/**
 * Check rate limit for an Alexa directive caller (tenantId).
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkAlexaRateLimit(tenantId: string): {
  allowed: boolean;
  retryAfterMs?: number;
  remaining?: number;
} {
  const now = Date.now();
  const entry = rateLimitCounts.get(tenantId);

  if (!entry || now - entry.windowStart > 60_000) {
    rateLimitCounts.set(tenantId, { count: 1, windowStart: now });
    return { allowed: true, remaining: ALEXA_RATE_LIMIT_PER_MIN - 1 };
  }

  if (entry.count >= ALEXA_RATE_LIMIT_PER_MIN) {
    const retryAfterMs = 60_000 - (now - entry.windowStart);
    logger.warn('[ALEXA_RATE_LIMIT] blocked', { tenantId, count: entry.count });
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, remaining: ALEXA_RATE_LIMIT_PER_MIN - entry.count };
}

/**
 * Check if a JWT has already been used (replay attack detection).
 * If jti is missing, returns false (caller should reject — JTIs are required).
 *
 * @param jti JWT ID from the verified token
 * @returns true if JTI was already seen within the replay window
 */
export function isReplay(jti: string | undefined): boolean {
  if (!jti) return false; // Missing JTI — caller must reject separately
  const now = Date.now();

  // Prune expired JTIs (do this lazily on each call to avoid a separate timer)
  for (const [key, expiry] of usedJtis) {
    if (expiry < now) usedJtis.delete(key);
  }

  return usedJtis.has(jti);
}

/**
 * Mark a JTI as used. Call this AFTER a directive is processed successfully
 * to prevent replay.
 */
export function markJtiUsed(jti: string): void {
  if (!jti) return;
  usedJtis.set(jti, Date.now() + ALEXA_REPLAY_WINDOW_MS);
}

/**
 * Validate that the JWT payload has all required Alexa fields.
 * Returns { valid: true } or { valid: false, reason }.
 */
export function validateAlexaJwtPayload(payload: {
  sub?: string;
  tenantId?: string;
  scope?: string;
  jti?: string;
  iat?: number;
}): { valid: boolean; reason?: string } {
  if (!payload.sub || typeof payload.sub !== 'string') {
    return { valid: false, reason: 'MISSING_SUB' };
  }
  if (!payload.tenantId || typeof payload.tenantId !== 'string') {
    return { valid: false, reason: 'MISSING_TENANT_ID' };
  }
  if (!payload.scope || payload.scope !== 'smart_home:locks') {
    return { valid: false, reason: 'INVALID_SCOPE' };
  }
  if (!payload.jti || typeof payload.jti !== 'string') {
    return { valid: false, reason: 'MISSING_JTI' };
  }
  // iat must be within the last 5 minutes (clock skew tolerance)
  if (typeof payload.iat !== 'number') {
    return { valid: false, reason: 'MISSING_IAT' };
  }
  const ageMs = Date.now() - payload.iat * 1000;
  if (ageMs > ALEXA_REPLAY_WINDOW_MS) {
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }
  if (ageMs < -60_000) {
    return { valid: false, reason: 'TOKEN_FROM_FUTURE' };
  }
  return { valid: true };
}

/**
 * Reset all rate-limit and replay state. Test-only.
 */
export function __resetAlexaSecurityForTests(): void {
  rateLimitCounts.clear();
  usedJtis.clear();
}
