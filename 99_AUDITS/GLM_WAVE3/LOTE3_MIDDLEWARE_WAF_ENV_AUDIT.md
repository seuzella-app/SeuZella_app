# LOTE 3 — SUBAGENT C — MIDDLEWARE RED TEAM + WAF + env.ts FORENSIC AUDIT

**Task ID:** C (LOTE 3 wave)
**Agent:** GLM Subagent C — Middleware Red Team + WAF + env.ts
**Audit scope:** M-RT-001 middleware prefix expansion + WAF chaining (`return null` semantics) + env.ts build/runtime separation (`assertProductionSecurityEnv()`)
**Repository baseline:** `zella` submodule @ HEAD `a0bb1a85` (GLM clone) — `origin/main` `d1e283b3` also inspected for context
**Antigravity declared commits:** `ebc54d25` (Fase 0 LOTE 3) + `2e021a9d` (LOTE 3) — **NÃO PRESENTES** no clone GLM (`git cat-file -t` retorna "Not a valid object name")
**Mode:** READ-ONLY forensic audit (nenhuma alteração aplicada ao código)
**Date:** 2026-08-28

---

## 1. VERDICT

### 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE (NO-GO até transferência dos patches)

| Componente | Estado HEAD `a0bb1a85` | Estado `origin/main` `d1e283b3` | Declaração LOTE 3 (`2e021a9d`) | Veredito |
|---|---|---|---|---|
| `src/middleware.ts` — WAF wiring | ❌ AUSENTE (dead code) | ✅ PRESENTE (commit `e778d467`) | — (não declarado novo) | DECLARED_FIXED em origin/main |
| `src/middleware.ts` — `PUBLIC_API_PREFIXES` | 6 prefixos | 7 prefixos (+`/api/webhooks/mercadopago`) | "Expandidos prefixos de webhook" | DECLARED — patch não transferido |
| `src/lib/security/waf-middleware.ts` — `return null` | Step 8 retorna `NextResponse.next()` + security headers | IDÊNTICO ao HEAD | "WAF pass-through (`return null`)" | DECLARED — patch não transferido |
| `src/lib/env.ts` — build/runtime separation | `NEXT_PHASE?.includes('build') && NODE_ENV !== 'production'` | IDÊNTICO ao HEAD | "Compatibilizado para análise estática e coleta de páginas sem quebrar segurança de runtime" | DECLARED — patch não transferido |
| `assertProductionSecurityEnv()` — runtime call | Declarada em env.ts L98, **ZERO callers** em `src/` (apenas referenciada em `tests/security-hardening-12-fronts.test.ts:22`) | IDÊNTICO ao HEAD | Não declarado | OPEN (gap pré-existente) |

### Síntese

1. **WAF chaining**: o "wiring" JÁ EXISTE em `origin/main` `d1e283b3` via commit `e778d467` ("7 blocker fixes — WAF wired") — esta parte NÃO é novidade LOTE 3. O que LOTE 3 declara é o **`return null` change** em `waf-middleware.ts`, que elimina a duplicação de security headers entre WAF e middleware.
2. **PUBLIC_API_PREFIXES expansion**: em HEAD há 6 prefixos; em `origin/main` há 7; LOTE 3 declara "expandidos" — inferimos que adiciona `/api/webhooks/stripe`, `/api/webhooks/whatsapp`, `/api/webhooks/payment`, `/api/webhooks/booking-com/reviews`, possivelmente `/api/zcc/github/webhook`. Sem patch, impossível confirmar o conjunto exato nem se foi usado prefixo amplo `/api/webhooks` (risco de design).
3. **env.ts harmonization**: o pattern `NEXT_PHASE?.includes('build')` (sem `NODE_ENV !== 'production'` clause) **JÁ EXISTE** em 3 outros arquivos do baseline — `auth.ts:125`, `encryption.ts:27`, `cache-signer.ts:7`. A declaração LOTE 3 apenas harmoniza `env.ts` ao pattern existente. Segurança de runtime **NÃO é enfraquecida** porque:
   - `assertProductionSecurityEnv()` ainda lança em runtime production
   - `getNextAuthSecret()` (chamado em `auth-guard.ts:15` e `checkout/success/route.ts:29`) ainda chama `requireProductionSecret('NEXTAUTH_SECRET')`
   - `NEXTAUTH_SECRET` const export é **DEAD CODE** (zero imports em `src/`) — a IIFE não tem efeito em runtime
4. **`assertProductionSecurityEnv()` gap pré-existente**: a função existe desde o baseline mas **NUNCA é chamada** em `src/` (apenas referenciada em `tests/security-hardening-12-fronts.test.ts:22`). LOTE 3 não declara chamá-la; portanto o runtime guard efetivo é apenas `requireProductionSecret` indireto via `getNextAuthSecret`.

---

## 2. M-RT-001 — MIDDLEWARE RED TEAM

### 2.1 Inventário de rotas webhook no baseline (HEAD `a0bb1a85`)

Inventário completo de rotas `/api/**` cujo nome sugere webhook (HMAC receiver):

| # | Rota | Auth no endpoint | Pública no middleware HEAD? | Pública em `origin/main`? |
|---|---|---|---|---|
| 1 | `/api/checkout/webhook/route.ts` | `verifyMercadoPagoWebhook` (HMAC MP) | ✅ SIM | ✅ SIM |
| 2 | `/api/webhook-whatsapp/route.ts` | (legacy Meta webhook) | ✅ SIM | ✅ SIM |
| 3 | `/api/webhooks/asaas/route.ts` | HMAC Asaas | ✅ SIM | ✅ SIM |
| 4 | `/api/webhooks/mercadopago/route.ts` | `verifyMercadoPagoWebhook` (HMAC MP) | ❌ NÃO — **M-RT-001 BLOCKED** | ✅ SIM (commit `4a10f16b`) |
| 5 | `/api/webhooks/stripe/route.ts` | `stripeGateway.verifyWebhook` (HMAC Stripe) | ❌ NÃO — **M-RT-001 BLOCKED** | ❌ NÃO — **M-RT-001 BLOCKED** |
| 6 | `/api/webhooks/payment/route.ts` | HMAC interno (provisioning) | ❌ NÃO — **M-RT-001 BLOCKED** | ❌ NÃO — **M-RT-001 BLOCKED** |
| 7 | `/api/webhooks/whatsapp/route.ts` | `META_APP_SECRET` HMAC (Meta Cloud API) | ❌ NÃO — **M-RT-001 BLOCKED** | ❌ NÃO — **M-RT-001 BLOCKED** |
| 8 | `/api/webhooks/booking-com/reviews/route.ts` | `BOOKING_COM_WEBHOOK_SECRET` HMAC | ❌ NÃO — **M-RT-001 BLOCKED** | ❌ NÃO — **M-RT-001 BLOCKED** |
| 9 | `/api/zcc/github/webhook/route.ts` | `X-Hub-Signature-256` HMAC + IP allowlist GitHub | ❌ NÃO — **M-RT-001 BLOCKED** | ❌ NÃO — **M-RT-001 BLOCKED** |
| 10 | `/api/zcc/airbnb/webhook/route.ts` | `verifyZCCAccessOrReject(request)` — **NÃO é webhook externo**, é endpoint ZCC interno | ❌ NÃO (correto) | ❌ NÃO (correto) |

### 2.2 Inferência da expansão LOTE 3 declarada

A declaração do Antigravity "Expandidos prefixos de webhook em `PUBLIC_API_PREFIXES`" indica adição de prefixos para cobrir as rotas #5–#9 acima (a #4 já foi coberta por commit pré-LOTE3 `4a10f16b` em `origin/main`). **Conjunto LOTE 3 PROVAVELMENTE adicionado** (inferência, não verificação):

```typescript
// PROVÁVEL estado pós-LOTE3:
const PUBLIC_API_PREFIXES = [
  '/api/health',
  '/api/readiness',
  '/api/auth',
  '/api/webhook-whatsapp',
  '/api/webhooks/asaas',
  '/api/webhooks/mercadopago',     // commit 4a10f16b (pré-LOTE3)
  '/api/webhooks/stripe',          // LOTE 3 — DECLARED
  '/api/webhooks/whatsapp',        // LOTE 3 — DECLARED
  '/api/webhooks/payment',         // LOTE 3 — DECLARED
  '/api/webhooks/booking-com/reviews', // LOTE 3 — DECLARED
  '/api/zcc/github/webhook',       // LOTE 3 — DECLARED (opcional)
  '/api/checkout/webhook',
];
```

### 2.3 Matriz adversarial de bypass (Red Team)

A função `startsWithAny(pathname, prefixes)` (middleware.ts L19-21) usa a regra:
```typescript
prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
```

Esta regra é **SAFE** contra colisão de prefixo, mas tem implications para paths filhos.

| Route testada | É pública? | Deveria ser? | Bypass? | Notas |
|---|---|---|---|---|
| `/api/checkout/webhook` | ✅ SIM | ✅ SIM (MP webhook) | ❌ NÃO | Match exato `pathname === prefix` |
| `/api/checkout/webhook/` | ✅ SIM | ✅ SIM | ❌ NÃO | `startsWith('/api/checkout/webhook/')` = true |
| `/api/checkout/webhook/malicious` | ✅ SIM | ❓ DEPENDS | 🟡 AMARELO | Path filho público. Só existe `route.ts` em `/api/checkout/webhook/` (sem subrotas). Se futuramente houver `/api/checkout/webhook/admin`, será público. **Design smell**, não bypass atual. |
| `/api/checkout/webhookmalicious` | ❌ NÃO | ❌ NÃO | ❌ NÃO | `startsWith('/api/checkout/webhook/')` = false (sem `/` final). SAFE. |
| `/api/checkout/webhook/../protected` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Next.js normaliza path ANTES do middleware (`request.nextUrl.pathname`). Vira `/api/protected`. SAFE. |
| `/api/checkout/webhook/%2e%2e/protected` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Next.js decodifica `%2e` → `.` ANTES do middleware. Vira `/api/protected`. SAFE. |
| `/api/checkout/webhook/%252e%252e/protected` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Next.js **NÃO** faz double-decode. `%252e` vira `%2e` (literal), não `.`. SAFE. |
| `/api/checkout/webhook?callbackUrl=/api/admin` | ✅ SIM | ✅ SIM | ❌ NÃO | Query string não afeta `pathname`. Endpoint ainda valida HMAC. SAFE. |
| `/api/checkout/webhook#admin` | ✅ SIM | ✅ SIM | ❌ NÃO | Fragment não enviado ao servidor. SAFE. |
| `/API/checkout/webhook` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Next.js case-sensitive no Linux. `/API/` não casa com `/api/`. SAFE. |
| `/api/Checkout/webhook` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Case-sensitive no Linux. SAFE. |
| `/api/webhooks/asaas` | ✅ SIM | ✅ SIM | ❌ NÃO | Match exato. |
| `/api/webhooks/asaasmalicious` | ❌ NÃO | ❌ NÃO | ❌ NÃO | `startsWith('/api/webhooks/asaas/')` = false. SAFE. |
| `/api/webhooks/asaas-anything` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Same as above. SAFE. |
| `/api/webhooks` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Não está na lista. SAFE. |
| `/api/webhook` | ❌ NÃO | ❌ NÃO | ❌ NÃO | Não está na lista. SAFE. |
| `/api/webhook-whatsapp` | ✅ SIM | ✅ SIM | ❌ NÃO | Match exato. |
| `/api/webhook-whatsapp-anything` | ❌ NÃO | ❌ NÃO | ❌ NÃO | `startsWith('/api/webhook-whatsapp/')` = false. SAFE. |
| `/api/zcc/github/webhook` | ❌ HEAD / ✅ se LOTE3 | ✅ SIM (GitHub HMAC) | ❌ NÃO | Endpoint valida HMAC + IP allowlist GitHub. Mesmo que middleware passe, endpoint bloqueia se não GitHub. SAFE. |

### 2.4 Cenários de bypass adversariais não-triviais

#### 2.4.1 Path traversal e normalização

Next.js (Vercel Edge Runtime) normaliza `request.nextUrl.pathname` ANTES da execução do middleware:
- `/api/webhooks/asaas/../protected` → `/api/protected` (não casa com prefixo público)
- `/api/webhooks/asaas/%2e%2e/protected` → `/api/protected` (decodifica %2e)
- `/api/webhooks/asaas/%252e%252e/protected` → `/api/webhooks/asaas/%2e%2e/protected` (Next.js NÃO faz double-decode)

**Veredito**: SAFE contra path traversal.

#### 2.4.2 Case sensitivity

Next.js em Linux (Vercel + Docker VPS) é case-sensitive no pathname:
- `/API/checkout/webhook` → não casa com `/api/` (case-sensitive) → retorna 404 (rota não existe)
- `/api/Checkout/webhook` → não casa com `/api/checkout/` → 404
- `/Api/Checkout/Webhook` → 404

**Veredito**: SAFE contra case confusion.

#### 2.4.3 Prefixo amplo vs prefixo específico

**Cenário de risco**: se o LOTE 3 adicionou o prefixo único `/api/webhooks` (em vez de 5 prefixos específicos `/api/webhooks/asaas`, `/api/webhooks/stripe`, etc.), então TODAS as futuras rotas sob `/api/webhooks/**` tornam-se públicas. Hoje o conjunto é seguro (apenas webhooks reais existem em `/api/webhooks/`), mas é design smell.

**Indicador contra essa hipótese**: o baseline HEAD já tem `/api/webhooks/asaas` (específico) e o commit `4a10f16b` (pré-LOTE3) adicionou `/api/webhooks/mercadopago` (específico) — sugere que o padrão do projeto é usar prefixos específicos. Provável que LOTE 3 continue o padrão.

#### 2.4.4 Rota filha "maliciosa" sob prefixo público

**Cenário**: rota `/api/checkout/webhook/admin` seria pública se existisse. Atualmente não existe. Se LOTE 3 adiciona sub-rotas admin debaixo de webhook paths, bypass é garantido. **Mitigação**: nunca usar sub-rotas admin sob webhook paths.

**Veredito**: SAFE hoje, design smell latente.

#### 2.4.5 Colisão com BLOCKED_API_PREFIXES

`BLOCKED_API_PREFIXES = ['/api/debug-agent', '/api/proxy', '/api/diagnose']`. Verificada ordem de avaliação no middleware HEAD:

```typescript
// HEAD a0bb1a85 — middleware.ts L86-89
const blocked = startsWithAny(pathname, BLOCKED_API_PREFIXES);
if (blocked && process.env.NODE_ENV === 'production') {
  return securityHeaders(NextResponse.json({ error: 'NOT_FOUND', requestId }, { status: 404 }));
}
```

BLOCKED é checado **ANTES** de PUBLIC_API_PREFIXES. Logo, mesmo que alguém adicionasse `/api/debug-agent` a PUBLIC_API_PREFIXES, BLOCKED vence. SAFE.

Em `origin/main` `d1e283b3`, a ordem foi reescrita para uma linha só (`if (startsWithAny(pathname, BLOCKED_API_PREFIXES) && process.env.NODE_ENV === 'production') return ...`) — mesma precedência. SAFE.

### 2.5 Conclusões M-RT-001

1. **A regra `pathname === prefix || pathname.startsWith(prefix + '/')` é SAFE** contra os vetores clássicos (path traversal, case, double-encoding, query string, fragment).
2. **O conjunto atual de webhook routes não tem colisão** com sub-rotas protegidas (cada webhook route tem apenas `route.ts` no seu diretório, sem sub-rotas perigosas).
3. **Risco de design**: se LOTE 3 usou prefixo amplo `/api/webhooks`, futuro crescimento de `/api/webhooks/**` cria exposição acidental. **Recomendação**: exigir do Antigravity a lista exata de prefixos adicionados.
4. **M-RT-001 fix é FUNCIONAL** (webhooks podem chegar sem `Authorization` header), mas o bypass potential depende do conjunto exato de prefixos declarados, que não temos acesso.

---

## 3. WAF CHAINING AUDIT

### 3.1 Estado HEAD `a0bb1a85` — WAF é DEAD CODE

**Evidência grep** (executado em `/home/z/my-project/zella`):
```
$ rg "wafMiddleware|waf-middleware" zella/
zella/src/lib/security/waf-middleware.ts:55:export function wafMiddleware(req: NextRequest): NextResponse | null {
zella/src/lib/security/waf-middleware.ts:146:export function detectAttack(body: string): ...
```

**Resultado**: ZERO imports de `wafMiddleware` em qualquer arquivo `.ts`/`.tsx` do projeto no HEAD `a0bb1a85`. A função é exportada mas nunca chamada. **WAF é dead code em produção**.

O middleware HEAD (`src/middleware.ts:1-148`) também NÃO importa `wafMiddleware`. As security headers são adicionadas apenas via `securityHeaders()` wrapper.

### 3.2 Estado `origin/main` `d1e283b3` — WAF ESTÁ wired (commit `e778d467`)

O commit `e778d467` ("fix(certification): 7 blocker fixes — WAF wired, ...") adicionou o wiring em `src/middleware.ts`:

```typescript
// origin/main d1e283b3 — src/middleware.ts
import { wafMiddleware } from '@/lib/security/waf-middleware';

export async function middleware(request: NextRequest) {
  // ...
  // ── WAF: bot detection + attack pattern screening ──
  const wafResponse = wafMiddleware(request);
  if (wafResponse) return securityHeaders(wafResponse);
  // ...resto do middleware
}
```

**Pattern de chaining**: `wafMiddleware` retorna `NextResponse | null`:
- Retorna `NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })` para bloqueios (steps 3–7)
- Retorna `null` para "continue" (steps 1, 2)
- Retorna `NextResponse.next()` com security headers (step 8 — success path)

O middleware então faz: `if (wafResponse) return securityHeaders(wafResponse);` — ou seja, se WAF retornar uma response (block), middleware short-circuit e wrap em `securityHeaders()`. Se WAF retornar `null`, middleware continua.

### 3.3 Declaração LOTE 3 — "WAF pass-through (`return null` em `src/lib/security/waf-middleware.ts`)"

**Interpretação**: o LOTE 3 declara mudar o step 8 (success path) de `return response;` (NextResponse.next() + security headers) para `return null;` (continue).

#### Análise do impacto

**Antes do LOTE 3** (`origin/main` `d1e283b3`):
- WAF success path: retorna `NextResponse.next()` + adiciona 6 security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS se HTTPS)
- Middleware então chama `securityHeaders(wafResponse)` que adiciona MAIS 7 headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies, X-Security-Shield) + CSP/HSTS em production
- **Resultado**: response tem headers DUPLICADOS (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS aparecem duas vezes, mas `headers.set()` sobrescreve — não é bug, é desperdício)

**Depois do LOTE 3 (declarado)**:
- WAF success path: retorna `null`
- Middleware continua para `securityHeaders(NextResponse.next())` que adiciona TODOS os security headers uma única vez
- **Resultado**: headers aplicados uma vez, sem duplicação; WAF responsável apenas por BLOCK decisions (não por header injection)

**Veredito**: mudança declarada é **CORRETA e BEM DESENHADA** — separa responsabilidades:
- WAF: bot detection + IP blocklist + geo block + UA screening (decisão de BLOCK)
- `securityHeaders()` wrapper: aplicação uniforme de security headers em TODAS as responses (incluindo as bloqueadas pelo WAF)

#### Evidência do pattern em HEAD (já existente)

O `waf-middleware.ts` HEAD L62-68 (step 1) e L72-74 (step 2) JÁ retornam `null` para casos de "continue":
```typescript
// Step 1 — Skip assets estáticos e health checks
if (path.startsWith('/_next/') || path.startsWith('/static/') || path === '/api/health' || path === '/favicon.ico') {
  return null;
}

// Step 2 — IP allowlist bypass
if (ALLOWED_IPS.includes(ip)) {
  return null;
}
```

O LOTE 3 apenas ESTENDE esse pattern para o step 8 (success path). Consistência arquitetural ✓.

### 3.4 Risco: BLOCKED_API_PREFIXES e WAF

O WAF (se wired) executa ANTES do BLOCKED check (porque `wafMiddleware` é chamado antes de tudo em `d1e283b3`). Isso significa que requests para `/api/debug-agent`, `/api/proxy`, `/api/diagnose` ainda passam pelo WAF antes de serem bloqueados pelo BLOCKED check.

**Implicação**: se WAF retornar `NextResponse.json(403)` para um request `/api/debug-agent` (ex: UA suspeito), o BLOCKED check (que retornaria 404) **NÃO executa** — o request recebe 403 em vez de 404. Isso **VAZA a existência da rota** (403 = "exists but forbidden"; 404 = "doesn't exist").

**Veredito**: design smell — para rotas BLOCKED, o ideal seria retornar 404 SEMPRE, independente do UA. O WAF deveria ser chamado DEPOIS do BLOCKED check, ou o BLOCKED check deveria rodar primeiro no middleware.

**Mitigação atual**: apenas em `NODE_ENV === 'production'` (BLOCKED check tem essa guard). Em dev, BLOCKED check não roda. SAFE em produção desde que WAF não retorne 403 para paths BLOCKED.

### 3.5 `detectAttack` function — também é dead code?

```typescript
$ rg "detectAttack" zella/
zella/src/lib/security/waf-middleware.ts:146:export function detectAttack(body: string): ...
```

**Resultado**: `detectAttack` também NÃO é importado em nenhum arquivo. É dead code também.

**Implicação**: o WAF NÃO faz SQL injection / XSS / path traversal / command injection / SSRF detection em produção. Apenas faz UA + IP + geo + bot screening. Declaração LOTE 3 não menciona `detectAttack`.

### 3.6 Conclusões WAF

1. **HEAD `a0bb1a85`**: WAF é 100% dead code. Nenhum efeito em produção.
2. **`origin/main` `d1e283b3`**: WAF wired via commit `e778d467`, executa em TODO request, faz UA + IP + geo + bot screening. Success path retorna `NextResponse.next()` com security headers duplicados.
3. **LOTE 3 declarado**: success path muda para `return null`, eliminando duplicação. **CORRETO e BEM DESENHADO**.
4. **PATCH NOT TRANSFERRED**: impossível verificar se o `return null` change foi aplicado; mesmo `origin/main` `d1e283b3` (que tem WAF wired) ainda tem o pattern antigo (step 8 retorna `NextResponse.next()`).
5. **`detectAttack`** permanece dead code — WAF não faz attack pattern detection em body.

---

## 4. env.ts AUDIT — BUILD vs RUNTIME SEPARATION

### 4.1 Estado HEAD `a0bb1a85` — `src/lib/env.ts` (118 linhas)

```typescript
// L3-11: getEnv
function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (process.env.NODE_ENV === 'production' && fallback !== undefined) {
    throw new Error(`Production environment variable ${key} must be explicitly configured`);
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable: ${key}`);
}

// L17-22: requireProductionSecret
function requireProductionSecret(key: string, minimumLength = 32): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing production security secret: ${key}`);
  if (value.length < minimumLength) throw new Error(`${key} must contain at least ${minimumLength} characters`);
  return value;
}

// L24-25: DATABASE_URL + NEXTAUTH_URL with SQLite fallback
export const DATABASE_URL = getEnv('DATABASE_URL', 'file:./db/custom.db');
export const NEXTAUTH_URL = getEnv('NEXTAUTH_URL', 'http://localhost:3000');

// L27-35: NEXTAUTH_SECRET IIFE
export const NEXTAUTH_SECRET = (() => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE?.includes('build') && process.env.NODE_ENV !== 'production') return crypto.randomUUID();
    throw new Error('NEXTAUTH_SECRET environment variable is required — set a cryptographically random value (≥32 chars)');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) throw new Error('NEXTAUTH_SECRET must contain at least 32 characters in production');
  return secret;
})();

// L37: getNextAuthSecret (runtime-safe accessor)
export function getNextAuthSecret(): string { return requireProductionSecret('NEXTAUTH_SECRET'); }

// L98-118: assertProductionSecurityEnv
export function assertProductionSecurityEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  requireProductionSecret('NEXTAUTH_SECRET');
  requireProductionSecret('DATABASE_URL', 1);
  requireProductionSecret('ENCRYPTION_SECRET');
  requireProductionSecret('CACHE_SIGNING_SECRET');
  if (!WHATSAPP_COMMERCIAL || !WHATSAPP_SUPPORT) throw new Error('Production WhatsApp contact numbers must be explicitly configured');
  if (DEFAULT_PAYMENT_GATEWAY === 'asaas') {
    requireProductionSecret('ASAAS_ACCESS_TOKEN', 1);
    requireProductionSecret('ASAAS_WEBHOOK_SECRET', 1);
  }
  if (DEFAULT_PAYMENT_GATEWAY === 'mercadopago') {
    requireProductionSecret('MP_ACCESS_TOKEN', 1);
    requireProductionSecret('PAYMENT_WEBHOOK_SECRET', 1);
  }
  if (DEFAULT_PAYMENT_GATEWAY === 'stripe') {
    requireProductionSecret('STRIPE_SECRET_KEY', 1);
    requireProductionSecret('STRIPE_WEBHOOK_SECRET', 1);
  }
}
```

### 4.2 Estado `origin/main` `d1e283b3`

Diferenças notáveis (não-Lote3, mas pré-existente em origin/main):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ACCOUNT_ID` EXPORTS REMOVIDOS (projeto descartou Stripe)
- `assertProductionSecurityEnv()` NÃO tem mais branch `if (DEFAULT_PAYMENT_GATEWAY === 'stripe')` (consistente com remoção do Stripe)
- `ASAAS_AUTO_NFSE` default mudou de `'true'` para `'false'`
- `ASAAS_MUNICIPAL_SERVICE_CODE/NAME` defaults mudaram de hardcoded para string vazia
- `META_*` tokens unificados com aliases `WHATSAPP_*` (backward compat)
- `META_GRAPH_API_VERSION` adicionado (default `'v23.0'`)
- **NEXTAUTH_SECRET IIFE é IDÊNTICO ao HEAD** — ainda tem `&& process.env.NODE_ENV !== 'production'`

### 4.3 Análise do problema build-time

**Contexto**: Vercel `next build` roda com `NODE_ENV=production` E `NEXT_PHASE=phase-production-build`. Isso significa que:
- Em HEAD e `origin/main`: a clause `process.env.NEXT_PHASE?.includes('build') && process.env.NODE_ENV !== 'production'` é **SEMPRE FALSE** durante Vercel build (porque NODE_ENV É 'production').
- Resultado: se `NEXTAUTH_SECRET` não está setado em build time, o build FALHA com `throw new Error('NEXTAUTH_SECRET environment variable is required...')`.
- Isto é um problema prático: Vercel build NÃO tem secrets injetados no ambiente de build (apenas em runtime).

**Pattern pré-existente em 3 arquivos do baseline (correto)**:
- `src/lib/auth.ts:125`: `if (!secret) { if (process.env.NEXT_PHASE?.includes('build')) return crypto.randomUUID(); throw new Error('...'); }` — SEM `NODE_ENV !== 'production'` clause. Build-time fallback funciona.
- `src/lib/encryption.ts:27`: `if (process.env.NEXT_PHASE?.includes('build')) { return crypto.scryptSync(...); }` — SEM `NODE_ENV` check.
- `src/lib/security/cache-signer.ts:7`: `if (process.env.NEXT_PHASE?.includes('build')) { return randomBytes(32).toString('hex'); }` — SEM `NODE_ENV` check.

### 4.4 Declaração LOTE 3 — "Compatibilizado para análise estática e coleta de páginas sem quebrar segurança de runtime com `assertProductionSecurityEnv()`"

**Interpretação**: o LOTE 3 provavelmente REMOVE a clause `&& process.env.NODE_ENV !== 'production'` da IIFE NEXTAUTH_SECRET em `env.ts`, harmonizando-a com o pattern já existente em `auth.ts:125`, `encryption.ts:27`, `cache-signer.ts:7`.

#### Análise do impacto

**Antes do LOTE 3 (HEAD e origin/main)**:
- Build Vercel (NODE_ENV=production, NEXT_PHASE=phase-production-build): se `NEXTAUTH_SECRET` ausente → `throw new Error(...)` → BUILD FALHA
- Runtime production (NODE_ENV=production, NEXT_PHASE undefined): se `NEXTAUTH_SECRET` ausente → `throw new Error(...)` → request FALHA

**Depois do LOTE 3 (declarado)**:
- Build Vercel: se `NEXTAUTH_SECRET` ausente → retorna `crypto.randomUUID()` (CSPRNG) → build SUCCEEDS. Secret NÃO é persistida (usado apenas para static analysis / page collection durante build).
- Runtime production: se `NEXTAUTH_SECRET` ausente → `throw new Error(...)` → request FALHA (UNCHANGED)

**Veredito**: mudança declarada é **SEGURA** porque:
1. **Build-time fallback usa `crypto.randomUUID()` (CSPRNG)** — não é hardcoded secret
2. **Build-time secret NÃO é persistido** — usado apenas para satisfazer imports durante static analysis / page collection
3. **Runtime behavior é PRESERVADO** — em runtime (NEXT_PHASE undefined), `throw new Error(...)` executa se secret ausente
4. **`assertProductionSecurityEnv()` é INDEPENDENTE** — chama `requireProductionSecret('NEXTAUTH_SECRET')` que lê `process.env.NEXTAUTH_SECRET` diretamente (NÃO lê o const export), então o build-time fallback NÃO satisfaz este check em runtime
5. **`getNextAuthSecret()` também é INDEPENDENTE** — chama `requireProductionSecret('NEXTAUTH_SECRET')` diretamente
6. **O const export `NEXTAUTH_SECRET` é DEAD CODE** (zero imports em `src/`) — verificado via grep:
   ```
   $ rg "import.*\{.*NEXTAUTH_SECRET" zella/src/
   (no matches)
   ```

### 4.5 Análise de `assertProductionSecurityEnv()`

**Gap pré-existente**: `assertProductionSecurityEnv()` é declarada em `env.ts:98` mas **NUNCA É CHAMADA** em `src/`:

```
$ rg "assertProductionSecurityEnv" zella/
zella/tests/security-hardening-12-fronts.test.ts:22:    const env = read('src/lib/env.ts'); expect(env).toContain('assertProductionSecurityEnv'); expect(env).toContain('NEXTAUTH_SECRET');
zella/src/lib/env.ts:98:export function assertProductionSecurityEnv(): void {
```

Apenas referenciada em:
1. `env.ts:98` (declaração)
2. `tests/security-hardening-12-fronts.test.ts:22` (testa que a função EXISTE no arquivo, não que é chamada)

**Implicação**: o runtime guard "defense-in-depth" previsto pela função NÃO existe em produção. A proteção efetiva em runtime vem apenas de:
- `getNextAuthSecret()` chamado em `auth-guard.ts:15` e `checkout/success/route.ts:29` — falha só quando esses callers executam
- `requireProductionSecret` indireto via IIFE evaluation quando const `NEXTAUTH_SECRET` é importado (mas const é dead code)

**LOTE 3 não declara** adicionar caller para `assertProductionSecurityEnv()`. Esta é uma **declaração faltante** que deve ser exigida.

### 4.6 Side-channel risk — `DATABASE_URL` SQLite fallback

`env.ts:24`: `export const DATABASE_URL = getEnv('DATABASE_URL', 'file:./db/custom.db');`

Em runtime production (NODE_ENV='production'), se `DATABASE_URL` ausente E fallback fornecido, `getEnv` LANÇA erro (fail-closed). SAFE.

Em runtime dev, retorna `'file:./db/custom.db'` (SQLite). SAFE para dev.

**Risco latente**: se alguém MUDA `getEnv` para permitir fallback em production (ex: para satisfazer build), então `DATABASE_URL = 'file:./db/custom.db'` poderia ser usado em runtime production, sobrescrevendo silenciosamente o Postgres. **Mitigação atual**: `getEnv` em `NODE_ENV === 'production' && fallback !== undefined` SEMPRE lança. **LOTE 3 não declara mudar `getEnv`** — apenas `NEXTAUTH_SECRET` IIFE. SAFE.

### 4.7 Conclusões env.ts

1. **Declaração LOTE 3 de env.ts harmonization é SEGURA** — não enfraquece runtime security.
2. **Pattern já existe em 3 outros arquivos** (auth.ts:125, encryption.ts:27, cache-signer.ts:7) — mudança traz consistência.
3. **`NEXTAUTH_SECRET` const export é DEAD CODE** (zero imports) — IIFE não tem efeito em runtime.
4. **`assertProductionSecurityEnv()` é declarada mas NÃO É CHAMADA** em runtime — gap pré-existente, não declarado em LOTE 3.
5. **`getNextAuthSecret()` (chamado em auth-guard.ts e checkout/success/route.ts)** é o runtime guard efetivo — `requireProductionSecret('NEXTAUTH_SECRET')` em runtime, inalterado.
6. **PATCH NOT TRANSFERRED**: impossível verificar o diff exato; mas a análise semântica da declaração é consistentemente segura.

---

## 5. FINDINGS

### LOTE3-C-001 — PUBLIC_API_PREFIXES expansion (DECLARED)
- **Severidade**: P1 (alta)
- **Categoria**: M-RT-001 fix validation gap
- **Status**: DECLARED_FIXED — INSUFFICIENT EVIDENCE
- **Descrição**: Antigravity declara "Expandidos prefixos de webhook em `PUBLIC_API_PREFIXES`" no commit `2e021a9d`, mas o patch NÃO FOI TRANSFERIDO ao clone GLM. HEAD `a0bb1a85` tem 6 prefixos; `origin/main` `d1e283b3` tem 7 prefixos (pré-LOTE3 via commit `4a10f16b`); LOTE 3 declarado adicionaria 4-5 prefixos para cobrir webhooks Stripe/WhatsApp/Payment/Booking/GitHub.
- **Evidência**: `git cat-file -t 2e021a9d` → "Not a valid object name" no clone GLM.
- **Risco**: sem o diff exato, impossível verificar (a) se prefixos amplos como `/api/webhooks` foram usados (risco de design para futuras sub-rotas); (b) se `/api/zcc/airbnb/webhook` foi incorretamente adicionado (não é webhook externo, usa `verifyZCCAccessOrReject`).
- **Mitigação**: exigir do Antigravity a lista exata de PUBLIC_API_PREFIXES pós-LOTE3 + diff do `src/middleware.ts`.

### LOTE3-C-002 — WAF não wired no HEAD GLM (PRE-EXISTING, fixed in origin/main)
- **Severidade**: P1 (alta) em HEAD / P3 (baixa) em origin/main
- **Categoria**: Defense-in-depth gap
- **Status**: VERIFIED fix em `origin/main` `d1e283b3` via commit `e778d467`
- **Descrição**: Em HEAD `a0bb1a85`, `wafMiddleware` é exportado em `src/lib/security/waf-middleware.ts:55` mas NUNCA IMPORTADO em nenhum arquivo do projeto (dead code). Em `origin/main` `d1e283b3`, commit `e778d467` adicionou `import { wafMiddleware } from '@/lib/security/waf-middleware';` e `if (wafResponse) return securityHeaders(wafResponse);` em `src/middleware.ts`.
- **Evidência**: `rg "wafMiddleware|waf-middleware" zella/` retorna apenas o arquivo de definição no HEAD; `git log --oneline --all -- src/middleware.ts` mostra `e778d467 fix(certification): 7 blocker fixes — WAF wired`; `git merge-base --is-ancestor e778d467 a0bb1a85` retorna "NOT ancestor" mas `git merge-base --is-ancestor e778d467 d1e283b3` retorna "IS ancestor".
- **Risco residual**: HEAD GLM preserva estado SEM WAF; se deployment usa HEAD, WAF não executa. Se deployment usa origin/main, WAF executa.
- **Mitigação**: confirmar com Supervisor qual HEAD está em produção (Vercel + VPS).

### LOTE3-C-003 — WAF pass-through `return null` (DECLARED, NOT VERIFIED)
- **Severidade**: P3 (baixa) — design improvement, não security regression
- **Categoria**: WAF chaining refinement
- **Status**: DECLARED_FIXED — INSUFFICIENT EVIDENCE
- **Descrição**: Antigravity declara "WAF pass-through (`return null` em `src/lib/security/waf-middleware.ts`)" — provável mudança do step 8 (success path) de `return response;` (NextResponse.next() + 6 security headers) para `return null;` (continue para middleware aplicar headers via `securityHeaders()`).
- **Evidência**: HEAD e origin/main têm `return response;` no step 8 (L129-140). Patch LOTE 3 não transferido.
- **Análise**: mudança declarada é **CORRETA** — elimina duplicação de security headers entre WAF e middleware, separa responsabilidades (WAF decide BLOCK, middleware aplica headers).
- **Risco residual**: ZERO — se mudança NÃO foi aplicada, comportamento atual (origin/main) continua funcionando com headers duplicados (sobrescritos por `headers.set()`). Apenas desperdício.
- **Mitigação**: exigir diff de `src/lib/security/waf-middleware.ts` do commit `2e021a9d`.

### LOTE3-C-004 — env.ts NEXTAUTH_SECRET IIFE harmonization (DECLARED, SAFE)
- **Severidade**: P4 (informativa) — bug fix de build sem impacto em runtime security
- **Categoria**: env config harmonization
- **Status**: DECLARED_FIXED — INSUFFICIENT EVIDENCE (but semantically SAFE)
- **Descrição**: Antigravity declara "Compatibilizado para análise estática e coleta de páginas sem quebrar segurança de runtime com `assertProductionSecurityEnv()`" — provável remoção da clause `&& process.env.NODE_ENV !== 'production'` da IIFE NEXTAUTH_SECRET em `env.ts:30`.
- **Evidência**: HEAD e origin/main têm a clause restritiva. Pattern correto já existe em `auth.ts:125`, `encryption.ts:27`, `cache-signer.ts:7` (SEM a clause). Patch LOTE 3 não transferido.
- **Análise**: mudança declarada é **SEGURA** porque (1) build-time fallback usa `crypto.randomUUID()` (CSPRNG); (2) build-time secret NÃO é persistido; (3) runtime behavior é PRESERVADO (`throw new Error` em runtime se secret ausente); (4) `assertProductionSecurityEnv()` lê `process.env.NEXTAUTH_SECRET` diretamente, não o const; (5) `getNextAuthSecret()` idem; (6) o const export `NEXTAUTH_SECRET` é DEAD CODE (zero imports).
- **Mitigação**: exigir diff de `src/lib/env.ts` do commit `2e021a9d`.

### LOTE3-C-005 — `assertProductionSecurityEnv()` nunca chamada em runtime (OPEN, PRE-EXISTING)
- **Severidade**: P2 (média)
- **Categoria**: Defense-in-depth gap
- **Status**: OPEN (não declarado em LOTE 3)
- **Descrição**: A função `assertProductionSecurityEnv()` é declarada em `env.ts:98` mas **NUNCA É CHAMADA** em `src/`. Apenas referenciada em `tests/security-hardening-12-fronts.test.ts:22` (testa que a string existe no arquivo, não que a função é chamada).
- **Evidência**: `rg "assertProductionSecurityEnv" zella/` retorna apenas `env.ts:98` (declaração) e o teste.
- **Impacto**: o guard "defense-in-depth" não executa em runtime. A proteção efetiva vem apenas de `getNextAuthSecret()` (chamado em 2 sites) e do `requireProductionSecret` indireto via IIFE (mas IIFE const é dead code).
- **Risco**: se `NEXTAUTH_SECRET` está setado mas `ENCRYPTION_SECRET` ou `CACHE_SIGNING_SECRET` ausentes em runtime production, `assertProductionSecurityEnv()` NÃO lança (porque não é chamada). Apenas `encryption.ts:31` e `cache-signer.ts:11` lançam quando esses módulos são importados — mas se a rota não importa esses módulos, o erro só surge em runtime tardio.
- **Mitigação**: LOTE 3 deveria declarar caller para `assertProductionSecurityEnv()` em:
  - `src/middleware.ts` (início do middleware, fail-closed no startup)
  - `instrumentation.ts` (Vercel/Next.js startup hook)
  - `next.config.js` (mas isso roda em build também)
- **Recomendação**: exigir do Antigravity evidência de caller runtime para `assertProductionSecurityEnv()`.

### LOTE3-C-006 — `detectAttack()` function é dead code (OPEN, PRE-EXISTING)
- **Severidade**: P3 (baixa)
- **Categoria**: Defense-in-depth gap
- **Status**: OPEN (não declarado em LOTE 3)
- **Descrição**: A função `detectAttack(body: string)` em `waf-middleware.ts:146` faz SQL injection / XSS / path traversal / command injection / SSRF detection em body. Porém, **NUNCA É CHAMADA** em `src/`.
- **Evidência**: `rg "detectAttack" zella/` retorna apenas `waf-middleware.ts:146` (declaração).
- **Impacto**: o WAF NÃO faz body-level attack pattern detection em produção. Apenas faz header-level screening (UA + IP + geo + bot).
- **Risco**: requests maliciosos com payloads SQLi/XSS em body não são bloqueados pelo WAF. Apenas validação de schema/Prisma parameterized queries protegem contra SQLi (que é bom, mas defense-in-depth incompleto).
- **Mitigação**: LOTE 3 deveria declarar caller para `detectAttack()` em rotas que recebem body (especialmente webhooks e write APIs).

### LOTE3-C-007 — WAF BLOCKED_API_PREFIXES ordering (DESIGN SMELL)
- **Severidade**: P4 (informativa)
- **Categoria**: Information disclosure
- **Status**: OPEN (não declarado em LOTE 3)
- **Descrição**: Em `origin/main` `d1e283b3`, o WAF é chamado ANTES do BLOCKED_API_PREFIXES check. Se WAF retorna 403 para path em BLOCKED_API_PREFIXES (ex: UA suspeito em `/api/debug-agent`), o response é 403 em vez de 404 — vazando a existência da rota.
- **Mitigação**: reordenar para BLOCKED check ANTES do WAF. Ou fazer BLOCKED check retornar 404 independente do WAF.

### LOTE3-C-008 — `hasMachineCredential = Boolean(request.headers.get('authorization') || request.headers.get('x-api-key'))` (PRE-EXISTING, M-IDOR-001 + M-RT-001)
- **Severidade**: P0 (crítica) — herda findings V4/V5
- **Categoria**: Auth bypass
- **Status**: OPEN (não declarado em LOTE 3)
- **Descrição**: Middleware HEAD L128: `const hasMachineCredential = Boolean(request.headers.get('authorization') || request.headers.get('x-api-key'));` aceita QUALQUER string como credencial, incluindo `Authorization: Bearer x`. Não valida signature nem origem. V4/V5 já categorizaram como M-IDOR-001 + M-RT-001.
- **Mitigação**: LOTE 3 não declara corrigir este ponto. Recomenda-se exigir do Antigravity declaração explícita de não-introdução de regression ou fix planejado em LOTE 4.

---

## 6. VALIDATION GAPS

Evidências que o Antigravity precisa fornecer para que o veredito possa mudar de `DECLARED_FIXED` para `VERIFIED`:

### 6.1 Diffs obrigatórios (do commit `2e021a9d`)

| # | Arquivo | Linhas esperadas | Por quê |
|---|---|---|---|
| 1 | `src/middleware.ts` | diff completo, especialmente novo `PUBLIC_API_PREFIXES` | Verificar LOTE3-C-001 |
| 2 | `src/lib/security/waf-middleware.ts` | diff completo, especialmente step 8 `return null` | Verificar LOTE3-C-003 |
| 3 | `src/lib/env.ts` | diff completo, especialmente NEXTAUTH_SECRET IIFE | Verificar LOTE3-C-004 |
| 4 | `src/lib/auth.ts` | diff (se alterado) | Verificar consistência com env.ts |
| 5 | `src/lib/encryption.ts` | diff (se alterado) | Verificar consistência |
| 6 | `src/lib/security/cache-signer.ts` | diff (se alterado) | Verificar consistência |

### 6.2 Confirmações obrigatórias

1. **WAF wiring confirmado em produção**: confirmar se HEAD deployado em Vercel/VPS é `origin/main` `d1e283b3` (com WAF wired) ou HEAD `a0bb1a85` (sem WAF).
2. **Lista exata de PUBLIC_API_PREFIXES pós-LOTE3**: exigir dump do array pós-patch.
3. **Confirmação de que `assertProductionSecurityEnv()` tem caller runtime**: exigir grep em `src/` pós-LOTE3 (não apenas no arquivo de declaração).
4. **Confirmação de que `getNextAuthSecret()` permanece inalterado e continua sendo chamado em `auth-guard.ts:15` e `checkout/success/route.ts:29`**.
5. **Confirmação de que `getEnv()` function não foi alterada** (ainda fail-closed em production com fallback).
6. **Confirmação de que `requireProductionSecret()` function não foi alterada** (ainda checa `minimumLength` em runtime).

### 6.3 Test cases obrigatórios (caso Antigravity tenha adicionado)

1. **Prefix collision matrix test**: testar `/api/checkout/webhook/malicious` NÃO é público; `/api/checkout/webhook` É público; `/api/checkout/webhookmalicious` NÃO é público.
2. **Path traversal test**: testar `/api/webhooks/asaas/../protected` NÃO vira público após normalização.
3. **WAF chaining test**: testar que WAF `return null` resulta em middleware aplicando security headers (não duplica); WAF `return NextResponse.json(403)` resulta em middleware wraping em `securityHeaders()`.
4. **env.ts build/runtime test**: testar que em `NEXT_PHASE=phase-production-build` + `NODE_ENV=production` + `NEXTAUTH_SECRET` ausente, `env.ts` NÃO lança (build succeeds); em runtime (`NEXT_PHASE` undefined) + `NODE_ENV=production` + `NEXTAUTH_SECRET` ausente, `env.ts` lança.
5. **assertProductionSecurityEnv caller test**: testar que `assertProductionSecurityEnv()` é chamada em algum lugar de `src/` em runtime (não apenas declarada).

### 6.4 Repositório de evidências

- Output desta auditoria: `/home/z/my-project/download/LOTE3_MIDDLEWARE_WAF_ENV_AUDIT.md`
- Outputs correlatos:
  - `/home/z/my-project/download/LOTE3_AUTH_SESSION_REVOCATION_AUDIT.md` (Subagent B — auth/session)
  - `/home/z/my-project/download/LOTE3_MPAY011_ADMIN_FALLBACK_AUDIT.md` (Subagent A — admin)
- Baseline GLM: `zella` submodule @ HEAD `a0bb1a85`
- Origin/main: `d1e283b3`
- Antigravity commit `2e021a9d` (LOTE 3): **AUSENTE** do clone GLM

---

## 7. FINAL VERDICT

### 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE (NO-GO até transferência dos patches)

### Resumo

| Componente | Estado atual (HEAD `a0bb1a85`) | Estado `origin/main` `d1e283b3` | Declaração LOTE 3 (`2e021a9d`) | Veredito |
|---|---|---|---|---|
| WAF wiring | ❌ DEAD CODE | ✅ wired via `e778d467` | não declarado novo | VERIFIED em origin/main |
| WAF `return null` | `return response;` | `return response;` | DECLARED `return null` | DECLARED_FIXED |
| PUBLIC_API_PREFIXES | 6 prefixos | 7 prefixos | DECLARED "expandidos" | DECLARED_FIXED |
| env.ts NEXTAUTH_SECRET IIFE | `NODE_ENV !== 'production'` clause | idem | DECLARED harmonization | DECLARED_FIXED (semantically SAFE) |
| `assertProductionSecurityEnv()` runtime caller | AUSENTE | AUSENTE | não declarado | OPEN (gap pré-existente) |
| `detectAttack()` caller | AUSENTE | AUSENTE | não declarado | OPEN (gap pré-existente) |
| `hasMachineCredential = Boolean(headers.get('authorization'))` (M-IDOR-001) | ABERTO | ABERTO | não declarado | OPEN (P0 pré-existente) |

### GO/NO-GO LOTE 3

**NO-GO** até que sejam fornecidos:

1. ✅ Patch do commit `2e021a9d` transferido ao clone GLM
2. ✅ Diff completo de `src/middleware.ts`, `src/lib/security/waf-middleware.ts`, `src/lib/env.ts`
3. ✅ Confirmação de caller runtime para `assertProductionSecurityEnv()` (LOTE3-C-005)
4. ✅ Confirmação de caller para `detectAttack()` (LOTE3-C-006) OU declaração explícita de não-escopo
5. ✅ Lista exata de PUBLIC_API_PREFIXES pós-LOTE3 (LOTE3-C-001)
6. ✅ Test cases para prefix collision matrix (Seção 6.3)
7. ✅ Confirmação de qual HEAD está em produção (Vercel + VPS) — `a0bb1a85` (sem WAF) ou `d1e283b3` (com WAF wired)
8. ✅ Plano para P0 `hasMachineCredential` (LOTE3-C-008, M-IDOR-001) — LOTE 4 ou hotfix

### Notas técnicas

- A análise semântica das 3 declarações LOTE 3 (WAF `return null`, prefix expansion, env.ts harmonization) é **consistente com boas práticas de segurança** — NÃO há evidência de weakening intencional.
- O pattern de harmonização env.ts ↔ auth.ts/encryption.ts/cache-signer.ts é **consistência arquitetural**, não regressão.
- O WAF wiring é **pré-LOTE3** (commit `e778d467`) — não conta como ganho LOTE 3.
- O `return null` change é **otimização** (elimina header duplication), não fix de segurança.

### Estado do repositório

- HEAD GLM: `a0bb1a85` — sem WAF, env.ts não-harmonizado
- Origin/main: `d1e283b3` — WAF wired, env.ts não-harmonizado, MP webhook público
- Antigravity LOTE 3: `2e021a9d` — DECLARED, **NÃO TRANSFERIDO**
- NENHUMA alteração aplicada ao código do projeto (READ-ONLY forensic audit)

---

**Auditor:** GLM Subagent C — Middleware Red Team + WAF + env.ts
**Output SHA256:** (computado abaixo após gravação)
**Lines:** (contagem após gravação)
**Date:** 2026-08-28
