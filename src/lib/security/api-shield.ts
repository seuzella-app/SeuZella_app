/**
 * ZEHLA — Global API Security Middleware (Zero Trust)
 * 
 * This is the central security gate for ALL API routes.
 * It applies:
 * 1. Payload size limits (prevent resource exhaustion)
 * 2. Input sanitization (SQLi, XSS, Command Injection, Prototype Pollution)
 * 3. Rate limiting (configurable per-route)
 * 4. Security headers injection
 * 5. Request ID tracking
 * 6. Production-only route blocking (debug routes)
 * 
 * USAGE in any API route:
 *   import { withSecurity } from '@/lib/security/api-shield';
 *   export const POST = withSecurity(myHandler, { maxPayloadBytes: 500_000 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeObject, validatePayloadSize, SanitizationResult } from './input-sanitizer';
import { apiRatelimit, authRatelimit, RatelimitInstance } from '@/lib/rate-limit';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ── Configuration ──

const DEFAULT_MAX_PAYLOAD_BYTES = 1_000_000; // 1MB default
const STRICT_MAX_PAYLOAD_BYTES = 100_000; // 100KB for auth/sensitive routes

/** Routes completely blocked in production */
const PROD_BLOCKED_ROUTES = [
  '/api/debug-agent',
  '/api/debug-agent/github',
  '/api/debug-agent/knowledge',
  '/api/proxy',
  '/api/diagnose',
  '/api/readiness',
];

/** Routes that require auth but currently have none */
const AUTH_REQUIRED_ROUTES = [
  '/api/leads',
  '/api/targets',
  '/api/campaigns',
  '/api/swipe-templates',
  '/api/roi',
  '/api/hunt',
  '/api/hunt-stream',
  '/api/export',
  '/api/bulk-whatsapp',
  '/api/zcc',
  '/api/brain',
  '/api/agents',
  '/api/agent-logs',
  '/api/tenants',
  '/api/config',
  '/api/router',
  '/api/feedback',
  '/api/feedback/stats',
  '/api/v1',
  '/api/channel-manager',
  '/api/dashboard',
  '/api/monitoring',
  '/api/security',
  '/api/knowledge',
];

/** Routes that are intentionally public */
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth',
  '/api/webhook-whatsapp',
  '/api/checkout/webhook',
];

export interface SecurityOptions {
  /** Maximum payload size in bytes (default: 1MB) */
  maxPayloadBytes?: number;
  /** Custom rate limiter instance (default: apiRatelimit) */
  rateLimiter?: RatelimitInstance;
  /** Whether to sanitize input (default: true) */
  sanitize?: boolean;
  /** Whether to require authentication (default: auto-detected from path) */
  requireAuth?: boolean;
  /** Whether this is an auth route (uses stricter rate limit) */
  isAuthRoute?: boolean;
  /** Custom label for logging */
  routeLabel?: string;
  /**
   * V11-P0.7 — Authentication mode for the route.
   * - 'zcc-admin': calls verifyZCCAccessOrReject (admin Zélla only)
   * - undefined: legacy behavior (no enforced auth in shield)
   *
   * Future: 'nextauth' | 'cron-m2m' | 'public'
   */
  auth?: 'zcc-admin';
}

export interface SecurityContext {
  requestId: string;
  clientIp: string;
  sanitizedBody: Record<string, unknown> | null;
  sanitizationResult: SanitizationResult | null;
  rateLimitResult: { success: boolean; remaining: number; reset: number } | null;
}

type ApiHandler = (request: NextRequest, context: SecurityContext) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with full Zero Trust security.
 */
export function withSecurity(
  handler: ApiHandler,
  options: SecurityOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const {pathname} = new URL(request.url);
    // Sanitiza e valida o x-request-id do cliente para evitar log injection
    const rawReqId = request.headers.get('x-request-id') || request.headers.get('x-vercel-id');
    const isValidReqId = rawReqId && rawReqId.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(rawReqId);
    const requestId = isValidReqId
      ? rawReqId
      : `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const ctx: SecurityContext = {
      requestId,
      clientIp,
      sanitizedBody: null,
      sanitizationResult: null,
      rateLimitResult: null,
    };

    // ── 1. PROD BLOCKED ROUTES ──
    if (process.env.NODE_ENV === 'production') {
      if (PROD_BLOCKED_ROUTES.some(r => pathname.startsWith(r))) {
        return NextResponse.json(
          { error: 'ROUTE_DISABLED_IN_PRODUCTION', requestId },
          { status: 404, headers: securityHeaders(requestId) }
        );
      }
    }

    // ── 2. RATE LIMITING (Fail-Closed para rotas críticas em produção) ──
    const isCriticalRoute = pathname.startsWith('/api/checkout') ||
      pathname.startsWith('/api/webhooks') ||
      pathname.startsWith('/api/v1/reservations') ||
      pathname.startsWith('/api/zcc') ||
      pathname.startsWith('/api/bulk-whatsapp');

    const limiter = options.rateLimiter
      || (options.isAuthRoute ? authRatelimit : apiRatelimit);
    const rateLimitKey = `${options.isAuthRoute ? 'auth' : 'api'}:${clientIp}:${pathname}`;
    try {
      const rlResult = await limiter.limit(rateLimitKey);
      ctx.rateLimitResult = {
        success: rlResult.success,
        remaining: rlResult.remaining,
        reset: rlResult.reset,
      };

      if (!rlResult.success) {
        return NextResponse.json(
          {
            error: 'RATE_LIMITED',
            message: 'Muitas requisições. Tente novamente em breve.',
            retryAfter: Math.ceil((rlResult.reset - Date.now()) / 1000),
            requestId,
          },
          {
            status: 429,
            headers: {
              ...securityHeaders(requestId),
              'Retry-After': String(Math.ceil((rlResult.reset - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(rlResult.limit),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }
    } catch (rlError) {
      console.error(`[API_SHIELD] Rate limit error for ${pathname}:`, rlError);
      // Em produção, rotas críticas operam FAIL-CLOSED para evitar abuso durante falha de infraestrutura
      if (process.env.NODE_ENV === 'production' && isCriticalRoute) {
        return NextResponse.json(
          {
            error: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível para esta operação sensível. Tente em instantes.',
            requestId,
          },
          { status: 503, headers: securityHeaders(requestId) }
        );
      }
    }

    // ── 3. PAYLOAD SIZE LIMIT ──
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const maxBytes = options.maxPayloadBytes
        || (options.isAuthRoute ? STRICT_MAX_PAYLOAD_BYTES : DEFAULT_MAX_PAYLOAD_BYTES);

      try {
        const clone = request.clone();
        const rawBody = await clone.text();
        const { valid, sizeBytes } = validatePayloadSize(rawBody, maxBytes);

        if (!valid) {
          return NextResponse.json(
            {
              error: 'PAYLOAD_TOO_LARGE',
              message: `Payload excede o limite de ${Math.round(maxBytes / 1024)}KB.`,
              sizeBytes,
              maxBytes,
              requestId,
            },
            { status: 413, headers: securityHeaders(requestId) }
          );
        }

        // ── 4. INPUT SANITIZATION ──
        if (options.sanitize !== false && rawBody) {
          try {
            const parsed = JSON.parse(rawBody);
            const { sanitized, isClean, threats } = sanitizeObject(parsed);
            ctx.sanitizedBody = sanitized;
            ctx.sanitizationResult = {
              sanitized: JSON.stringify(sanitized),
              isClean,
              threats,
              threatTypes: [],
            };

            if (!isClean) {
              console.log(JSON.stringify({
                level: 'security',
                event: 'API_INPUT_SANITIZED',
                route: pathname,
                threatCount: threats.length,
                threats: threats.slice(0, 5),
                clientIp,
                requestId,
                timestamp: new Date().toISOString(),
              }));
            }
          } catch {
            // Not JSON body — skip sanitization (could be form data, binary, etc.)
          }
        }
      } catch {
        // If we can't read the body, continue — the handler will deal with it
      }
    }

    // ── 5. AUTH GATE (V11-P0.7) ──
    // Quando options.auth === 'zcc-admin', aplica verifyZCCAccessOrReject
    // (admin Zélla apenas). Em rejeição, retorna a response 404 silenciosa
    // (padrão do zcc-security para não vazar info de existência da rota).
    if (options.auth === 'zcc-admin') {
      try {
        const zccResult = await verifyZCCAccessOrReject(request);
        if (!zccResult.allowed) {
          // Repassa a response do zcc-security (já com headers 404 + audit)
          const rejectResponse = zccResult.response
            ?? NextResponse.json({ error: 'Not found' }, { status: 404 });
          // Injeta security headers na response de rejeição
          for (const [key, value] of Object.entries(securityHeaders(requestId))) {
            rejectResponse.headers.set(key, value);
          }
          return rejectResponse;
        }
      } catch (authError) {
        console.error(`[API_SHIELD] ZCC auth error on ${pathname}:`, authError);
        return NextResponse.json(
          { error: 'AUTH_ERROR', requestId },
          { status: 500, headers: securityHeaders(requestId) }
        );
      }
    }

    // ── 6. EXECUTE HANDLER ──
    try {
      const response = await handler(request, ctx);

      // Inject security headers into response (suporta NextResponse e Response nativo)
      const headers = securityHeaders(requestId);
      if (ctx.rateLimitResult) {
        headers['X-RateLimit-Remaining'] = String(ctx.rateLimitResult.remaining);
      }
      for (const [key, value] of Object.entries(headers)) {
        try {
          response.headers.set(key, value);
        } catch {
          // Algumas responses (streaming) podem não permitir set após envio
        }
      }

      return response as NextResponse;
    } catch (error) {
      console.error(`[API_SHIELD] Handler error on ${pathname}:`, error);
      return NextResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor.',
          requestId,
        },
        { status: 500, headers: securityHeaders(requestId) }
      );
    }
  };
}

function securityHeaders(requestId: string): Record<string, string> {
  return {
    'X-Request-ID': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https: data:; connect-src 'self' https: wss:; frame-ancestors 'none';",
    'X-Security-Shield': 'zero-trust-v1',
  };
}

/**
 * Helper: Check if a route should require authentication based on its pathname.
 */
export function routeRequiresAuth(pathname: string): boolean {
  // Public routes are always allowed
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return false;

  // Explicitly listed auth-required routes
  if (AUTH_REQUIRED_ROUTES.some(r => pathname.startsWith(r))) return true;

  // In production, default to requiring auth for all /api/ routes
  // except health/webhooks
  if (process.env.NODE_ENV === 'production') {
    return pathname.startsWith('/api/');
  }

  return false;
}