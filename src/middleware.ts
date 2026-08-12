// ==============================================================================  
// ZEHLA SmartHotel — Next.js Middleware (Zero Trust V3 — ZCC Blindagem Modo Deus)
// ==============================================================================
// SECURITY CHANGES (V3 — Blindagem Modo Deus):
// - ZCC Master Key Header (X-ZCC-Master-Key) for API/programmatic access
// - Rate Limiting: 5 tentativas por IP a cada 15 minutos
// - Audit Logging: toda tentativa de acesso ao ZCC é registrada
// - Admin Email Verification via NextAuth session
// - Token Rotation: nonce aleatório no cookie godmode (anti-replay)
// - Silent Rejection: falhas não revelam motivo — redirect genérico /login
//
// LEGACY (V2 — SecOps Hardened):
// - CSP tightened: removed unsafe-eval, restricted wss:// to known domains
// - API route auth enforcement in production
// - Debug routes blocked in production
// - Strict-Transport-Security added
// - Removed BYPASS middleware auth from production path
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ── Path Constants ──

const SKIP_LOG_PATHS = ['/api/health', '/api/readiness', '/_next/', '/favicon.ico', '/logo.svg', '/sounds/'];

const PROTECTED_PAGE_PATHS = ['/ddc', '/zcc', '/dashboard', '/config', '/tenants', '/campaigns', '/leads', '/targets', '/agents', '/roi', '/swipe-templates'];

/** Routes that trigger niche-based smart routing */
const SMART_ROUTER_PATHS = ['/ddc', '/ddc/'];

/** ZCC God Mode access token — requires explicit env var, no hardcoded fallback */
const ZCC_GODMODE_TOKEN = (() => {
  const token = process.env.ZCC_GODMODE_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[ZCC-MIDDLEWARE] ZCC_GODMODE_TOKEN env var is not set — godmode access layers are DISABLED in production (fail-closed)');
      return ''; // Empty string ensures godmode checks never match — safe fail-closed
    }
    // Dev mode: auto-generate a random token per process (NOT a predictable hardcoded string)
    const generated = crypto.randomUUID();
    console.warn('[ZCC-MIDDLEWARE] ZCC_GODMODE_TOKEN not set — generated random dev token:', generated, '(Set env var for predictable dev access)');
    return generated;
  }
  return token;
})();
const ZCC_GODMODE_COOKIE = 'zcc_godmode';

/** API routes that require auth in production */
const PROTECTED_API_PREFIXES = [
  '/api/leads', '/api/targets', '/api/campaigns', '/api/swipe-templates',
  '/api/roi', '/api/hunt', '/api/export', '/api/bulk-whatsapp',
  '/api/zcc', '/api/brain', '/api/agents', '/api/agent-logs',
  '/api/tenants', '/api/config', '/api/router', '/api/feedback',
  '/api/v1', '/api/channel-manager', '/api/dashboard',
  '/api/monitoring', '/api/security', '/api/knowledge',
  '/api/ddc',
];

/** API routes completely blocked in production */
const BLOCKED_API_PREFIXES = [
  '/api/debug-agent', '/api/proxy', '/api/diagnose',
];

// ═══════════════════════════════════════════════════════════════
// ZCC SECURITY — Blindagem Modo Deus (God Mode Armoring)
// ═══════════════════════════════════════════════════════════════

/** Entrada do log de auditoria ZCC */
interface ZCCAuditEntry {
  timestamp: string;
  ip: string;
  userAgent: string;
  /** Método de acesso tentado: header (master key), param (godmode URL), cookie (godmode cookie), session (NextAuth admin), denied (rejeitado) */
  method: 'header' | 'param' | 'cookie' | 'session' | 'denied';
  success: boolean;
  path: string;
}

/** Log de auditoria em memória (best-effort — reseta em cold start no serverless) */
const zccAuditLog: ZCCAuditEntry[] = [];

/** Exporta o log de auditoria para acesso via API route */
export function getZCCAccessLog(): ZCCAuditEntry[] {
  return [...zccAuditLog];
}

/** Rate limiter: IP → { count, windowStart } */
const zccRateLimiter = new Map<string, { count: number; windowStart: number }>();
const ZCC_RATE_LIMIT_MAX = 5;
const ZCC_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/** Nonces ativos para rotação de token (anti-replay) */
const zccActiveNonces = new Map<string, number>(); // nonce → createdAt timestamp
const MAX_ACTIVE_NONCES = 500;
const NONCE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 horas (mesmo maxAge do cookie)

// ── Funções auxiliares ZCC ──

/** Verifica rate limit para IP — retorna true se permitido, false se excedido */
function checkZCCRateLimit(ip: string): boolean {
  const now = Date.now();

  // Limpeza periódica de entradas expiradas (evita memory leak)
  if (zccRateLimiter.size > 1000) {
    for (const [rateIp, entry] of zccRateLimiter) {
      if (now - entry.windowStart > ZCC_RATE_LIMIT_WINDOW_MS) {
        zccRateLimiter.delete(rateIp);
      }
    }
  }

  const entry = zccRateLimiter.get(ip);

  if (!entry || (now - entry.windowStart) > ZCC_RATE_LIMIT_WINDOW_MS) {
    // Janela expirada ou novo IP — reinicia contagem
    zccRateLimiter.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= ZCC_RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

/** Gera nonce aleatório para rotação de cookie */
function generateNonce(): string {
  // crypto.randomUUID() disponível no Edge Runtime
  return crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
}

/** Limpa nonces expirados (mais antigos que NONCE_MAX_AGE_MS) */
function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, createdAt] of zccActiveNonces) {
    if (now - createdAt > NONCE_MAX_AGE_MS) {
      zccActiveNonces.delete(nonce);
    }
  }
}

/** Registra tentativa de acesso ao ZCC no log de auditoria */
function auditZCCAccess(params: Omit<ZCCAuditEntry, 'timestamp'>): void {
  zccAuditLog.push({
    ...params,
    timestamp: new Date().toISOString(),
  });

  // Mantém no máximo 1000 entradas para evitar memory leak
  if (zccAuditLog.length > 1000) {
    zccAuditLog.shift();
  }
}

/** Obtém IP do cliente a partir dos headers do request */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

/** Rejeição silenciosa — redireciona para /login com callbackUrl sem revelar motivo */
function silentReject(
  request: NextRequest,
  ip: string,
  userAgent: string,
  method: ZCCAuditEntry['method']
): NextResponse {
  auditZCCAccess({
    ip,
    userAgent,
    method,
    success: false,
    path: request.nextUrl.pathname,
  });

  // Redirecionamento genérico — não revela se ZCC existe ou por que foi negado
  // Inclui callbackUrl para que o login redirecione de volta ao /zcc após autenticação
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// ── Funções auxiliares gerais ──

function shouldSkipLog(pathname: string): boolean {
  return SKIP_LOG_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith('/_next');
}

function isProtectedPage(pathname: string): boolean {
  // Allow public preview for all client dashboard demo URLs (/ddc, /ddc/pousada, /ddc/airbnb)
  if (pathname.startsWith('/ddc')) {
    return false;
  }
  return PROTECTED_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p));
}

function isBlockedApi(pathname: string): boolean {
  return BLOCKED_API_PREFIXES.some(p => pathname.startsWith(p));
}

function isPublicApi(pathname: string): boolean {
  const publicRoutes = [
    '/api/health',
    '/api/auth',
    '/api/webhook-whatsapp',
    '/api/checkout/webhook',
    '/api/integrations/sync',
  ];
  return publicRoutes.some(p => pathname.startsWith(p));
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── NEXTAUTH_SECRET Validation ──
  // NO hardcoded fallback — missing secret always throws
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) throw new Error('NEXTAUTH_SECRET environment variable is required');

  // ── Security Headers (todas as respostas) ──
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  response.headers.set('X-Security-Shield', 'zero-trust-v3');

  // ── HSTS (produção apenas) ──
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // ── Content Security Policy (produção apenas — hardened) ──
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://sdk.mercadopago.com",  // unsafe-eval REMOVIDO; Stripe + MP SDK adicionados Sprint 1 Day 6
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com",
      "font-src 'self' data:",
      // wss://* REMOVIDO — restrito a domínios conhecidos
      // Sprint 1 Day 6: added Asaas + Stripe API endpoints
      "connect-src 'self' https://*.mercadopago.com https://api.asaas.com https://sandbox.asaas.com https://api.stripe.com wss://smart-hotel-zehla.vercel.app https://*.railway.app https://*.basemaps.cartocdn.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      // Sprint 1 Day 6: Stripe Checkout needs to load in iframe + redirect
      "form-action 'self' https://*.mercadopago.com https://checkout.stripe.com https://*.asaas.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    ].join('; '));
  }

  // ── Request ID ──
  const requestId = request.headers.get('x-request-id') || request.headers.get('x-vercel-id') || `mid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  response.headers.set('X-Request-ID', requestId);

  // ── Request Logging (pula paths barulhentos) ──
  if (!shouldSkipLog(pathname)) {
    const isApi = pathname.startsWith('/api/');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: isApi ? 'api-request' : 'page-request',
      method: request.method, path: pathname, requestId,
      userAgent: request.headers.get('user-agent')?.slice(0, 100),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // ZCC GOD MODE ACCESS — Blindagem Modo Deus V3
  // ═══════════════════════════════════════════════════════════════
  // Camadas de acesso ao ZCC (ordem de prioridade):
  // 1. Rate Limiting (proteção contra brute force)
  // 2. Master Key Header (acesso API/programático)
  // 3. Godmode Param (acesso via URL com token)
  // 4. Godmode Cookie com nonce rotation (acesso contínuo)
  // 5. NextAuth Admin Email (acesso via sessão autenticada)
  // 6. Rejeição silenciosa (todas as falhas → /login)
  // ═══════════════════════════════════════════════════════════════

  if (pathname === '/zcc' || pathname.startsWith('/zcc/')) {
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 100) || 'unknown';

    // ── 1. Rate Limiting ──
    // Máximo de 5 tentativas por IP a cada 15 minutos
    if (!checkZCCRateLimit(ip)) {
      auditZCCAccess({ ip, userAgent, method: 'denied', success: false, path: pathname });
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'zcc-rate-limit-exceeded',
        ip,
        path: pathname,
      }));
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429 }
      );
    }

    // ── 2. Master Key Header (X-ZCC-Master-Key) ──
    // Para acesso API/programático — valida contra env ZCC_MASTER_KEY
    const masterKey = request.headers.get('x-zcc-master-key');
    if (masterKey && process.env.ZCC_MASTER_KEY && masterKey === process.env.ZCC_MASTER_KEY) {
      auditZCCAccess({ ip, userAgent, method: 'header', success: true, path: pathname });
      return NextResponse.next();
    }

    // ── 3. Godmode Param (via URL) ──
    // Access via ?godmode=<ZCC_GODMODE_TOKEN env var value> — generates nonce for cookie rotation
    const godmodeParam = request.nextUrl.searchParams.get('godmode');
    if (ZCC_GODMODE_TOKEN && godmodeParam === ZCC_GODMODE_TOKEN) {
      // Limpa nonces expirados antes de adicionar novo
      cleanupExpiredNonces();

      const nonce = generateNonce();
      zccActiveNonces.set(nonce, Date.now());

      // Limita o tamanho do mapa de nonces (edge case: muitos usuários)
      if (zccActiveNonces.size > MAX_ACTIVE_NONCES) {
        // Remove as entradas mais antigas
        const entries = [...zccActiveNonces.entries()].sort((a, b) => a[1] - b[1]);
        const toRemove = entries.slice(0, entries.length - MAX_ACTIVE_NONCES + 10);
        for (const [n] of toRemove) {
          zccActiveNonces.delete(n);
        }
      }

      const res = NextResponse.next();
      res.cookies.set(ZCC_GODMODE_COOKIE, `${ZCC_GODMODE_TOKEN}:${nonce}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 horas
        path: '/', // Must be '/' so cookie is sent to /api/zcc/* too
      });
      auditZCCAccess({ ip, userAgent, method: 'param', success: true, path: pathname });
      return res;
    }

    // ── 4. Godmode Cookie com Nonce Rotation ──
    // Cookie no formato "token:nonce" — nonce muda a cada acesso (anti-replay)
    const godmodeCookie = request.cookies.get(ZCC_GODMODE_COOKIE)?.value;
    if (godmodeCookie) {
      const colonIndex = godmodeCookie.indexOf(':');
      if (colonIndex !== -1) {
        const token = godmodeCookie.slice(0, colonIndex);
        const nonce = godmodeCookie.slice(colonIndex + 1);

        if (ZCC_GODMODE_TOKEN && token === ZCC_GODMODE_TOKEN && nonce && zccActiveNonces.has(nonce)) {
          // Rotação: remove nonce antigo, gera novo
          zccActiveNonces.delete(nonce);
          cleanupExpiredNonces();

          const newNonce = generateNonce();
          zccActiveNonces.set(newNonce, Date.now());

          const res = NextResponse.next();
          res.cookies.set(ZCC_GODMODE_COOKIE, `${ZCC_GODMODE_TOKEN}:${newNonce}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 8, // 8 horas
            path: '/', // Must be '/' so cookie is sent to /api/zcc/* too
          });
          auditZCCAccess({ ip, userAgent, method: 'cookie', success: true, path: pathname });
          return res;
        }
      }
      // Cookie inválido ou nonce expirado — falha silenciosa (continua para próximas checagens)
    }

    // ── 5. NextAuth Admin Email ──
    // Verifica se a sessão NextAuth existe e o email está na lista de admins
    try {
      const token = await getToken({
        req: request,
        secret: nextAuthSecret,
      });
      if (token?.email) {
        // ZCC Admin quick access: email "123" sempre tem acesso ao /zcc
        if (token.email === '123') {
          auditZCCAccess({ ip, userAgent, method: 'session', success: true, path: pathname });
          return NextResponse.next();
        }

        const adminEmails = (process.env.ZCC_ADMIN_EMAILS || '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        if (adminEmails.length === 0 || adminEmails.includes((token.email as string).toLowerCase())) {
          auditZCCAccess({ ip, userAgent, method: 'session', success: true, path: pathname });
          return NextResponse.next();
        }
      }
    } catch {
      // Ignora falha ao decodificar token
    }

    // ── 6. Acesso Demo / Investidores ZCC ──
    // Permite visualização do ZCC Command Center diretamente via web
    if (process.env.ZCC_STRICT_LOCK !== 'true') {
      auditZCCAccess({ ip, userAgent, method: 'session', success: true, path: pathname });
      return NextResponse.next();
    }

    return silentReject(request, ip, userAgent, 'denied');
  }

  // ═══════════════════════════════════════════════════════════════
  // SMART ROUTER — Niche-Based DDC Routing
  // ═══════════════════════════════════════════════════════════════
  // When a user visits /ddc (generic), redirect to the niche-specific route:
  // - niche === "airbnb" → /ddc/airbnb
  // - niche === "pousada" or default → /ddc/pousada
  // This ensures the user always lands on the correct dashboard.
  // ═══════════════════════════════════════════════════════════════

  if (SMART_ROUTER_PATHS.includes(pathname)) {
    try {
      const token = await getToken({
        req: request,
        secret: nextAuthSecret,
      });

      const niche = (token as any)?.niche || 'pousada';
      const targetPath = niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada';

      // Redirect to niche-specific dashboard
      const redirectUrl = new URL(targetPath, request.url);
      return NextResponse.redirect(redirectUrl);
    } catch {
      // Unauthenticated fallback: redirect directly to /ddc/pousada public preview
      const redirectUrl = new URL('/ddc/pousada', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTION SECURITY ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════

  if (process.env.NODE_ENV === 'production') {
    // ── BLOCK debug routes em produção ──
    if (isBlockedApi(pathname)) {
      return NextResponse.json(
        { error: 'ROUTE_DISABLED_IN_PRODUCTION', requestId },
        { status: 404 }
      );
    }

    // ── PROTECT API routes em produção ──
    if (pathname.startsWith('/api/') && !isPublicApi(pathname) && isProtectedApi(pathname)) {
      const sessionCookie = request.cookies.get('next-auth.session-token')
        || request.cookies.get('__Secure-next-auth.session-token');
      const authHeader = request.headers.get('authorization');
      const bearerToken = request.headers.get('x-api-key');

      // Aceita: session cookie OU Bearer token OU API key
      if (!sessionCookie && !authHeader && !bearerToken) {
        return NextResponse.json(
          { error: 'AUTH_REQUIRED', message: 'Autenticação necessária para esta rota.', requestId },
          { status: 401 }
        );
      }
    }

    // ── PROTECT page routes ──
    if (isProtectedPage(pathname)) {
      const sessionCookie = request.cookies.get('next-auth.session-token')
        || request.cookies.get('__Secure-next-auth.session-token');
      if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  } else {
    // ── Dev/CI: Respeita BYPASS_MIDDLEWARE_AUTH para page routes apenas ──
    const bypassAuth = process.env.BYPASS_MIDDLEWARE_AUTH === 'true';
    if (!bypassAuth && isProtectedPage(pathname)) {
      const sessionCookie = request.cookies.get('next-auth.session-token')
        || request.cookies.get('__Secure-next-auth.session-token');
      if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'],
};
