# RUN7-W1 RECON PROFUNDO — SeuZella (Auth/Tenant/RBAC/LGPD)

Data: 2026-09-18 00:01:21 | Projeto: /Users/marciocau/SeuZella_project
HEAD: 0cbc984c7a6c98bbc32360f09a2b8faf73789295 | Branch: feat/meta-zella-foundation
Tag baseline: SEUZELLA_BASELINE_CLOSURE_01
Modo: READ-ONLY (nenhuma alteracao na arvore)


== 7A) SESSION / MIDDLEWARE ==
Arquivo: src/middleware.ts (38 linhas)

```
1:import { NextRequest, NextResponse } from 'next/server';
2:import { getToken } from 'next-auth/jwt';
3:import { wafMiddleware } from '@/lib/security/waf-middleware';
4:
5:// FIX (onda Meta Foundation — auditoria): '/api/webhooks/whatsapp' é o webhook
6:// canônico da Meta Cloud API (HMAC fail-closed + idempotência + pricing). Ele
7:// DEVE ser público como os demais webhooks (/api/webhook-whatsapp, asaas,
8:// mercadopago): a autenticação aqui é a assinatura HMAC X-Hub-Signature-256,
9:// verificada dentro do handler — não a sessão NextAuth.
10:const PUBLIC_API_PREFIXES = ['/api/health','/api/readiness','/api/auth','/api/webhook-whatsapp','/api/webhooks/whatsapp','/api/webhooks/asaas','/api/webhooks/mercadopago','/api/webhooks/payment','/api/checkout/webhook','/api/webhooks/booking-com'];
11:const BLOCKED_API_PREFIXES = ['/api/debug-agent','/api/proxy','/api/diagnose'];
12:const PROTECTED_PAGE_PREFIXES = ['/zcc','/dashboard','/config','/tenants','/campaigns','/leads','/targets','/agents','/roi','/swipe-templates'];
13:const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
14:
15:function startsWithAny(pathname: string, prefixes: string[]): boolean { return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)); }
16:function isPublicApi(pathname: string): boolean { return startsWithAny(pathname, PUBLIC_API_PREFIXES); }
17:function getSessionCookie(request: NextRequest): string | undefined { return request.cookies.get('__Secure-next-auth.session-token')?.value || request.cookies.get('next-auth.session-token')?.value; }
18:function createRequestId(request: NextRequest): string { const supplied = request.headers.get('x-request-id') || request.headers.get('x-vercel-id'); return supplied && REQUEST_ID_RE.test(supplied) ? supplied : `mid-${crypto.randomUUID()}`; }
19:function securityHeaders(response: NextResponse, requestId: string): NextResponse { response.headers.set('X-Request-ID', requestId); response.headers.set('X-Content-Type-Options','nosniff'); response.headers.set('X-Frame-Options','DENY'); response.headers.set('Referrer-Policy','strict-origin-when-cross-origin'); response.headers.set('Permissions-Policy','camera=(), microphone=(self), geolocation=(), payment=()'); response.headers.set('X-DNS-Prefetch-Control','off'); response.headers.set('X-Permitted-Cross-Domain-Policies','none'); response.headers.set('X-Security-Shield','zero-trust-v4'); if (process.env.NODE_ENV === 'production') { response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload'); response.headers.set('Content-Security-Policy',["default-src 'self'","script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com","font-src 'self' data:","connect-src 'self' https://*.mercadopago.com https://api.asaas.com https://sandbox.asaas.com wss://smart-hotel-zehla.vercel.app https://*.railway.app https://*.basemaps.cartocdn.com","frame-ancestors 'none'","base-uri 'self'","form-action 'self' https://*.mercadopago.com https://*.asaas.com","frame-src 'self' https://*.mercadopago.com https://*.asaas.com"].join('; ')); } return response; }
20:async function getAuthenticatedToken(request: NextRequest) { const secret = process.env.NEXTAUTH_SECRET; if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required'); return getToken({ req: request, secret }); }
21:async function authorizeZcc(request: NextRequest): Promise<boolean> { const token = await getAuthenticatedToken(request); if (!token) return false; const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : ''; const role = typeof token.role === 'string' ? token.role : ''; const envAdmins = (process.env.ZCC_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); return ['owner', 'admin', 'system_admin'].includes(role) && envAdmins.includes(email); }
22:function timingSafeEqualStr(a: string,b: string): boolean { if (a.length !== b.length) return false; let mismatch = 0; for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i); return mismatch === 0; }
23:function isMachineAuthorized(request: NextRequest): boolean { const authHeader = request.headers.get('authorization'); if (!authHeader) return false; const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim(); if (!token) return false; const validSecrets = [process.env.CRON_SECRET,process.env.ZEHLA_LOOP_API_KEY,process.env.ZAI_API_KEY].filter((s): s is string => typeof s === 'string' && s.length >= 16); return validSecrets.length > 0 && validSecrets.some(secret => timingSafeEqualStr(token,secret)); }
24:
25:export async function middleware(request: NextRequest) {
26:  const { pathname } = request.nextUrl;
27:  const requestId = createRequestId(request);
28:  const wafResponse = wafMiddleware(request);
29:  if (wafResponse) return securityHeaders(wafResponse, requestId);
30:  if (startsWithAny(pathname,BLOCKED_API_PREFIXES) && process.env.NODE_ENV === 'production') return securityHeaders(NextResponse.json({ error:'NOT_FOUND', requestId },{status:404}),requestId);
31:  if (pathname === '/zcc/login') return securityHeaders(NextResponse.next(),requestId);
32:  if (pathname === '/ddc' || pathname.startsWith('/ddc/')) { if (pathname === '/ddc' || pathname === '/ddc/') { try { const token = await getAuthenticatedToken(request); const niche = (token as any)?.niche; return securityHeaders(NextResponse.redirect(new URL(niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada',request.url)),requestId); } catch { return securityHeaders(NextResponse.next(),requestId); } } return securityHeaders(NextResponse.next(),requestId); }
33:  if (pathname === '/zcc' || pathname.startsWith('/zcc/')) { try { if (await authorizeZcc(request)) return securityHeaders(NextResponse.next(),requestId); } catch { /* fail closed */ } const loginUrl = new URL('/zcc/login',request.url); loginUrl.searchParams.set('callbackUrl',pathname); return securityHeaders(NextResponse.redirect(loginUrl),requestId); }
34:  if (pathname.startsWith('/api/')) { if (isPublicApi(pathname)) return securityHeaders(NextResponse.next(),requestId); if (!getSessionCookie(request) && !isMachineAuthorized(request)) return securityHeaders(NextResponse.json({error:'AUTH_REQUIRED',requestId},{status:401}),requestId); return securityHeaders(NextResponse.next(),requestId); }
35:  if (startsWithAny(pathname,PROTECTED_PAGE_PREFIXES) && !getSessionCookie(request)) { const loginUrl = new URL('/login',request.url); loginUrl.searchParams.set('callbackUrl',pathname); return securityHeaders(NextResponse.redirect(loginUrl),requestId); }
36:  return securityHeaders(NextResponse.next(),requestId);
37:}
38:export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'] };
```

Matcher configurado:
  38:export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'] };

Auth lib: src/lib/auth.ts — linhas de sessao/cookie relevantes:
  76:  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  77:  callbacks: {
  104:    async jwt({ token, user, account }) {
  127:    async session({ session, token }) {
  134:        return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
  147:            return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
  154:              return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
  158:          console.error('[auth] session tenant status check failed', err);
  162:      if (session.user) {
  163:        (session.user as any).jti = jti;
  164:        (session.user as any).tenantId = (token as any).tenantId;
  165:        (session.user as any).role = (token as any).role;
  166:        (session.user as any).plan = (token as any).plan;
  167:        (session.user as any).niche = (token as any).niche;
  169:      return session;
  187: * Invalidate/Revoke a specific session by jti.
  189:export async function revokeSessionToken(jti: string, expiresAt: Date, tenantId?: string, reason?: string) {
  195:      create: { jti, tenantId, reason, expiresAt },
  198:    console.error('[auth] failed to revoke session token', err);
  203: * Check whether a session token (jti) has been revoked.
  210:    if (revoked.expiresAt < new Date()) {
  222:  const session = await getServerSession(authOptions);
  223:  const tenantId = (session?.user as any)?.tenantId;
  224:  if (!session?.user || !tenantId) redirect('/login');

Uso de sessao no codigo:
  getServerSession: 49 arquivo(s)
  requireTenant:    26 arquivo(s)
  auth() (v5):      0 arquivo(s)

Sessao/revogacao no banco:
  118:  passwordChangedAt  DateTime?
  1794:model Session {
  1817:  revokedAt  DateTime @default(now())
  1822:  @@map("revoked_sessions")
  2316:  revokedAt       DateTime?
  2317:  revokedReason   String?

Fluxo de logout/revogacao:
  src/lib/auth.ts:189:export async function revokeSessionToken(jti: string, expiresAt: Date, tenantId?: string, reason?: string) {
  src/lib/auth.ts:192:    await db.revokedSession.upsert({
  src/lib/auth.ts:194:      update: { revokedAt: new Date(), reason },
  src/lib/auth.ts:198:    console.error('[auth] failed to revoke session token', err);
  src/lib/auth.ts:203: * Check whether a session token (jti) has been revoked.
  src/lib/auth.ts:208:    const revoked = await db.revokedSession.findUnique({ where: { jti } });
  src/lib/auth.ts:209:    if (!revoked) return false;
  src/lib/auth.ts:210:    if (revoked.expiresAt < new Date()) {
  src/lib/auth.ts:212:      await db.revokedSession.delete({ where: { jti } }).catch(() => undefined);

== 7B) M2M (Human != Machine != Cron != Webhook) ==
Mecanismos de auth de maquina encontrados:
  verifyRobotToken: 4 arquivo(s)
  CRON_SECRET refs: 26 arquivo(s)
  rotas /api/cron*: 1
  rotas webhook*:   5

Libs JWT/crypto no package.json:
  76:    "@next-auth/prisma-adapter": "^1.0.7", "@octokit/rest": "^22.0.1", "@prisma/client": "^6.11.1", "@radix-ui/react-accordion": "^1.2.11", "@radix-ui/react-alert-dialog": "^1.1.14", "@radix-ui/react-aspect-ratio": "^1.1.7", "@radix-ui/react-avatar": "^1.1.10", "@radix-ui/react-checkbox": "^1.3.2", "@radix-ui/react-collapsible": "^1.1.11", "@radix-ui/react-context-menu": "^2.2.15", "@radix-ui/react-dialog": "^1.1.14", "@radix-ui/react-dropdown-menu": "^2.1.15", "@radix-ui/react-hover-card": "^1.1.14", "@radix-ui/react-label": "^2.1.7", "@radix-ui/react-menubar": "^1.1.15", "@radix-ui/react-navigation-menu": "^1.2.13", "@radix-ui/react-popover": "^1.1.14", "@radix-ui/react-progress": "^1.1.7", "@radix-ui/react-radio-group": "^1.3.2", "@radix-ui/react-scroll-area": "^1.2.9", "@radix-ui/react-select": "^2.2.5", "@radix-ui/react-separator": "^1.1.7", "@radix-ui/react-slider": "^1.3.5", "@radix-ui/react-slot": "^1.2.3", "@radix-ui/react-switch": "^1.2.5", "@radix-ui/react-tabs": "^1.1.12", "@radix-ui/react-toast": "^1.2.7", "@radix-ui/react-toggle": "^1.1.9", "@radix-ui/react-toggle-group": "^1.1.10", "@radix-ui/react-tooltip": "^1.2.7", "@tailwindcss/postcss": "^4", "@tanstack/react-query": "^5.82.0", "@tanstack/react-table": "^8.21.3", "@types/leaflet": "^1.9.22", "@types/node": "^20", "@types/react": "^19", "@types/react-dom": "^19", "@upstash/ratelimit": "^2.0.8", "@upstash/redis": "^1.38.2", "axios": "^1.7.9", "bcryptjs": "^3.0.3", "bullmq": "^6.1.2", "class-variance-authority": "^0.7.1", "clsx": "^2.1.1", "cmdk": "^1.1.1", "date-fns": "^4.1.0", "docx": "^9.7.1", "dotenv": "^17.4.2", "embla-carousel-react": "^8.6.0", "framer-motion": "^12.38.0", "input-otp": "^1.4.2", "ioredis": "^6.0.0", "jose": "^5.9.6", "leaflet": "^1.9.4", "leaflet.markercluster": "^1.5.3", "lucide-react": "^0.525.0", "mercadopago": "^3.1.0", "next": "^16.2.7", "next-auth": "^4.24.11", "next-themes": "^0.4.6", "node-ical": "^0.26.1", "nodemailer": "^9.0.3", "prisma": "^6.11.1", "qrcode": "^1.5.4", "react": "^19.2.4", "react-day-picker": "^9.8.0", "react-dom": "^19.2.4", "react-hook-form": "^7.81.0", "react-leaflet": "^5.0.0", "react-leaflet-cluster": "^4.1.3", "react-markdown": "^10.1.0", "react-resizable-panels": "^3.0.3", "react-syntax-highlighter": "^15.6.1", "recharts": "^2.15.4", "sharp": "^0.34.3", "simple-git": "^3.36.0", "socket.io": "^4.8.3", "socket.io-client": "^4.8.3", "sonner": "^2.0.6", "swr": "^2.5.1", "tailwind-merge": "^3.3.1", "tailwindcss": "^4", "tailwindcss-animate": "^1.0.7", "tw-animate-css": "^1.3.5", "typescript": "^5", "uuid": "^11.1.0", "vaul": "^1.1.2", "xlsx": "^0.18.5", "z-ai-web-dev-sdk": "^0.0.17", "zod": "^4.0.2", "zustand": "^5.0.6"

Primitivas cripto avancadas (Ed25519/EdDSA/jti/TTL/replay):
  Ed25519/EdDSA: 31 ocorrencia(s)
  jti:           53 ocorrencia(s)
  replay:        59 ocorrencia(s)
  audience/iss:  7 ocorrencia(s) em src/lib

SECRETS plaintext em codigo-fonte (APENAS local + nome; valores redacted):
  src/lib/cerebro/code-reviewer/secret-redactor.ts:283:    const password = [REDACTED];
  total: 1 ocorrencia(s)

Webhook Asaas (HMAC):
  src/app/api/webhooks/asaas/route.ts
  hmac em: src/middleware.ts
  hmac em: src/app/api/checkout/success/route.ts
  hmac em: src/app/api/zcc/github/webhook/route.ts
  hmac em: src/app/api/readiness/route.ts
  hmac em: src/app/api/webhooks/payment/route.ts
  hmac em: src/app/api/webhooks/booking-com/reviews/route.ts
  hmac em: src/app/api/webhooks/asaas/route.ts
  hmac em: src/app/api/webhooks/whatsapp/route.ts

== 7C) RBAC CANONICO (inventario de roles) ==
Literais de role no codigo (contagem por variante):
 102 'user'
  24 'owner'
  18 'admin'
  12 'staff'
   9 'system_admin'
   8 'ADMIN'
   4 'TENANT_USER'
   2 'robot'
   2 'client'

Comparacoes diretas role === (primeiras 40):
  src/middleware.ts:21:async function authorizeZcc(request: NextRequest): Promise<boolean> { const token = await getAuthenticatedToken(request); if (!token) return false; const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : ''; const role = typeof token.role === 'string' ? token.role : ''; const envAdmins = (process.env.ZCC_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); return ['owner', 'admin', 'system_admin'].includes(role) && envAdmins.includes(email); }
  src/app/ddc/DDCDashboardContent.tsx:793:                    const isUser = lastMsg?.role === 'user' || lastMsg?.from === 'user';
  src/app/api/ddc/gerente-ia/route.ts:230:    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Zellador'}: ${m.content}`)
  src/components/landing/ZellaSalesWidget.tsx:255:                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
  src/components/landing/ZellaSalesWidget.tsx:259:                      msg.role === 'user'
  src/components/landing/ZellaSalesWidget.tsx:268:                      {msg.role === 'user' && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
  src/components/ddc/ZelladorChat.tsx:172:              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
  src/components/ddc/ZelladorChat.tsx:176:                  msg.role === 'user'
  src/components/ddc/ZellaSimulator.tsx:409:                  className={`flex ${msg.role === 'guest' ? 'justify-end' : 'justify-start'}`}
  src/components/ddc/ZellaSimulator.tsx:413:                      msg.role === 'guest'
  src/components/ddc/ZellaSimulator.tsx:419:                    {msg.role === 'zella' && msg.isBundled && msg.bundledCount && msg.bundledCount >= 2 && (
  src/components/ddc/ZellaSimulator.tsx:430:                    <div className={`text-[9px] mt-1 ${msg.role === 'guest' ? 'text-white/50 text-right' : 'text-white/30'}`}>
  src/components/ddc/ConversationCard.tsx:123:            {lastMessage?.role === 'assistant' ? (
  src/components/ddc/ConversationCard.tsx:125:            ) : lastMessage?.role === 'user' ? (
  src/components/ddc/AILiveFeed.tsx:378:                      const msgFrom = message.from || (message.role === 'user' ? 'guest' : message.role === 'assistant' ? 'ai' : 'human');
  src/components/dashboard/ZeladorSuporteModal.tsx:125:      const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || 'Dúvida geral no painel';
  src/components/dashboard/ZeladorSuporteModal.tsx:245:                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
  src/components/dashboard/ZeladorSuporteModal.tsx:247:                {msg.role === 'assistant' && (
  src/components/dashboard/ZeladorSuporteModal.tsx:254:                    msg.role === 'user'
  src/components/zcc/panels/sandbox-panel.tsx:1141:                          message.role === "guest"
  src/lib/security/api-guard.ts:38:      if (options.role === 'ADMIN' && role !== 'ADMIN' && role !== 'owner') {
  src/lib/security/api-guard.ts:41:      if (options.role === 'TENANT_USER' && !['TENANT_USER', 'owner', 'admin', 'staff'].includes(role)) {
  src/lib/zcc/agents/llm-engine.ts:56:  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  src/lib/ai/llm-adapters.ts:128:  const systemMessage = params.messages.find(m => m.role === 'system');
  src/lib/ai/llm-adapters.ts:141:      role: m.role === 'assistant' ? 'assistant' : 'user',
  src/lib/ai/llm-adapters.ts:179:  const systemMessage = params.messages.find(m => m.role === 'system');
  src/lib/ai/llm-adapters.ts:183:    role: m.role === 'assistant' ? 'model' : 'user',
  src/lib/ai/llm-adapters.ts:285:    if (m.role === 'tool' && m.tool_call_id) {
  src/lib/ai/llm-adapters.ts:288:    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
  src/lib/ai/llm-adapters.ts:370:  const systemMessage = params.messages.find(m => m.role === 'system');
  src/lib/ai/llm-adapters.ts:378:    if (msg.role === 'tool') {
  src/lib/ai/llm-adapters.ts:392:    } else if (msg.role === 'assistant') {
  src/lib/ai/llm-adapters.ts:530:  const systemMessage = params.messages.find(m => m.role === 'system');
  src/lib/ai/llm-adapters.ts:538:    if (msg.role === 'tool') {
  src/lib/ai/llm-adapters.ts:561:    } else if (msg.role === 'assistant') {
  src/lib/zcc-security.ts:150:      const role = typeof token?.role === 'string' ? token.role : '';
  total de comparacoes: 36

Helpers de autorizacao (definicoes):
  src/lib/zcc-security.ts:172:export async function verifyZCCAccessOrReject(request: NextRequest): Promise<ZCCSecurityResult> {

Gate de plataforma ZCC:
  arquivos usando zcc-security: 78

== 7D/7H) TENANT AUTHORITY — VARREDURA DAS ROTAS (matriz) ==
Classificando cada rota em 7 dimensoes (heuristica de fonte, fail-soft)...
Legenda AUTH: SESSION | ZCC_PLATFORM | M2M_ROBOT | CRON_SECRET | WEBHOOK_HMAC | UNKNOWN
Legenda TENANT_SOURCE: SESSION(requireTenant) | PATH_PARAM | BODY_PRESENT | QUERY_PRESENT | HEADER_PRESENT | NONE_VISIBLE
Risco: OK | REVIEW_AUTH | REVIEW_TENANT_SRC (+ combinacoes)

ROTAS VARREDAS   : 320
AUTH=UNKNOWN     : 146 (rotas sem sinal claro de autenticacao)
REVIEW_AUTH      : 146
REVIEW_TENANT_SRC: 14 (tenantId visivel em body/query/header SEM sessao/path como autoridade)

WORKLIST W2 (rotas a revisar):
  "route":"/api/airb-test","file":"src/app/api/airb-test/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/alexa/smart-home","file":"src/app/api/alexa/smart-home/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/[...nextauth]","file":"src/app/api/auth/[...nextauth]/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/forgot-password","file":"src/app/api/auth/forgot-password/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/m2m/token","file":"src/app/api/auth/m2m/token/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/magic-link","file":"src/app/api/auth/magic-link/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/register","file":"src/app/api/auth/register/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/auth/reset-password","file":"src/app/api/auth/reset-password/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/bim-vision","file":"src/app/api/bim-vision/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"BODY_PRESENT"
  "route":"/api/brain","file":"src/app/api/brain/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/bulk-whatsapp","file":"src/app/api/bulk-whatsapp/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/channel-manager","file":"src/app/api/channel-manager/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/backup-restore-drill","file":"src/app/api/cron/backup-restore-drill/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/budget-reset","file":"src/app/api/cron/budget-reset/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/cerebro-cleanup","file":"src/app/api/cron/cerebro-cleanup/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/cerebro-learning","file":"src/app/api/cron/cerebro-learning/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/cerebro-night-audit","file":"src/app/api/cron/cerebro-night-audit/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/cerebro-night-pentest","file":"src/app/api/cron/cerebro-night-pentest/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/cerebro-night-pulse","file":"src/app/api/cron/cerebro-night-pulse/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/dlq-drain","file":"src/app/api/cron/dlq-drain/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/housekeeping-dispatch","file":"src/app/api/cron/housekeeping-dispatch/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/ical-sync","file":"src/app/api/cron/ical-sync/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/learning-cycle","file":"src/app/api/cron/learning-cycle/route.ts","methods":"GET, POST","auth":"CRON_SECRET","tenantSource":"QUERY_PRESENT"
  "route":"/api/cron/lembrete-checkin","file":"src/app/api/cron/lembrete-checkin/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/metrics-snapshot","file":"src/app/api/cron/metrics-snapshot/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/monthly-billing","file":"src/app/api/cron/monthly-billing/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/nps-checkout","file":"src/app/api/cron/nps-checkout/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/payment-confirmation","file":"src/app/api/cron/payment-confirmation/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/security-scan","file":"src/app/api/cron/security-scan/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/cron/sre-alerts","file":"src/app/api/cron/sre-alerts/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/dashboard/bookings","file":"src/app/api/dashboard/bookings/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/dashboard/overview","file":"src/app/api/dashboard/overview/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/dashboard","file":"src/app/api/dashboard/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/ai-status","file":"src/app/api/ddc/ai-status/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/commissions/[id]","file":"src/app/api/ddc/airb-pro/commissions/[id]/route.ts","methods":"DELETE, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/expenses/[id]","file":"src/app/api/ddc/airb-pro/expenses/[id]/route.ts","methods":"DELETE, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/goals/[id]","file":"src/app/api/ddc/airb-pro/goals/[id]/route.ts","methods":"DELETE, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/goals","file":"src/app/api/ddc/airb-pro/goals/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/operations/[id]","file":"src/app/api/ddc/airb-pro/operations/[id]/route.ts","methods":"DELETE, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/operations","file":"src/app/api/ddc/airb-pro/operations/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb-pro/reports","file":"src/app/api/ddc/airb-pro/reports/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/conversations","file":"src/app/api/ddc/airb/conversations/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/notifications","file":"src/app/api/ddc/airb/notifications/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/onboarding","file":"src/app/api/ddc/airb/onboarding/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/properties","file":"src/app/api/ddc/airb/properties/route.ts","methods":"DELETE, GET, PATCH, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/regional","file":"src/app/api/ddc/airb/regional/route.ts","methods":"DELETE, GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/airb/scrape","file":"src/app/api/ddc/airb/scrape/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/bookings","file":"src/app/api/ddc/bookings/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/cerebro/feedback","file":"src/app/api/ddc/cerebro/feedback/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/cerebro/learning","file":"src/app/api/ddc/cerebro/learning/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/conversations/[id]/escalate","file":"src/app/api/ddc/conversations/[id]/escalate/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/conversations/[id]/messages","file":"src/app/api/ddc/conversations/[id]/messages/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/conversations/[id]","file":"src/app/api/ddc/conversations/[id]/route.ts","methods":"GET, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/conversations","file":"src/app/api/ddc/conversations/route.ts","methods":"DELETE, GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/credits/lite-milestone","file":"src/app/api/ddc/credits/lite-milestone/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/credits/referrals","file":"src/app/api/ddc/credits/referrals/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/credits/track-click","file":"src/app/api/ddc/credits/track-click/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/deliveries","file":"src/app/api/ddc/deliveries/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/dynamic-pricing/calculate","file":"src/app/api/ddc/dynamic-pricing/calculate/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/dynamic-pricing","file":"src/app/api/ddc/dynamic-pricing/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/guest-guide","file":"src/app/api/ddc/guest-guide/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/guests/[id]","file":"src/app/api/ddc/guests/[id]/route.ts","methods":"DELETE, GET, PUT","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/housekeeping","file":"src/app/api/ddc/housekeeping/route.ts","methods":"GET, PATCH, POST","auth":"UNKNOWN","tenantSource":"BODY_PRESENT"
  "route":"/api/ddc/learning-stats","file":"src/app/api/ddc/learning-stats/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/linkinbio/activate-standalone","file":"src/app/api/ddc/linkinbio/activate-standalone/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/linkinbio/purchase-addon","file":"src/app/api/ddc/linkinbio/purchase-addon/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/linkinbio","file":"src/app/api/ddc/linkinbio/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/linkinbio/stats","file":"src/app/api/ddc/linkinbio/stats/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/live-feed","file":"src/app/api/ddc/live-feed/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/[id]/panic-revoke","file":"src/app/api/ddc/locks/[id]/panic-revoke/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/[id]/pins/[pinId]","file":"src/app/api/ddc/locks/[id]/pins/[pinId]/route.ts","methods":"DELETE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/[id]/pins","file":"src/app/api/ddc/locks/[id]/pins/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/[id]","file":"src/app/api/ddc/locks/[id]/route.ts","methods":"DELETE, GET, PATCH","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/[id]/unlock","file":"src/app/api/ddc/locks/[id]/unlock/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/oauth/[provider]/callback","file":"src/app/api/ddc/locks/oauth/[provider]/callback/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/oauth/[provider]/devices","file":"src/app/api/ddc/locks/oauth/[provider]/devices/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks/oauth/[provider]/start","file":"src/app/api/ddc/locks/oauth/[provider]/start/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/locks","file":"src/app/api/ddc/locks/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/meta-connect","file":"src/app/api/ddc/meta-connect/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/metrics","file":"src/app/api/ddc/metrics/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/notifications/read-all","file":"src/app/api/ddc/notifications/read-all/route.ts","methods":"PUT","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/notifications","file":"src/app/api/ddc/notifications/route.ts","methods":"GET, PUT","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/notifications/v2","file":"src/app/api/ddc/notifications/v2/route.ts","methods":"GET, POST, PUT","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/partner-program/status","file":"src/app/api/ddc/partner-program/status/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/partner-program/waitlist","file":"src/app/api/ddc/partner-program/waitlist/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/property-name","file":"src/app/api/ddc/property-name/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/runtime-version","file":"src/app/api/ddc/runtime-version/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/training/[id]","file":"src/app/api/ddc/training/[id]/route.ts","methods":"DELETE, POST, PUT","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ddc/training","file":"src/app/api/ddc/training/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/debug-agent/github","file":"src/app/api/debug-agent/github/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/debug-agent/knowledge","file":"src/app/api/debug-agent/knowledge/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/debug-agent","file":"src/app/api/debug-agent/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/diagnose","file":"src/app/api/diagnose/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/download/[filename]","file":"src/app/api/download/[filename]/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/export/leads","file":"src/app/api/export/leads/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/feedback","file":"src/app/api/feedback/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/feedback/stats","file":"src/app/api/feedback/stats/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/guide/[slug]","file":"src/app/api/guide/[slug]/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/health","file":"src/app/api/health/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/hunt-stream","file":"src/app/api/hunt-stream/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/ical/[syncToken]","file":"src/app/api/ical/[syncToken]/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/integrations/ical/[roomId]","file":"src/app/api/integrations/ical/[roomId]/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/integrations/sync","file":"src/app/api/integrations/sync/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/internal/flush-buffer","file":"src/app/api/internal/flush-buffer/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/knowledge/generate-embeddings","file":"src/app/api/knowledge/generate-embeddings/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/landing/chat","file":"src/app/api/landing/chat/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/landing/contact","file":"src/app/api/landing/contact/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/leads/analytics","file":"src/app/api/leads/analytics/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/leads/seed","file":"src/app/api/leads/seed/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/lgpd/consent","file":"src/app/api/lgpd/consent/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"BODY_PRESENT"
  "route":"/api/lgpd/delete-my-data","file":"src/app/api/lgpd/delete-my-data/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"BODY_PRESENT"
  "route":"/api/lgpd/dpa","file":"src/app/api/lgpd/dpa/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/pinns-clifford","file":"src/app/api/pinns-clifford/route.ts","methods":"NONE","auth":"UNKNOWN","tenantSource":"BODY_PRESENT"
  "route":"/api/proxy/[...path]","file":"src/app/api/proxy/[...path]/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/pulse/io","file":"src/app/api/pulse/io/route.ts","methods":"GET, POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/push/subscribe","file":"src/app/api/push/subscribe/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/push/unsubscribe","file":"src/app/api/push/unsubscribe/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/push/vapid-public-key","file":"src/app/api/push/vapid-public-key/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/roi","file":"src/app/api/roi/route.ts","methods":"POST","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"
  "route":"/api/route.ts","file":"src/app/api/route.ts","methods":"GET","auth":"UNKNOWN","tenantSource":"NONE_VISIBLE"

Matriz completa: 99_AUDITS/RUN7_W1_20260918_000121/RUN7_TENANT_MATRIX.json

== 7E) PUSH / CAPABILITY ==
Primitiva (assinatura pos-RUN6B):
  122:export async function removePushSubscription(
  123-  endpoint: string,
  124-  tenantId: string,
  125-): Promise<{ success: boolean }> {
  126-  if (!(await isDatabaseAvailable())) {
  127-    return { success: false };

RES-14 (reassign por endpoint): 1 ocorrencia(s) — residual P3 documentado
Capability tokens: 6 ocorrencia(s)

Rotas de push:
  src/app/api/push

== 7F) LGPD (Lei 13.709/2018 — controles tecnicos) ==
  rotas *consent*: 2
    src/app/api/lgpd/consent/route.ts
    src/app/api/zcc/consent/route.ts
  rotas *delete*: 1
    src/app/api/lgpd/delete-my-data/route.ts
  rotas *export*: 4
    src/app/api/lgpd/export-my-data/route.ts
    src/app/api/zcc/semantica/export/route.ts
    src/app/api/zcc/export/route.ts
    src/app/api/export/leads/route.ts
  rotas *dpo*: 1
    src/app/api/ddc/dpo-capture/route.ts

Servicos LGPD em src/lib:
  src/lib/ical-import-engine.ts
  src/lib/lgpd-consent.ts
  src/lib/locks/providers/august.ts
  src/lib/locks/orchestrator.ts
  src/lib/llm/llm-router.ts
  src/lib/llm/prompt-guard.ts
  src/lib/lgpd/retention-policy.ts
  src/lib/lgpd/lgpd-service.ts
  src/lib/phone-utils.ts
  src/lib/security/zehla-fortress-brain.ts

== 7G) FNRH (hospedagem/registro de hospedes) ==
  arquivos FNRH em src: 1
  src/lib/fnrh

== HIGIENE (snapshot p/ FASE 8 — nao tocado nesta fase) ==
  as any:      558
  @ts-ignore:  4
  lockfiles:   bun.lock package-lock.json

== GAPS.JSON (contrato para os patches W2) ==

Relatorio: 99_AUDITS/RUN7_W1_20260918_000121/RUN7_RECON_REPORT.md
Gaps:      99_AUDITS/RUN7_W1_20260918_000121/RUN7_GAPS.json

FIM DO RECON (read-only — nada foi alterado, nada commitado)
