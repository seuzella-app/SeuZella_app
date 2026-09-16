import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { wafMiddleware } from '@/lib/security/waf-middleware';

// FIX (onda Meta Foundation — auditoria): '/api/webhooks/whatsapp' é o webhook
// canônico da Meta Cloud API (HMAC fail-closed + idempotência + pricing). Ele
// DEVE ser público como os demais webhooks (/api/webhook-whatsapp, asaas,
// mercadopago): a autenticação aqui é a assinatura HMAC X-Hub-Signature-256,
// verificada dentro do handler — não a sessão NextAuth.
const PUBLIC_API_PREFIXES = ['/api/health','/api/readiness','/api/auth','/api/webhook-whatsapp','/api/webhooks/whatsapp','/api/webhooks/asaas','/api/webhooks/mercadopago','/api/webhooks/payment','/api/checkout/webhook','/api/webhooks/booking-com'];
const BLOCKED_API_PREFIXES = ['/api/debug-agent','/api/proxy','/api/diagnose'];
const PROTECTED_PAGE_PREFIXES = ['/zcc','/dashboard','/config','/tenants','/campaigns','/leads','/targets','/agents','/roi','/swipe-templates'];
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function startsWithAny(pathname: string, prefixes: string[]): boolean { return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)); }
function isPublicApi(pathname: string): boolean { return startsWithAny(pathname, PUBLIC_API_PREFIXES); }
function getSessionCookie(request: NextRequest): string | undefined { return request.cookies.get('__Secure-next-auth.session-token')?.value || request.cookies.get('next-auth.session-token')?.value; }
function createRequestId(request: NextRequest): string { const supplied = request.headers.get('x-request-id') || request.headers.get('x-vercel-id'); return supplied && REQUEST_ID_RE.test(supplied) ? supplied : `mid-${crypto.randomUUID()}`; }
function securityHeaders(response: NextResponse, requestId: string): NextResponse { response.headers.set('X-Request-ID', requestId); response.headers.set('X-Content-Type-Options','nosniff'); response.headers.set('X-Frame-Options','DENY'); response.headers.set('Referrer-Policy','strict-origin-when-cross-origin'); response.headers.set('Permissions-Policy','camera=(), microphone=(self), geolocation=(), payment=()'); response.headers.set('X-DNS-Prefetch-Control','off'); response.headers.set('X-Permitted-Cross-Domain-Policies','none'); response.headers.set('X-Security-Shield','zero-trust-v4'); if (process.env.NODE_ENV === 'production') { response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload'); response.headers.set('Content-Security-Policy',["default-src 'self'","script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com","font-src 'self' data:","connect-src 'self' https://*.mercadopago.com https://api.asaas.com https://sandbox.asaas.com wss://smart-hotel-zehla.vercel.app https://*.railway.app https://*.basemaps.cartocdn.com","frame-ancestors 'none'","base-uri 'self'","form-action 'self' https://*.mercadopago.com https://*.asaas.com","frame-src 'self' https://*.mercadopago.com https://*.asaas.com"].join('; ')); } return response; }
async function getAuthenticatedToken(request: NextRequest) { const secret = process.env.NEXTAUTH_SECRET; if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required'); return getToken({ req: request, secret }); }
async function authorizeZcc(request: NextRequest): Promise<boolean> { const token = await getAuthenticatedToken(request); if (!token) return false; const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : ''; const role = typeof token.role === 'string' ? token.role : ''; const envAdmins = (process.env.ZCC_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); return ['owner', 'admin', 'system_admin'].includes(role) && envAdmins.includes(email); }
function timingSafeEqualStr(a: string,b: string): boolean { if (a.length !== b.length) return false; let mismatch = 0; for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i); return mismatch === 0; }
function isMachineAuthorized(request: NextRequest): boolean { const authHeader = request.headers.get('authorization'); if (!authHeader) return false; const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim(); if (!token) return false; const validSecrets = [process.env.CRON_SECRET,process.env.ZEHLA_LOOP_API_KEY,process.env.ZAI_API_KEY].filter((s): s is string => typeof s === 'string' && s.length >= 16); return validSecrets.length > 0 && validSecrets.some(secret => timingSafeEqualStr(token,secret)); }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = createRequestId(request);
  const wafResponse = wafMiddleware(request);
  if (wafResponse) return securityHeaders(wafResponse, requestId);
  if (startsWithAny(pathname,BLOCKED_API_PREFIXES) && process.env.NODE_ENV === 'production') return securityHeaders(NextResponse.json({ error:'NOT_FOUND', requestId },{status:404}),requestId);
  if (pathname === '/zcc/login') return securityHeaders(NextResponse.next(),requestId);
  if (pathname === '/ddc' || pathname.startsWith('/ddc/')) { if (pathname === '/ddc' || pathname === '/ddc/') { try { const token = await getAuthenticatedToken(request); const niche = (token as any)?.niche; return securityHeaders(NextResponse.redirect(new URL(niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada',request.url)),requestId); } catch { return securityHeaders(NextResponse.next(),requestId); } } return securityHeaders(NextResponse.next(),requestId); }
  if (pathname === '/zcc' || pathname.startsWith('/zcc/')) { try { if (await authorizeZcc(request)) return securityHeaders(NextResponse.next(),requestId); } catch { /* fail closed */ } const loginUrl = new URL('/zcc/login',request.url); loginUrl.searchParams.set('callbackUrl',pathname); return securityHeaders(NextResponse.redirect(loginUrl),requestId); }
  if (pathname.startsWith('/api/')) { if (isPublicApi(pathname)) return securityHeaders(NextResponse.next(),requestId); if (!getSessionCookie(request) && !isMachineAuthorized(request)) return securityHeaders(NextResponse.json({error:'AUTH_REQUIRED',requestId},{status:401}),requestId); return securityHeaders(NextResponse.next(),requestId); }
  if (startsWithAny(pathname,PROTECTED_PAGE_PREFIXES) && !getSessionCookie(request)) { const loginUrl = new URL('/login',request.url); loginUrl.searchParams.set('callbackUrl',pathname); return securityHeaders(NextResponse.redirect(loginUrl),requestId); }
  return securityHeaders(NextResponse.next(),requestId);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'] };
