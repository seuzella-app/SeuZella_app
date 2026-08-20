// =============================================================================
// ZÉLLA Central Control — Security Gate V4
// =============================================================================
// Authorization is based exclusively on a valid NextAuth session plus an
// explicit allow-list of system administrator emails. URL tokens, cookies,
// static master-key bypasses and development authentication bypasses are not
// accepted by this security boundary.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export interface ZCCAuditEntry {
  timestamp: string;
  ip: string;
  userAgent: string;
  method: 'session' | 'denied';
  success: boolean;
  path: string;
}

export interface ZCCSecurityResult {
  allowed: boolean;
  response?: NextResponse;
  ip: string;
  auditEntry?: ZCCAuditEntry;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimiter = new Map<string, { count: number; windowStart: number }>();
const auditLogCache: ZCCAuditEntry[] = [];
const AUDIT_CACHE_SIZE = 100;

function getClientIP(request: NextRequest): string {
  // Do not blindly trust arbitrary client-supplied forwarding headers. Prefer
  // the platform-provided value when present and keep a bounded fallback.
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimiter.size > 1000) {
    for (const [rateIp, entry] of rateLimiter) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) rateLimiter.delete(rateIp);
    }
  }
  const entry = rateLimiter.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimiter.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function addAuditEntry(entry: Omit<ZCCAuditEntry, 'timestamp'>): void {
  const fullEntry = { ...entry, timestamp: new Date().toISOString() };
  auditLogCache.push(fullEntry);
  if (auditLogCache.length > AUDIT_CACHE_SIZE) auditLogCache.shift();
  void persistAuditEntry(fullEntry);
}

async function persistAuditEntry(entry: ZCCAuditEntry): Promise<void> {
  try {
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
        },
      });
    }
  } catch (err) {
    console.error('[ZCC-AUDIT] Failed to persist audit event:', err);
  }
}

export async function getZCCSecurityAuditLog(limit: number = 100): Promise<ZCCAuditEntry[]> {
  if (process.env.NODE_ENV === 'production') {
    try {
      const { db } = await import('@/lib/db');
      const entries = await db.zccAuditLog.findMany({ orderBy: { timestamp: 'desc' }, take: Math.min(Math.max(limit, 1), 500) });
      return entries.map(e => ({ timestamp: e.timestamp.toISOString(), ip: e.ip, userAgent: e.userAgent, method: e.method as 'session' | 'denied', success: e.success, path: e.path }));
    } catch (err) {
      console.error('[ZCC-AUDIT] DB query failed:', err);
      return [...auditLogCache];
    }
  }
  return [...auditLogCache];
}

export function getZCCRateLimiterState() {
  return { activeIPs: rateLimiter.size, auditLogEntries: auditLogCache.length };
}

export async function verifyZCCAccess(request: NextRequest): Promise<ZCCSecurityResult> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent')?.slice(0, 100) || 'unknown';
  const pathname = request.nextUrl?.pathname || '/api/zcc/unknown';
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) throw new Error('NEXTAUTH_SECRET environment variable is required');

  if (!checkRateLimit(ip)) {
    addAuditEntry({ ip, userAgent, method: 'denied', success: false, path: pathname });
    return {
      allowed: false,
      ip,
      response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
      auditEntry: { timestamp: new Date().toISOString(), ip, userAgent, method: 'denied', success: false, path: pathname },
    };
  }

  try {
    const token = await getToken({ req: request, secret: nextAuthSecret });
    const email = typeof token?.email === 'string' ? token.email.trim().toLowerCase() : '';
    const role = typeof token?.role === 'string' ? token.role : '';
    const adminEmails = (process.env.ZCC_ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (email && adminEmails.includes(email) && ['owner', 'admin', 'system_admin'].includes(role)) {
      addAuditEntry({ ip, userAgent, method: 'session', success: true, path: pathname });
      return { allowed: true, ip };
    }
  } catch (err) {
    console.warn('[ZCC-SECURITY] Session verification failed:', err instanceof Error ? err.name : 'unknown');
  }

  addAuditEntry({ ip, userAgent, method: 'denied', success: false, path: pathname });
  return {
    allowed: false,
    ip,
    response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    auditEntry: { timestamp: new Date().toISOString(), ip, userAgent, method: 'denied', success: false, path: pathname },
  };
}

export async function verifyZCCAccessOrReject(request: NextRequest): Promise<ZCCSecurityResult> {
  const result = await verifyZCCAccess(request);
  if (!result.allowed && !result.response) result.response = NextResponse.json({ error: 'Not found' }, { status: 404 });
  return result;
}
