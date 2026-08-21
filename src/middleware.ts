// ZEHLA SmartHotel — Zero Trust middleware
// Security boundary: no URL master-key bypass or development auth bypass.

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_API_PREFIXES = [
  '/api/health',
  '/api/readiness',
  '/api/auth',
  '/api/webhook-whatsapp',
  '/api/webhooks/asaas',
  '/api/checkout/webhook',
];

const BLOCKED_API_PREFIXES = ['/api/debug-agent', '/api/proxy', '/api/diagnose'];
const PROTECTED_PAGE_PREFIXES = ['/zcc', '/dashboard', '/config', '/tenants', '/campaigns', '/leads', '/targets', '/agents', '/roi', '/swipe-templates'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicApi(pathname: string): boolean {
  return startsWithAny(pathname, PUBLIC_API_PREFIXES);
}

function getSessionCookie(request: NextRequest): string | undefined {
  return request.cookies.get('__Secure-next-auth.session-token')?.value
    || request.cookies.get('next-auth.session-token')?.value;
}

function securityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('X-Security-Shield', 'zero-trust-v4');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://sdk.mercadopago.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.mercadopago.com https://api.asaas.com https://sandbox.asaas.com https://api.stripe.com wss://smart-hotel-zehla.vercel.app https://*.railway.app https://*.basemaps.cartocdn.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.mercadopago.com https://checkout.stripe.com https://*.asaas.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    ].join('; '));
  }
  return response;
}

async function getAuthenticatedToken(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required');
  return getToken({ req: request, secret });
}

async function authorizeZcc(request: NextRequest): Promise<boolean> {
  const token = await getAuthenticatedToken(request);
  if (!token) return false;
  const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : '';
  const role = typeof token.role === 'string' ? token.role : '';

  const defaultAdmins = ['admin@seuzella.com.br', 'zella@zella.com.br', 'marciocau@gmail.com', '123', 'admin@zehla.com.br'];
  const envAdmins = (process.env.ZCC_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const allowedAdmins = envAdmins.length > 0 ? envAdmins : defaultAdmins;

  const isRoleAuthorized = ['owner', 'admin', 'system_admin'].includes(role);
  const isEmailAuthorized = allowedAdmins.includes(email) || role === 'system_admin';

  return Boolean(isRoleAuthorized && isEmailAuthorized);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get('x-request-id') || request.headers.get('x-vercel-id') || `mid-${crypto.randomUUID()}`;

  const blocked = startsWithAny(pathname, BLOCKED_API_PREFIXES);
  if (blocked && process.env.NODE_ENV === 'production') {
    return securityHeaders(NextResponse.json({ error: 'NOT_FOUND', requestId }, { status: 404 }));
  }

  // DDC remains a public preview surface. Its data APIs remain protected unless explicitly public.
  if (pathname === '/ddc' || pathname.startsWith('/ddc/')) {
    if (pathname === '/ddc' || pathname === '/ddc/') {
      try {
        const token = await getAuthenticatedToken(request);
        const niche = (token as any)?.niche;
        return securityHeaders(NextResponse.redirect(new URL(niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada', request.url)));
      } catch {
        return securityHeaders(NextResponse.next());
      }
    }
    return securityHeaders(NextResponse.next());
  }

  // ZCC has exactly one authorization path: authenticated NextAuth session + explicit admin allow-list + role.
  if (pathname === '/zcc' || pathname.startsWith('/zcc/')) {
    try {
      if (await authorizeZcc(request)) return securityHeaders(NextResponse.next());
    } catch {
      // Fail closed.
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return securityHeaders(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) return securityHeaders(NextResponse.next());

    // Middleware is a coarse gate; the endpoint must still perform tenant/RBAC authorization.
    // Never treat the presence of a bearer/API key as authorization here.
    const hasSession = Boolean(getSessionCookie(request));
    const hasMachineCredential = Boolean(request.headers.get('authorization') || request.headers.get('x-api-key'));
    if (!hasSession && !hasMachineCredential) {
      return securityHeaders(NextResponse.json({ error: 'AUTH_REQUIRED', requestId }, { status: 401 }));
    }
    return securityHeaders(NextResponse.next());
  }

  if (startsWithAny(pathname, PROTECTED_PAGE_PREFIXES)) {
    if (!getSessionCookie(request)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return securityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'],
};
