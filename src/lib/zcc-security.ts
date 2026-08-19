// =============================================================================
// ZÉLLA Central Control — Security Gate V3 Shared Utility
// =============================================================================
// 6-Layer Protection for all /api/zcc/* routes:
// 1. Rate Limiting (5 req/IP per 15min window)
// 2. Master Key Header (X-ZCC-Master-Key)
// 3. Godmode Param (via URL ?godmode=)
// 4. Godmode Cookie with Nonce Rotation (anti-replay)
// 5. NextAuth Admin Email Verification
// 6. Silent Rejection (never reveal route exists)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ZCCAuditEntry {
  timestamp: string;
  ip: string;
  userAgent: string;
  method: 'header' | 'param' | 'cookie' | 'session' | 'denied';
  success: boolean;
  path: string;
}

export interface ZCCSecurityResult {
  allowed: boolean;
  response?: NextResponse;
  ip: string;
  auditEntry?: ZCCAuditEntry;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ZCC_GODMODE_TOKEN = (() => {
  const token = process.env.ZCC_GODMODE_TOKEN;
  if (!token) {
    // During Vercel build phase, use a throwaway random value (not used at runtime)
    if (process.env.NEXT_PHASE?.includes('build')) {
      return crypto.randomUUID();
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('[ZCC-SECURITY] ZCC_GODMODE_TOKEN env var is not set — godmode access layers are DISABLED in production (fail-closed)');
      return ''; // Empty string ensures godmode checks never match — safe fail-closed
    }
    // Dev mode: auto-generate a random token per process (NOT a predictable hardcoded string)
    const generated = crypto.randomUUID();
    console.warn('[ZCC-SECURITY] ZCC_GODMODE_TOKEN not set — generated random dev token:', generated, '(Set env var for predictable dev access)');
    return generated;
  }
  return token;
})();
const ZCC_GODMODE_COOKIE = 'zcc_godmode';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ACTIVE_NONCES = 500;
const NONCE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── In-Memory State (best-effort — resets on cold start in serverless) ────────

const rateLimiter = new Map<string, { count: number; windowStart: number }>();
const activeNonces = new Map<string, number>(); // nonce → createdAt timestamp

// ── Audit Log: agora persistido em DB (Passo 10 Hardening) ──────────────────
// Antes: auditLog[] em memória (perdia em cold start, limite 1000 entradas)
// Agora: persiste em ZccAuditLog table, sobrevive entre lambdas
// Mantemos cache in-memory para reads rápidos (last 100 entries)
const auditLogCache: ZCCAuditEntry[] = [];
const AUDIT_CACHE_SIZE = 100;

// ── Helper Functions ───────────────────────────────────────────────────────────

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
}

function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, createdAt] of activeNonces) {
    if (now - createdAt > NONCE_MAX_AGE_MS) {
      activeNonces.delete(nonce);
    }
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Periodic cleanup to prevent memory leak
  if (rateLimiter.size > 1000) {
    for (const [rateIp, entry] of rateLimiter) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimiter.delete(rateIp);
      }
    }
  }

  const entry = rateLimiter.get(ip);

  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimiter.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function addAuditEntry(entry: Omit<ZCCAuditEntry, 'timestamp'>): void {
  const fullEntry: ZCCAuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Cache in-memory (para reads rápidos)
  auditLogCache.push(fullEntry);
  if (auditLogCache.length > AUDIT_CACHE_SIZE) {
    auditLogCache.shift();
  }

  // Persistência em DB (fire-and-forget — não bloqueia o handler)
  // Em Vercel serverless, o DB write continua mesmo após HTTP response se
  // ainda há event loop ativo. Para garantir, podemos usar waitUntil.
  persistAuditEntry(fullEntry).catch((err) => {
    // Silent fail — audit log é best-effort, não pode derrubar o request
    console.error('[ZCC-AUDIT] Failed to persist:', err);
  });
}

/**
 * Persiste entrada de audit log no DB.
 * Em caso de erro de DB (ex: cold start), apenas loga — não bloqueia.
 */
async function persistAuditEntry(entry: ZCCAuditEntry): Promise<void> {
  try {
    // Lazy import para evitar circular dependency no boot
    const { db } = await import('@/lib/db');
    if (typeof db?.zccAuditLog?.create === 'function') {
      await db.zccAuditLog.create({
        data: {
          ip: entry.ip,
          userAgent: entry.userAgent || '',
          method: entry.method,
          success: entry.success,
          path: entry.path,
          deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || null,
          notes: null,
          // timestamp é default(now()) no schema
        },
      });
    }
  } catch (err) {
    // Em dev/test/CI sem DB real disponível, apenas loga
    if (process.env.NODE_ENV !== 'production' || process.env.CI === 'true') {
      console.warn('[ZCC-AUDIT] DB write failed (non-blocking in dev/test/CI):', err);
    } else {
      console.error('[ZCC-AUDIT] DB write failed:', err);
    }
  }
}

/**
 * Retorna audit log recente (cache in-memory + DB).
 * Em produção, faz query ao DB para histórico completo.
 */
export async function getZCCSecurityAuditLog(limit: number = 100): Promise<ZCCAuditEntry[]> {
  // Em produção, busca do DB (persistente)
  if (process.env.NODE_ENV === 'production') {
    try {
      const { db } = await import('@/lib/db');
      const entries = await db.zccAuditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: Math.min(Math.max(limit, 1), 500),
      });
      return entries.map(e => ({
        timestamp: e.timestamp.toISOString(),
        ip: e.ip,
        userAgent: e.userAgent,
        method: e.method as 'header' | 'param' | 'cookie' | 'session' | 'denied',
        success: e.success,
        path: e.path,
      }));
    } catch (err) {
      console.error('[ZCC-AUDIT] DB query failed, falling back to cache:', err);
      return [...auditLogCache];
    }
  }

  // Em dev, retorna cache (sem DB roundtrip)
  return [...auditLogCache];
}

/** Export rate limiter state for monitoring */
export function getZCCRateLimiterState() {
  return {
    activeIPs: rateLimiter.size,
    activeNonces: activeNonces.size,
    auditLogEntries: auditLogCache.length,
  };
}

// ── Main Security Gate Function ────────────────────────────────────────────────

/**
 * Verifies access to ZCC API routes using the full 6-layer Security Gate V3.
 *
 * @param request - The incoming NextRequest
 * @returns ZCCSecurityResult indicating whether access is allowed
 */
export async function verifyZCCAccess(request: NextRequest): Promise<ZCCSecurityResult> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent')?.slice(0, 100) || 'unknown';
  const pathname = request.nextUrl?.pathname || '/api/zcc/unknown';

  // ── NEXTAUTH_SECRET Validation ──
  // NO hardcoded fallback — missing secret always throws
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) throw new Error('NEXTAUTH_SECRET environment variable is required');

  // ── Dev bypass: allow unauthenticated access in development ──
  if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return { allowed: true, ip };
  }

  // ── Layer 1: Rate Limiting ──
  if (!checkRateLimit(ip)) {
    addAuditEntry({ ip, userAgent, method: 'denied', success: false, path: pathname });
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'zcc-api-rate-limit-exceeded',
      ip,
      path: pathname,
    }));

    return {
      allowed: false,
      ip,
      response: NextResponse.json(
        { error: 'Too many requests. Audit log dispatched.' },
        { status: 429 }
      ),
      auditEntry: { timestamp: new Date().toISOString(), ip, userAgent, method: 'denied', success: false, path: pathname },
    };
  }

  // ── Layer 2: Master Key Header (X-ZCC-Master-Key) ──
  const masterKey = request.headers.get('x-zcc-master-key');
  if (masterKey && process.env.ZCC_MASTER_KEY && masterKey === process.env.ZCC_MASTER_KEY) {
    addAuditEntry({ ip, userAgent, method: 'header', success: true, path: pathname });
    return { allowed: true, ip };
  }

  // ── Layer 3: Godmode Param (via URL) ──
  const godmodeParam = request.nextUrl?.searchParams?.get('godmode');
  if (ZCC_GODMODE_TOKEN && godmodeParam === ZCC_GODMODE_TOKEN) {
    cleanupExpiredNonces();

    const nonce = generateNonce();
    activeNonces.set(nonce, Date.now());

    if (activeNonces.size > MAX_ACTIVE_NONCES) {
      const entries = [...activeNonces.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - MAX_ACTIVE_NONCES + 10);
      for (const [n] of toRemove) {
        activeNonces.delete(n);
      }
    }

    addAuditEntry({ ip, userAgent, method: 'param', success: true, path: pathname });
    // Note: Cookie setting is handled by the middleware for page routes.
    // For API routes, we just verify access without setting cookies.
    return { allowed: true, ip };
  }

  // ── Layer 4: Godmode Cookie with Nonce Rotation ──
  const godmodeCookie = request.cookies.get(ZCC_GODMODE_COOKIE)?.value;
  if (godmodeCookie) {
    const colonIndex = godmodeCookie.indexOf(':');
    if (colonIndex !== -1) {
      const token = godmodeCookie.slice(0, colonIndex);
      const nonce = godmodeCookie.slice(colonIndex + 1);

      if (ZCC_GODMODE_TOKEN && token === ZCC_GODMODE_TOKEN && nonce && activeNonces.has(nonce)) {
        // Rotate nonce: remove old, generate new
        activeNonces.delete(nonce);
        cleanupExpiredNonces();

        const newNonce = generateNonce();
        activeNonces.set(newNonce, Date.now());

        addAuditEntry({ ip, userAgent, method: 'cookie', success: true, path: pathname });
        return { allowed: true, ip };
      }
    }
    // Invalid cookie or expired nonce — continue to next check
  }

  // ── Layer 5: NextAuth Admin Email Verification ──
  try {
    const token = await getToken({
      req: request,
      secret: nextAuthSecret,
    });
    if (token?.email) {
      // ZCC Admin quick access (123/123): email "123" sempre tem acesso ao ZCC
      if (token.email === '123') {
        addAuditEntry({ ip, userAgent, method: 'session', success: true, path: pathname });
        return { allowed: true, ip };
      }

      const adminEmails = (process.env.ZCC_ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
      if (adminEmails.length > 0 && adminEmails.includes((token.email as string).toLowerCase())) {
        addAuditEntry({ ip, userAgent, method: 'session', success: true, path: pathname });
        return { allowed: true, ip };
      }
    }
  } catch {
    // Token decode failure — deny silently
  }

  // ── Layer 6: Silent Rejection ──
  // Never reveal the route exists — return 404 instead of 401
  addAuditEntry({ ip, userAgent, method: 'denied', success: false, path: pathname });

  return {
    allowed: false,
    ip,
    response: NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    ),
    auditEntry: { timestamp: new Date().toISOString(), ip, userAgent, method: 'denied', success: false, path: pathname },
  };
}

/**
 * Convenience wrapper for API routes — returns either the security rejection response
 * or allows the handler to proceed.
 *
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const security = await verifyZCCAccessOrReject(request);
 *   if (!security.allowed) return security.response!;
 *   // ... your protected logic here
 * }
 * ```
 */
export async function verifyZCCAccessOrReject(request: NextRequest): Promise<ZCCSecurityResult> {
  const result = await verifyZCCAccess(request);
  if (!result.allowed && !result.response) {
    // Failsafe: should never happen, but ensure we always return a response
    result.response = NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return result;
}
