# LOTE 3 — AUTH / SESSION / REVOCATION FORENSIC AUDIT

**Task ID:** B (LOTE 3 wave)
**Auditor:** GLM 5.2 Super Z — Subagent B (Auth/Session Revocation Forensic)
**Method:** READ-ONLY forensic audit (zero commits, zero patches aplicados)
**Baseline HEAD (GLM env):** `a0bb1a85` (`fix(stripe+alexa): correct WebhookEvent property names + StripeGateway import`)
**HEAD Antigravity declarado:** `2e021a9d` (LOTE 3 — não transferido ao clone GLM)
**Commit base LOTE 3 declarado:** `ebc54d25` (Fase 0 LOTE 3) — NÃO TRANSFERIDO ao clone GLM
**HEAD LOTE 3 declarado:** `2e021a9d` (LOTE 3) — NÃO TRANSFERIDO ao clone GLM
**Worktree:** 17 arquivos modificados (mode-only `100644 → 100755`, zero alterações de conteúdo)
**Baseline V2/V3 anteriores:**
  - `/home/z/my-project/download/AUTH_SESSION_REVOCATION_FORENSIC_V2.md`
  - `/home/z/my-project/download/AUTH_SESSION_REVOCATION_FORENSIC_V3.md` (544 linhas)
**Diretriz Supervisor aplicada:** HEAD GLM `a0bb1a85` **NÃO é prova de ausência de implementação** após recebimento das declarações Antigravity LOTE 3. HEAD GLM é apenas baseline de especificação.

**Lenda de estado LOTE 3:**
- `ALREADY_FIXED` — corrigido por patch transferido ao clone GLM (evidência direta em diff)
- `DECLARED_FIXED` — Antigravity declara remediação (commit `2e021a9d`) mas patch não transferido para GLM
- `OPEN` — nem patch transferido nem declaração Antigravity endereçam
- `VERIFIED` — evidência direta em código HEAD GLM `a0bb1a85` (apenas para contexto arquitetural)
- `INSUFFICIENT EVIDENCE` — declaração existe, mas sem artefato para validação independente

---

## 1. VERDICT EXECUTIVO

| Dimensão | V3 (pré-LOTE 3) | LOTE 3 (declared `2e021a9d`) | Estado pós-LOTE 3 declarado |
|---|---|---|---|
| `RevokedSession` model em `prisma/schema.prisma` | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| `jti` claim emitido no JWT NextAuth | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| `authTime` claim no JWT NextAuth | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| `Tenant.passwordChangedAt` field | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| Migration `20260901000008_add_revoked_sessions_and_password_changed_at` | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| Invalidation quando tenant inativo (`M-AUTH-004`) | 🔴 OPEN | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| Invalidation após credential rotation (`M-AUTH-005`) | 🔴 OPEN | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| WAF chaining changes | 🔴 N/A | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| Middleware changes | 🔴 N/A | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |
| Test file `tests/security/auth-session-revocation-lote3.test.ts` (8 testes) | 🔴 AUSENTE | 🟡 DECLARED | `DECLARED_FIXED` — INSUFFICIENT EVIDENCE |

### VERDICT FINAL: 🟡 **DECLARED_FIXED — INSUFFICIENT EVIDENCE**

- **3 P0** (M-AUTH-002, M-AUTH-004, M-AUTH-005) DECLARED pelo Antigravity via commit `2e021a9d`
- **0 P0** VERIFIED (commit `2e021a9d` não transferido, patch não disponível para validação independente)
- **Crítico:** A ARQUITETURA do código baseline (HEAD `a0bb1a85`) **NÃO dá suporte centralizado** às declarações LOTE 3. Mesmo se patches forem transferidos, há **evidências arquiteturais fortes** que:
  - O check de `RevokedSession` **não pode ser centralizado** em `callbacks.session` sem acoplar NextAuth a `db`
  - Existem **5+ caminhos paralelos de autorização** (requireTenant, requireTenantId, requireTenantAccess, resolveTenantId, withApiGuard, getServerSession direto em 27+ arquivos)
  - Existe um **anti-pattern pré-existente** (M2M/cron token revocation em `m2m-policy.ts:138-143` em `Set<string>` IN-MEMORY) que LOTE 3 **NÃO deve replicar** sob risco de bypass silencioso em Vercel serverless
- **GO/NO-GO**: 🔴 **NO-GO** até patches transferidos + re-audit + correção arquitetural

---

## 2. Baseline Reconciliation — Declaração LOTE 3 vs GLM env HEAD

### 2.1 Commits declarados pelo Antigravity (LOTE 3)

| Commit | Conteúdo declarado | Status no clone GLM |
|---|---|---|
| `ebc54d25` | "Fase 0 LOTE 3" — revert M-PAY-011 regression + remove admin fallback hardcoded | 🔴 **AUSENTE** (`git cat-file -t ebc54d25` → `Not a valid object name`) |
| `2e021a9d` | "LOTE 3" — implementação completa M-AUTH-002 + M-AUTH-004 + M-AUTH-005 + migration + tests | 🔴 **AUSENTE** (`git cat-file -t 2e021a9d` → `Not a valid object name`) |

### 2.2 HEAD GLM (ancestral, baseline de especificação)

- HEAD GLM: `a0bb1a85` em `main` (zella submodule)
- `git log --all --oneline | grep -iE "revoke\|jti\|authTime\|passwordChangedAt"` → 3 matches (todos sobre **smart-lock PIN revoke**, NÃO session revocation)
- `git log --all --oneline` (zella) = 1542 commits; nenhum com hash `ebc54d25` ou `2e021a9d`

### 2.3 Diretriz Supervisor aplicada

> "NÃO utilize o `a0bb1a85` como prova de ausência de implementação depois de receber os artefatos acima"

Aplicação neste audit:
- HEAD GLM é usado APENAS como baseline de especificação arquitetural
- Ausência de `RevokedSession`/`jti`/`authTime`/`passwordChangedAt` no HEAD GLM NÃO é apresentada como prova de ausência no commit `2e021a9d`
- Declarações Antigravity são aceitas como `DECLARED_FIXED` mas requerem evidência transferida para upgrade a `VERIFIED`

---

## 3. EVIDENCE INVENTORY (baseline `a0bb1a85`)

### 3.1 `src/lib/auth.ts` (147 linhas, SHA local)

```bash
$ wc -l src/lib/auth.ts
147 src/lib/auth.ts
```

**Elementos presentes:**
- `authOptions: NextAuthOptions` (L33)
- `CredentialsProvider` + `GoogleProvider` (L41-74, condicional L29-31)
- `session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }` (L76) — JWT 24h, **SEM `jti`**, **SEM `authTime`**
- `callbacks.jwt` (L98-111) — enriches token com `tenantId, role, plan, niche` SOMENTE quando `user` presente (sign-in inicial); consulta `db.tenant` (L102-107) para Google flow; **NÃO emite `jti`**; **NÃO emite `authTime`**; **NÃO consulta `RevokedSession`** em refresh JWT (apenas no sign-in inicial)
- `callbacks.session` (L112-115) — apenas copia campos `tenantId, role, plan, niche` do token para `session.user`; **NÃO consulta `db.tenant`**; **NÃO consulta `RevokedSession`**; **NÃO revalida `tenant.status`**
- `requireTenant()` (L131-136) — apenas retorna `tenantId` da sessão; **NÃO revalida `tenant.status`**; **NÃO consulta `RevokedSession`**
- `verifyRobotToken()` (L138-147) — Bearer token check via `ZEHLA_LOOP_API_KEY` / `ZAI_API_KEY` (constant-time)

**Elementos AUSENTES (confirma V3 baseline):**
- ❌ `RevokedSession` query em qualquer path
- ❌ `jti` claim issuance no callback jwt
- ❌ `authTime` claim no callback jwt
- ❌ `passwordChangedAt` comparison
- ❌ `tenant.status` revalidation em `callbacks.session` ou `requireTenant`

### 3.2 `prisma/schema.prisma` (2529 linhas)

```bash
$ wc -l prisma/schema.prisma
2529 prisma/schema.prisma
$ grep -nE 'RevokedSession|passwordChangedAt|authTime|\bjti\b' prisma/schema.prisma
(no output)
```

**Tenant model (L53-115):**
```prisma
model Tenant {
  id             String    @id @default(cuid())
  name           String
  email          String?   @unique
  passwordHash   String?
  phone          String?
  phoneAlt       String?
  whatsappPhoneNumber String? @unique
  whatsappBusinessId  String? @unique
  role           String    @default("owner")
  plan           String    @default("lite")
  status         String    @default("active")    // ← check apenas no login
  subscriptionAt DateTime?
  domain         String? @unique
  clerkOrgId     String? @unique
  // ... 50+ relations
  niche      String    @default("pousada")
  users      User[]    @relation("UserToTenant")
  isTestTenant Boolean @default(false)
  // ... mais relations
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("tenants")
}
```

**AUSENTE:**
- ❌ `passwordChangedAt DateTime?` field
- ❌ `model RevokedSession { ... }`
- ❌ Qualquer índice/unique constraint em `jti`

**Session model (L1529-1536):** padrão NextAuth, **não usado** (strategy='jwt' em auth.ts:76), portanto não é relevante para revogação JWT.

### 3.3 Migrations directory (10 migrations, lock=sqlite)

```
prisma/migrations/
├── 20260521175644_add_funnel_models/migration.sql
├── 20260817000000_add_caucao_toggle/migration.sql
├── 20260817000001_add_upsell_records/migration.sql
├── 20260817000002_remove_caution_fields/migration.sql
├── 20260819000001_add_github_gitops_layer/migration.sql
├── 20260823130000_password_reset_tokens/migration.sql
├── 20260901000001_v11_p0_policy_audit_and_compiled_prompt/migration.sql
├── 20260901000002_add_lgpd_persistence/migration.sql
├── 20260901000003_add_push_subscriptions/migration.sql
└── migration_lock.toml  (provider = "sqlite")
```

**AUSENTE:**
- ❌ `20260901000008_add_revoked_sessions_and_password_changed_at/migration.sql`

**Observação crítica sobre `migration_lock.toml`:** ainda declara `provider = "sqlite"` no baseline `a0bb1a85` (conflito com VPS PostgreSQL declarado em MVK4 V3). Se LOTE 3 adiciona migration sem mudar o lock para `postgresql`, a migration **não executará** em produção Vercel/VPS Postgres.

### 3.4 `src/middleware.ts` (148 linhas)

```bash
$ wc -l src/middleware.ts
148 src/middleware.ts
```

**Funções relevantes:**
- `getAuthenticatedToken()` (L59-63) — chama `getToken({ req, secret })` (decodifica JWT, valida assinatura); **NÃO consulta `RevokedSession`**; **NÃO revalida `tenant.status`**; **NÃO valida `authTime` vs `passwordChangedAt`**
- `authorizeZcc()` (L65-80) — verifica `token.role` em `['owner', 'admin', 'system_admin']` + `envAdmins.includes(email)`; **NÃO consulta `RevokedSession`**; **NÃO revalida `tenant.status`**
- `middleware()` (L82-144) — gate coarse-grained: para `/api/*` verifica apenas `hasSession || hasMachineCredential`; **NÃO decodifica token**, **NÃO valida claims**, **NÃO consulta DB**
- `PUBLIC_API_PREFIXES` (L7-14) — bypass total: `/api/health`, `/api/readiness`, `/api/auth`, `/api/webhook-whatsapp`, `/api/webhooks/asaas`, `/api/checkout/webhook`

**AUSENTE:**
- ❌ Qualquer referência a `RevokedSession`, `jti`, `authTime`, `passwordChangedAt`, `tenant.status`
- ❌ Decodificação de claims JWT (apenas `getToken` que valida assinatura mas não inspeciona conteúdo)

### 3.5 Authorization paths (auditoria completa)

#### 3.5.1 Inventory de funções de autorização

| Função | Arquivo | Tenant.status check? | RevokedSession check? | passwordChangedAt check? | # arquivos que usam |
|---|---|---|---|---|---|
| `requireTenant()` | `src/lib/auth.ts:131` | ❌ NÃO | ❌ NÃO | ❌ NÃO | 3 |
| `requireTenantId()` | `src/lib/security/tenant-context.ts:55` | ❌ NÃO | ❌ NÃO | ❌ NÃO | (via `getTenantId`) |
| `getTenantId()` | `src/lib/security/tenant-context.ts:26` | ❌ NÃO | ❌ NÃO | ❌ NÃO | muitos (via `runWithTenant`) |
| `requireTenantAccess()` | `src/lib/security/tenant-authorization.ts:19` | ✅ SIM (L57-61) | ❌ NÃO | ❌ NÃO | **1** (`ddc/booking-sync`) |
| `withApiGuard()` / `withTenantGuard()` / `withAdminGuard()` | `src/lib/security/api-guard.ts:27,66,70` | ❌ NÃO (apenas role) | ❌ NÃO | ❌ NÃO | alguns |
| `resolveTenantId()` | `src/lib/ddc/auth-utils.ts:19` | ❌ NÃO | ❌ NÃO | ❌ NÃO | 79 arquivos |
| `requireDDCTenantId()` | `src/lib/ddc/auth-utils.ts:61` | ❌ NÃO | ❌ NÃO | ❌ NÃO | (via `resolveTenantId`) |
| `getServerSession(authOptions)` direto | N/A | ❌ NÃO | ❌ NÃO | ❌ NÃO | 27 arquivos |
| `authorizeZcc()` (middleware) | `src/middleware.ts:65` | ❌ NÃO (apenas role/email) | ❌ NÃO | ❌ NÃO | 1 (middleware) |
| `verifyCronM2MToken()` | `src/lib/security/cron-auth.ts:43` | N/A (M2M, não tenant) | ✅ SIM (in-memory `revokedJtis` Set, m2m-policy.ts:138-143) | N/A | M2M only |

#### 3.5.2 ZCC routes sem auth imports

```bash
$ grep -rL "requireTenantAccess\|requireTenant(\|requireTenantId\|resolveTenantId\|requireDDCTenantId\|withAdminGuard\|withTenantGuard\|withApiGuard\|getServerSession" src/app/api/zcc/
81 files (de 84 total)
```

**81/84 rotas `/api/zcc/*` não têm NENHUMA função de auth importada** — dependem exclusivamente do middleware `authorizeZcc()` que não revalida `tenant.status`.

#### 3.5.3 Pattern recognition — anti-pattern M2M

Existe um anti-pattern pré-existente em `src/lib/security/m2m-policy.ts:20-143`:
```typescript
const revokedJtis = new Set<string>();
// ...
export function revokeJti(jti: string): void {
  if (jti) revokedJtis.add(jti);
}
export function isJtiRevoked(jti?: string): boolean {
  return Boolean(jti && revokedJtis.has(jti));
}
```

**Problemas deste pattern:**
1. **In-memory** — perdido a cada cold start (Vercel serverless = toda invocação)
2. **Single-process** — cada instância tem seu próprio Set; revogação em instância A não bloqueia instância B
3. **Sem TTL** — Set cresce indefinidamente (em instâncias long-lived como VPS PM2)
4. **Sem tenantId scoping** — revogação cross-tenant possível (qualquer jti global)

**Se LOTE 3 replicar este pattern** para NextAuth JWTs (em vez de criar `RevokedSession` table persistente), a revogação será **bypassada silenciosamente** em Vercel serverless. **NÃO HÁ EVIDÊNCIA** de que LOTE 3 evita este pattern — mas o risco existe.

#### 3.5.4 Pattern recognition — Alexa JWT

`src/lib/locks/alexa-security.ts:1-128` implementa JTI validation CORRETA:
- Rejeita token sem `jti` (L104-106)
- Valida `iat` dentro de janela de 5 min (replay protection, L107-110)
- Marca `jti` como usado (L79-82)

**Mas** também é **in-memory** (`Map<string, number>` em L27), com a nota explícita:
```typescript
* ARCHITECTURE
* ------------
* In-memory for now (single Vercel instance). For multi-instance, swap
* the Map for Redis (same pattern as tenant-pubsub.ts).
```

**Se LOTE 3 seguir este pattern**, mesmo reject de token sem `jti` seria correto, mas a persistência seria incorreta para multi-instância.

### 3.6 `tenant.status` checks no baseline

```bash
$ grep -rn "tenant\.status" src/app/api/ src/lib/ | head -12
src/app/api/checkout/create/route.ts:52:     if (!tenant || tenant.status !== 'active') return createError(403, ...);
src/app/api/zcc/metrics/financial/route.ts:122: const isChurned = tenant.status === 'suspended' || tenant.status === 'churned';
src/app/api/zcc/tenants/route.ts:150:        status: tenant.status,
src/app/api/zcc/tenants/route.ts:159:        brainStatus: tenant.status === 'active' ? 'learning' : 'paused',
src/app/api/zcc/tenants/route.ts:160:        killSwitchActive: tenant.status === 'suspended',
src/app/api/auth/magic-link/route.ts:39:    if (tenant.status !== 'active') return NextResponse.json({ error: 'Conta inativa.' }, { status: 403 });
src/app/api/auth/magic-link/route.ts:85:    if (!tenant || tenant.status !== 'active') return NextResponse.redirect(new URL('/login?error=account-inactive', request.url));
src/lib/security/tenant-authorization.ts:59: else if (tenant.status === 'suspended' || tenant.status === 'churned') { ... }
src/lib/auth.ts:59:                  if (tenant?.passwordHash && (await bcrypt.compare(password, tenant.passwordHash)) && tenant.status === 'active') {
src/lib/auth.ts:103:                if (tenant && tenant.status === 'active') {
```

**Categorização:**
- **Em login (sign-in)**: auth.ts:59 (credentials), auth.ts:87/103 (Google jwt callback, apenas quando `user` presente), magic-link/route.ts:39,85 — 4 sites
- **Em checkout**: checkout/create:52 — 1 site (billing gate, não auth gate)
- **Em authorization path pós-login**: tenant-authorization.ts:59 (apenas `requireTenantAccess`, 1 caller) — 1 site
- **Display/admin (não security gate)**: zcc/metrics, zcc/tenants — 3 sites

**Total de authorization paths pós-login que revalidam `tenant.status`:** **1 de ~6 funções de autorização**, usado em **1 de ~110+ rotas API**.

### 3.7 `passwordHash` update sites (candidatos a `passwordChangedAt` update)

```bash
$ grep -n "passwordHash" src/app/api/auth/*.ts src/lib/auth.ts
src/app/api/auth/reset-password/route.ts:33:  await tx.tenant.update({ where: { id: reset.tenant_id }, data: { passwordHash, status: 'active' } });
src/app/api/auth/register/route.ts:65:          passwordHash,
src/app/api/auth/magic-verify/route.ts:41:    data: { passwordHash: tempPasswordHash },
src/lib/auth.ts:59:              if (tenant?.passwordHash && (await bcrypt.compare(password, tenant.passwordHash)) && tenant.status === 'active') {
```

**3 sites de update de passwordHash** (LOTE 3 deveria adicionar `passwordChangedAt: new Date()` em todos):
1. `reset-password/route.ts:33` — recovery flow via email token
2. `register/route.ts:65` — initial registration
3. `magic-verify/route.ts:41` — magic-link flow (temp password)

**Nenhum destes sites atualiza `passwordChangedAt`** no baseline (porque o campo não existe). LOTE 3 declarado precisa modificar **os 3 sites** + idealmente adicionar **revogação explícita de sessões existentes** via `RevokedSession.create`.

### 3.8 Test files auth-relevant no baseline

```bash
$ ls tests/auth/ tests/security/ | grep -iE 'auth|session|revoke|jti'
tests/auth/password-reset-flow.test.ts
tests/security/cron-auth.test.ts
tests/security/production-auth-canary.test.ts
tests/security/m2m-argon2.test.ts
```

**4 arquivos de teste auth-relevant no baseline.** NENHUM testa `RevokedSession`, `jti` para NextAuth, `authTime`, `passwordChangedAt`, ou tenant suspension em runtime.

**Arquivo declarado AUSENTE no clone GLM:**
- ❌ `tests/security/auth-session-revocation-lote3.test.ts` (8 testes declarados pelo Antigravity)

### 3.9 Cron jobs cleanup candidates

```bash
$ ls src/app/api/cron/ | wc -l
30 cron routes
```

**NENHUM cron job** no baseline faz cleanup de `RevokedSession` expiradas. Se LOTE 3 cria a tabela sem cron de limpeza, a tabela cresce indefinidamente (estimativa: 1 row por logout explícito + 1 por revogação admin + 1 por password change = potencialmente 100K+ rows/ano em sistema ativo).

---

## 4. M-AUTH-002 AUDIT — RevokedSession + jti + authTime

### 4.1 Declaração Antigravity (commit `2e021a9d`)

- `RevokedSession` table criada
- `jti` (JWT ID) emitido em cada JWT NextAuth
- `authTime` claim em cada JWT NextAuth
- Persistent session revocation via DB row

### 4.2 Questões críticas de implementação

#### 4.2.1 Onde `RevokedSession` seria consultado?

**Hipóteses:**
- (a) `callbacks.jwt` em auth.ts
- (b) `callbacks.session` em auth.ts
- (c) `requireTenant()` em auth.ts
- (d) `middleware.ts`
- (e) Wrapper de `getServerSession` em lib/auth.ts

**Análise de cada hipótese:**

| Hipótese | Viável? | Prós | Contras |
|---|---|---|---|
| (a) `callbacks.jwt` | 🟡 PARCIAL | Executa em sign-in E refresh; centralizado | Aumenta latência de cada refresh; `db` disponível?; não cobre `getServerSession` que decodifica JWT sem refresh |
| (b) `callbacks.session` | 🟡 PARCIAL | Centralizado em todos os `getServerSession(authOptions)` | Chamado em CADA `getServerSession`; adiciona latência de DB em cada request; se `db` indisponível, fail-open ou fail-closed? |
| (c) `requireTenant()` | 🔴 INSUFICIENTE | Simples | Apenas 3 arquivos usam; não cobre 27 `getServerSession` diretos, 79 `resolveTenantId`, etc. |
| (d) `middleware.ts` | 🟡 PARCIAL | Gate de borda | Middleware Next.js Edge Runtime não tem acesso a Prisma `db`; teria que usar fetch para um endpoint interno (latência +) |
| (e) Wrapper `getServerSession` | ✅ IDEAL | Centralizado; falha explicitamente; um único ponto de mudança | Requer refactor de todos os 27+ callers de `getServerSession(authOptions)` diretos |

**Risco arquitetural:** Se LOTE 3 implementar (a) ou (b), qualquer endpoint que use `getServerSession(authOptions)` direto (27 arquivos) ou `resolveTenantId` (79 arquivos via auth-utils.ts) **poderia não ter o check aplicado**, dependendo de como NextAuth invoca internamente os callbacks.

**Veredito arquitetural:** Mesmo se `2e021a9d` implementa (b) `callbacks.session` corretamente, **não há evidência** de que o check é aplicado em todos os 110+ authorization paths. **Risco de bypass silencioso** em paths paralelos.

#### 4.2.2 Race conditions

**Cenário:**
1. T0: User loga → JWT emitido com `jti=X`
2. T1: Admin revoga sessão → `RevokedSession` row criado com `jti=X`
3. T2: User faz API call com JWT `jti=X` → API check `RevokedSession`?

**Race window:** entre T1 (commit da revogação) e T2 (check), se:
- T2 acontece ANTES de T1 commit → request passa (esperado, não é bypass)
- T2 acontece APÓS T1 commit mas ANTES do cache do DB refletir → depende do PostgreSQL isolation level; default READ COMMITTED garante que T2 vê T1 (✅)
- T2 acontece em instância diferente do Vercel serverless e DB replica lag > 0 → **bypass window de até N segundos** se usando read replica

**Bypass residual:** Se PostgreSQL read replica está N segundos atrás do primary (comum em Vercel Postgres + read replica), revogação admin pode demorar N segundos para propagar. **Declaração LOTE 3 não menciona** este risco.

#### 4.2.3 Token sem `jti` (legacy)

**Cenário:** Token JWT emitido ANTES do LOTE 3 deploy (sem `jti` em payload).

**Opções de implementação:**
- (A) Rejeitar tokens sem `jti` (fail-closed para legacy)
  - **Pró:** máximo segurança
  - **Contra:** logout forçado de TODOS os usuários existentes no deploy LOTE 3 → má UX
- (B) Aceitar tokens sem `jti` (fail-open para legacy, skip revocation check)
  - **Pró:** zero downtime
  - **Contra:** bypass permanente para tokens legacy até expirarem (24h maxAge)
- (C) Refresh forçado: forçar refresh JWT adicionando `jti` no próximo `callbacks.jwt`
  - **Pró:** migração suave
  - **Contra:** durante a janela de migração (até 24h), tokens legacy podem ser revogados? (Não, porque não têm `jti` para match)

**Veredito:** Sem patch transferido, **impossível determinar** qual estratégia LOTE 3 adota. **Risco de bypass de 24h** para tokens legacy se opção (B) for adotada.

#### 4.2.4 Token tampering

JWT signature (HMAC SHA-256 por NextAuth default) previne tampering de claims. Se `jti` está no payload:
- ✅ Attacker não pode modificar `jti` sem quebrar a assinatura
- ✅ `authTime` também protegido pela assinatura

**Bypass residual:** Apenas se NEXTAUTH_SECRET vazar (compromisso de Vercel env vars). Fora deste cenário, JWT é criptograficamente íntegro.

#### 4.2.5 Persistência

**Requisitos para `RevokedSession`:**
- ✅ Persistir em DB (não in-memory) — **deve** sobreviver a restarts/cold starts
- 🟡 Cleanup após JWT expiry — se não, tabela cresce indefinidamente
- ✅ Index em `jti` (lookup O(log n)) — performance
- ✅ UNIQUE constraint em `jti` (não revogar mesmo jti duas vezes)
- ✅ `tenantId` FK para tenant boundary

**Padrão esperado de schema LOTE 3:**
```prisma
model RevokedSession {
  id          String   @id @default(cuid())
  jti         String   @unique
  tenantId    String
  revokedAt   DateTime @default(now())
  expiresAt   DateTime  // = JWT exp, para cleanup
  revokedBy   String?   // admin user ID
  reason      String?   // 'manual' | 'password_change' | 'tenant_suspension'
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([jti])
  @@index([tenantId, revokedAt])
  @@map("revoked_sessions")
}
```

**Sem patch transferido, NÃO É POSSÍVEL verificar** se o schema declarado pelo Antigravity segue este padrão.

#### 4.2.6 Tenant boundary

**Requisitos:**
- `RevokedSession.tenantId` FK para `tenants.id`
- Revocation check filtra por `tenantId` (admin de tenant A não pode revogar sessão de tenant B)
- API de revogação valida `tenantId` do caller

**Cenário de ataque se ausente:**
1. Admin de tenant A tem JWT com `jti=Y` (sua própria sessão)
2. Admin de tenant A descobre `jti=Z` (sessão de admin tenant B)
3. Admin A faz POST `/api/sessions/revoke` com `jti=Z`
4. Se API não valida `tenantId`, revoga sessão de tenant B (DoS)

**Sem patch, impossível verificar** se a API de revogação valida tenantId.

#### 4.2.7 Cleanup

**Sem cron job de cleanup declarado no baseline.** Se LOTE 3 adiciona cleanup, seria esperado:
- Novo cron route: `src/app/api/cron/sessions-cleanup/route.ts`
- Query: `DELETE FROM revoked_sessions WHERE expires_at < NOW()`
- Schedule: diário

**Veredito:** Sem patch, impossível confirmar. **Risco de crescimento indefinido da tabela** se cleanup ausente.

### 4.3 Veredito M-AUTH-002

**Estado:** 🟡 `DECLARED_FIXED — INSUFFICIENT EVIDENCE`

**Justificativa:**
- Commit `2e021a9d` declarado mas não transferido ao clone GLM
- Schema baseline não tem `RevokedSession` model (mas isto NÃO é prova de ausência no commit `2e021a9d`)
- Architecture baseline tem **5+ caminhos paralelos de autorização** — mesmo se `RevokedSession` check for adicionado em 1 path, outros 4+ podem bypass
- Anti-pattern M2M pré-existente (in-memory `revokedJtis` Set) é um risco se replicado
- Nenhum cron job de cleanup identificado no baseline

**Risco residual após implementação declarada:**
- Tokens legacy sem `jti` por até 24h pós-deploy (estratégia unknown)
- Bypass em paths paralelos de autorização (se check não for centralizado)
- Race window de replica lag (PostgreSQL read replica)
- Crescimento indefinido da tabela (se cleanup ausente)
- Bypass cross-tenant (se `tenantId` filter ausente na API de revogação)

---

## 5. M-AUTH-004 AUDIT — Tenant Suspension Invalidation

### 5.1 Declaração Antigravity (commit `2e021a9d`)

- "Invalidation when tenant is not active" — quando tenant é suspenso, sessões existentes devem ser invalidadas

### 5.2 Comportamento baseline (V3)

- **Login (auth.ts:59, 87, 103):** `tenant.status === 'active'` verificado ✅
- **Pós-login JWT:** válido por 24h; `tenant.status` NÃO é revalidado em nenhum path crítico
- **Exceção:** `requireTenantAccess()` em `src/lib/security/tenant-authorization.ts:57-61` revalida `tenant.status`, mas só é usado em **1 rota** (`ddc/booking-sync`)
- **Middleware:** `authorizeZcc()` não revalida `tenant.status`
- **Callbacks.session:** não consulta `db.tenant` — apenas copia fields do token

**Vetor de bypass concreto:**
1. T0: User tenant A loga com credenciais válidas (status='active') → JWT 24h emitido
2. T1: Admin suspende tenant A (`tenant.status='suspended'`)
3. T2: User tenant A faz GET `/api/ddc/...` com JWT válido (ainda 24h)
4. Rota usa `resolveTenantId()` → retorna `tenantId` do token (sem DB lookup)
5. Query executada no contexto do tenant A suspenso → **bypass**

### 5.3 Implementação declarada pelo LOTE 3

**Hipóteses:**
- (a) Adicionar `tenant.status` check em `callbacks.session`
- (b) Adicionar `tenant.status` check em `requireTenant()` e em todos os wrappers (`requireTenantId`, `resolveTenantId`, `withApiGuard`)
- (c) Adicionar check em middleware (Edge Runtime não tem Prisma)
- (d) Snapshot de `tenant.status` no JWT (stale, não atende)

**Veredito arquitetural:** Mesmo que (a)+(b) implementados, há risco de:
- 27 arquivos que chamam `getServerSession(authOptions)` direto podem não invocar `requireTenant()`
- 79 arquivos que usam `resolveTenantId`/`requireDDCTenantId` precisam ser atualizados (alto risco de missing updates)
- 81/84 rotas `/api/zcc/*` sem auth import — dependem apenas de middleware
- Endpoints admin ZCC precisam de tratamento especial (admin pode logar mesmo se tenant suspenso?)

### 5.4 Bypass vectors identificados

#### 5.4.1 Endpoints que não usam `requireTenant()`

Listados em §3.5.1:
- 27 arquivos chamam `getServerSession(authOptions)` direto (sem `requireTenant`)
- 79 arquivos usam `resolveTenantId` (sem `tenant.status` check)
- 81/84 ZCC routes sem auth import (apenas middleware)

**Veredito:** Mesmo se LOTE 3 atualiza `requireTenant()`, **80%+ das rotas** ainda bypass.

#### 5.4.2 Server Actions

Next.js Server Actions (em `'use server'` files) NÃO passam pelo middleware. Se usam `getServerSession` direto, **bypass completo**.

**Auditoria:** Sem grep exaustivo, mas contexto do codebase (Next.js 16 com Server Actions) sugere uso em vários lugares.

#### 5.4.3 Internal APIs (cron, webhooks)

- Cron routes: usam `withCronGuard` (auth via CRON_SECRET), **não passam por `tenant.status` check** — esperado (crons são cross-tenant)
- Webhooks (`/api/webhook-whatsapp`, `/api/webhooks/asaas`, `/api/checkout/webhook`): públicos no middleware, autenticam via signature HMAC, não têm `tenant.status` check no path pós-signature — **bypass para tenants suspensos** (se um tenant suspenso tem webhook de pagamento chegando, ainda processa)

#### 5.4.4 Admin routes (`/api/zcc/**`)

**81/84 rotas sem auth import** — apenas middleware. Middleware `authorizeZcc()` valida role + email allow-list mas não `tenant.status`. Se um ZCC admin tem tenant próprio suspenso, ainda acessa ZCC (esperado, mas requer confirmação de que `system_admin` role bypass `tenant.status` intencionalmente).

#### 5.4.5 Cache de `tenant.status`

**Sem cache identificado no baseline.** Se LOTE 3 adiciona cache para evitar DB lookup em cada request:
- TTL do cache? (se 60s, suspending tenant demora 60s para propagar → bypass window)
- Invalidation explícita em `tenant.update`? (sem patch, impossível verificar)

### 5.5 Critical test

```
JWT válido (emitido em T0, maxAge=24h)
+
tenant.status alterado para 'suspended' em T1 (após T0)
=
Acesso negado (403) em qualquer endpoint pós-T1
```

**Sem patch transferido, IMPOSSÍVEL verificar** este critical test. **Esperado:** novo teste em `tests/security/auth-session-revocation-lote3.test.ts` cobre este cenário. **8 testes declarados** mas arquivo AUSENTE no clone GLM.

### 5.6 Performance concern

**Requisito:** Query de `tenant.status` em cada request tem custo de 1 DB roundtrip (~5-20ms em Postgres provisionado).

**Para 100 req/s em pico:**
- Sem cache: 100 DB queries/s de `tenant.findUnique({id})` → ~5% CPU DB
- Com cache (60s TTL): 1 DB query/s + 99 cache hits → ~0.05% CPU DB
- Com cache + invalidation em update: igual ao cache, mas com latência de invalidation

**Sem patch, impossível verificar** se LOTE 3 implementa cache. **Risco:** se não há cache, performance degrada em produção.

### 5.7 Veredito M-AUTH-004

**Estado:** 🟡 `DECLARED_FIXED — INSUFFICIENT EVIDENCE`

**Justificativa:**
- Arquitetura baseline tem 5+ caminhos paralelos de autorização; apenas 1 (`requireTenantAccess`) revalida `tenant.status`
- Middleware não revalida (Edge Runtime sem Prisma)
- 81/84 ZCC routes sem auth import
- 27 arquivos chamam `getServerSession` direto
- Performance concern sem cache definido
- Test file declarado mas AUSENTE

**Risco residual após implementação declarada:**
- Bypass em paths paralelos não atualizados
- Webhooks continuam processando para tenants suspensos
- Server Actions podem bypass middleware
- Race window entre T1 (suspend) e T2 (check) se cache > 0 TTL

---

## 6. M-AUTH-005 AUDIT — Password/Credential Rotation Invalidation

### 6.1 Declaração Antigravity (commit `2e021a9d`)

- `Tenant.passwordChangedAt` field adicionado
- `authTime` claim no JWT
- Invalidação quando `token.authTime < tenant.passwordChangedAt`

### 6.2 Mecanismo declarado

**Lógica esperada:**
```typescript
if (token.authTime && tenant.passwordChangedAt && token.authTime < tenant.passwordChangedAt) {
  return null; // or throw, or redirect to /login
}
```

**Implementação esperada em `callbacks.session`:**
```typescript
async session({ session, token }) {
  if (token.authTime && token.tenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: token.tenantId },
      select: { status: true, passwordChangedAt: true }
    });
    if (!tenant || tenant.status !== 'active') return null; // M-AUTH-004
    if (tenant.passwordChangedAt && token.authTime < tenant.passwordChangedAt.getTime()) {
      return null; // M-AUTH-005
    }
  }
  // ... cópia de fields
  return session;
}
```

### 6.3 Edge cases

#### 6.3.1 Timestamps equal (==)

Se `token.authTime === tenant.passwordChangedAt.getTime()`:
- Boundary: geralmente `<=` (aceita) ou `<` (rejeita)
- Convenção comum: `token.authTime < tenant.passwordChangedAt` (rejeita apenas estritamente anterior)
- Se == → token foi emitido EXATAMENTE no momento da mudança de senha → aceitar (estado consistente)

**Sem patch, impossível confirmar** qual operador LOTE 3 usa.

#### 6.3.2 Timezone (UTC vs local)

**Boa prática:** sempre comparar em UTC (ms since epoch).
- `Date.now()` retorna UTC ms desde epoch
- `DateTime` Prisma persiste em UTC
- JWT `iat`/`authTime` são segundos UTC desde epoch

**Risco:** se LOTE 3 usa `new Date().getTime()` (UTC ms) vs `tenant.passwordChangedAt` (Date object Prisma), comparação é consistente. Se usa `new Date()` (com timezone local), pode haver divergência de ±12h.

**Sem patch, impossível verificar.**

#### 6.3.3 Token sem `authTime` (legacy)

Mesma questão de §4.2.3:
- (A) Rejeitar tokens sem `authTime` → logout forçado em deploy LOTE 3
- (B) Aceitar sem check → bypass para tokens legacy (24h)
- (C) Refresh forçado adicionando `authTime` no próximo `callbacks.jwt`

**Sem patch, impossível verificar** estratégia. **Risco de bypass 24h para tokens legacy.**

#### 6.3.4 Token tampered

JWT signature previne tampering de `authTime`. **Sem bypass neste vetor.**

#### 6.3.5 Concurrent rotation

**Cenário:**
1. T0: User faz request com JWT (`authTime=T0`)
2. T0+ε: Admin troca password do user (`passwordChangedAt=T0+ε`)
3. T0+δ: Request termina com sucesso (DB lookup de `tenant.status` em T0, antes de T0+ε)

**Race window:** δ - ε (tempo entre check e update). Se δ < ε (request completo antes do update), request passa (esperado). Se δ > ε, segundo request já rejeita.

**Não é bypass**, é semântica esperada de "transação consistente no momento do check".

#### 6.3.6 Parallel sessions

**Cenário:** User tem 2 JWTs (2 abas/dispositivos), troca senha em 1.
- Ambos os JWTs têm `authTime < passwordChangedAt`?
- Se user troca própria senha via /reset-password, ambos os JWTs devem ser invalidados.

**Esperado:** `passwordChangedAt` é campo do Tenant (não do JWT), então todos os JWTs do tenant são invalidados simultaneamente. ✅

### 6.4 Critical test

```
T1: User login → JWT emitido com authTime=T1
T2: User (ou admin) muda senha → passwordChangedAt=T2
T3: User faz request com JWT authTime=T1
=
JWT rejeitado (authTime=T1 < passwordChangedAt=T2)
```

**Sem patch transferido, IMPOSSÍVEL verificar.**

### 6.5 Bypass vectors

#### 6.5.1 Replay antes de `passwordChangedAt` atualizado

**Cenário:** Attacker captura JWT em T0. Em T0+10s, user muda senha. Em T0+5s (antes da mudança), attacker replay.

**Não é bypass** — request em T0+5s é legítimo (senha ainda não foi mudada).

#### 6.5.2 `passwordChangedAt` não atualizado em todos os flows

**3 sites de update de `passwordHash` no baseline** (§3.7):
1. `reset-password/route.ts:33`
2. `register/route.ts:65`
3. `magic-verify/route.ts:41`

**Risco:** Se LOTE 3 atualiza `passwordChangedAt` apenas em `reset-password` mas não em `magic-verify`, magic-link flow NÃO invalida sessões antigas. **Sem patch, impossível verificar** se os 3 sites são atualizados.

**Flows adicionais que deveriam atualizar `passwordChangedAt`:**
- Forgot-password (delega para reset-password) ✅
- Admin reset (se existe endpoint admin para resetar senha de tenant) — **não identificado no baseline** (admin não tem endpoint de reset direto)
- Magic-link (via `magic-verify`) ✅
- ZCC admin credential rotation — **não identificado**

#### 6.5.3 Credential change via ZCC admin

**Não há endpoint admin de rotação de senha de tenant no baseline.** ZCC admins usam `ZCC_ADMIN_TOKEN` (env var) ou `ZCC_ADMIN_EMAILS` (env var) para acesso admin — não há `passwordHash` para admin.

**Risco residual:** Se LOTE 3 não considera admins (que não têm `passwordHash`), `passwordChangedAt` para admins é sempre null, e qualquer `authTime` é aceito (correct behavior, admins não têm senha para rotacionar).

### 6.6 Veredito M-AUTH-005

**Estado:** 🟡 `DECLARED_FIXED — INSUFFICIENT EVIDENCE`

**Justificativa:**
- Mecanismo declarado (passwordChangedAt + authTime) é tecnicamente correto
- 3 sites de update de passwordHash no baseline precisam ser atualizados — sem patch, impossível verificar
- Edge cases (timestamps equal, timezone, legacy tokens) sem evidência de tratamento
- Test file declarado mas AUSENTE

**Risco residual:**
- Tokens legacy sem `authTime` (24h bypass window pós-deploy)
- Magic-link flow pode não invalidar sessões (se `passwordChangedAt` não setado em magic-verify)
- Timezone mismatch (se implementação não usa UTC ms)

---

## 7. MIGRATION AUDIT (DECLARED)

### 7.1 Migration `20260901000008_add_revoked_sessions_and_password_changed_at`

**Status no clone GLM:** 🔴 AUSENTE

```bash
$ ls prisma/migrations/ | grep -E "2026090100000[4-9]|revoked"
(empty)
```

### 7.2 SQL correctness (assumed Prisma migration format)

**Esperado (baseado em padrão das migrations existentes):**

```sql
-- Migration: add_revoked_sessions_and_password_changed_at
-- Adds RevokedSession table for persistent JWT revocation
-- Adds passwordChangedAt field on Tenant for credential rotation invalidation

CREATE TABLE IF NOT EXISTS "revoked_sessions" (
    "id"             TEXT NOT NULL,
    "jti"            TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "revokedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "revokedBy"      TEXT,
    "reason"         TEXT,
    CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "revoked_sessions_jti_key" UNIQUE ("jti"),
    CONSTRAINT "revoked_sessions_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "revoked_sessions_jti_idx"
    ON "revoked_sessions" ("jti");

CREATE INDEX IF NOT EXISTS "revoked_sessions_tenantId_revokedAt_idx"
    ON "revoked_sessions" ("tenantId", "revokedAt");

ALTER TABLE "tenants"
    ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
```

### 7.3 Indexes

**Requisitos:**
- ✅ Index em `jti` — para lookup O(log n) em cada request
- ✅ Index em `(tenantId, revokedAt)` — para listagem por tenant (admin UI)
- 🟡 Index em `expiresAt` — para cleanup cron (DELETE WHERE expiresAt < NOW())

**Sem patch, impossível verificar** se indexes estão presentes.

### 7.4 Constraints

**Requisitos:**
- ✅ UNIQUE em `jti` — não revogar mesmo jti duas vezes (idempotência)
- ✅ FK em `tenantId` → `tenants.id` ON DELETE CASCADE — quando tenant deletado, suas revogações também
- 🟡 CHECK em `expiresAt > revokedAt` — garantia de que expiração é futura
- 🟡 CHECK em `reason IN ('manual', 'password_change', 'tenant_suspension', 'admin_force_logout')` — enum controlado

**Sem patch, impossível verificar.**

### 7.5 Nullable/non-nullable

**`passwordChangedAt` em Tenant:**

| Opção | Impacto | Veredito |
|---|---|---|
| (A) `DateTime?` (nullable) | Tenants existentes têm `null`; tokens legacy aceitos (assumir sem rotação desde sempre) | ✅ RECOMENDADO |
| (B) `DateTime` NOT NULL DEFAULT NOW() | Todos os tenants existentes têm timestamp do deploy; TODOS os tokens legacy são invalidados imediatamente | 🔴 MASS LOGOUT |
| (C) `DateTime` NOT NULL (sem default) | Migration falha (exigiria valor para rows existentes) | 🔴 INVIÁVEL |

**Sem patch, impossível verificar** qual estratégia. **Recomendação:** opção (A).

### 7.6 PostgreSQL compatibility

**Análise:**
- Baseline `migration_lock.toml` declara `provider = "sqlite"` — INCONSISTENTE com VPS PostgreSQL declarado em MVK4 V3
- Migrations existentes usam sintaxe que funciona em ambos (CREATE TABLE, CREATE INDEX, ALTER TABLE ADD COLUMN)
- Mas: `TIMESTAMP(3)` (com precisão) é PostgreSQL; SQLite usa `DATETIME` ou `TIMESTAMP` sem precisão

**Veredito:** Se LOTE 3 declara `provider = "postgresql"` no `migration_lock.toml` (corrigindo L2.2 declarado), migration deve usar sintaxe PostgreSQL pura. **Sem patch, impossível confirmar.**

### 7.7 Migration order

**Timestamp:** `20260901000008`

**Comparação com existentes:**
- `20260901000001_v11_p0_policy_audit_and_compiled_prompt`
- `20260901000002_add_lgpd_persistence`
- `20260901000003_add_push_subscriptions`
- `20260901000008_add_revoked_sessions_and_password_changed_at` (DECLARED)

**Ordem:** ✅ Correta (após 003, antes de qualquer outro 004+)

### 7.8 Rollback safety

**Down migration esperado:**
```sql
DROP TABLE IF EXISTS "revoked_sessions";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "passwordChangedAt";
```

**Riscos:**
- DROP TABLE perde dados de revogações ativas (aceitável em rollback)
- DROP COLUMN `passwordChangedAt` perde histórico (aceitável)
- FK constraints: drop table automaticamente remove FK; drop column pode requerer cascade

**Veredito:** ✅ Rollback seguro se SQL estiver correto. **Sem patch, impossível confirmar.**

### 7.9 Impact on existing data

**Tenants existentes:** 1-N (estimado centenas a milhares em produção)

| Estratégia `passwordChangedAt` | Impacto em tokens existentes |
|---|---|
| (A) Nullable, NULL para existentes | Tokens legacy aceitos (assumir sem rotação); tokens novos incluem `authTime` |
| (B) DEFAULT NOW() | Todos os tokens legacy com `authTime < NOW()` são invalidados → mass logout |

**Recomendação:** (A) nullable.

### 7.10 Multi-tenant impact

**FK `revoked_sessions.tenantId` → `tenants.id`:**
- ✅ Garante que revogação reference tenant válido
- ✅ ON DELETE CASCADE: tenant deletado → revogações deletadas
- ✅ Permite filtrar revogações por tenant (admin scope)

**Sem patch, impossível verificar** se FK existe.

### 7.11 Veredito migration audit

**Estado:** 🟡 `DECLARED_FIXED — INSUFFICIENT EVIDENCE`

**Critical gaps:**
- Provider do `migration_lock.toml` (sqlite vs postgresql) não confirmado
- Nullable strategy de `passwordChangedAt` não confirmado (mass logout risk)
- Indexes e constraints não confirmados
- SQL syntax não confirmado

---

## 8. FINDINGS (LOTE3-B-XXX)

---

### LOTE3-B-001 — RevokedSession table declarada, sem patch transferido

| Field | Value |
|---|---|
| **ID** | LOTE3-B-001 |
| **Categoria** | M-AUTH-002 |
| **Severidade** | P0 (crítico) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `prisma/schema.prisma` |
| **Declaração Antigravity** | Commit `2e021a9d` declara `model RevokedSession` adicionado |
| **Evidência baseline** | `grep -nE 'RevokedSession\|passwordChangedAt\|authTime\|\bjti\b' prisma/schema.prisma` → 0 matches |
| **Diretriz Supervisor** | HEAD GLM `a0bb1a85` não é prova de ausência após declaração |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Patch do commit `2e021a9d` transferido ao clone GLM; diff do `prisma/schema.prisma` mostrando `model RevokedSession` com `jti @unique`, `tenantId` FK, `expiresAt` field |

---

### LOTE3-B-002 — `jti` claim ausente no callback jwt (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-002 |
| **Categoria** | M-AUTH-002 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/auth.ts:98-110` (callbacks.jwt) |
| **Declaração Antigravity** | Commit `2e021a9d` declara `jti` issuance |
| **Evidência baseline** | `grep -n 'jti' src/lib/auth.ts` → 0 matches no callbacks.jwt; apenas em `src/lib/auth/jwt.ts` (Alexa), `src/lib/security/cron-auth.ts` (M2M), `src/lib/locks/alexa-security.ts` |
| **Risco se DECLARED incompleto** | Sem `jti`, `RevokedSession.jti` é null para todos os tokens NextAuth; revogação não funciona |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/auth.ts` mostrando `token.jti = crypto.randomUUID()` em `callbacks.jwt` |

---

### LOTE3-B-003 — `authTime` claim ausente no callback jwt (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-003 |
| **Categoria** | M-AUTH-005 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/auth.ts:98-110` |
| **Declaração Antigravity** | Commit `2e021a9d` declara `authTime` claim |
| **Evidência baseline** | `grep -n 'authTime' src/lib/auth.ts` → 0 matches |
| **Risco se DECLARED incompleto** | Sem `authTime`, comparison `token.authTime < tenant.passwordChangedAt` sempre false → bypass permanente |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/auth.ts` mostrando `token.authTime = Date.now()` em `callbacks.jwt` quando `user` presente |

---

### LOTE3-B-004 — `Tenant.passwordChangedAt` field ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-004 |
| **Categoria** | M-AUTH-005 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `prisma/schema.prisma:53-115` (Tenant model) |
| **Declaração Antigravity** | Commit `2e021a9d` declara `Tenant.passwordChangedAt` field |
| **Evidência baseline** | Tenant model L53-115 NÃO contém `passwordChangedAt`; `grep -n 'passwordChangedAt' prisma/schema.prisma` → 0 matches |
| **Risco se DECLARED incompleto** | Sem o field, comparison `token.authTime < tenant.passwordChangedAt` sempre null < number → null (JavaScript falsy) → aceitar (bypass) |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff do `prisma/schema.prisma` Tenant model mostrando `passwordChangedAt DateTime?` |

---

### LOTE3-B-005 — Migration `20260901000008` ausente no clone GLM

| Field | Value |
|---|---|
| **ID** | LOTE3-B-005 |
| **Categoria** | M-AUTH-002 + M-AUTH-005 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `prisma/migrations/20260901000008_add_revoked_sessions_and_password_changed_at/migration.sql` |
| **Declaração Antigravity** | Commit `2e021a9d` declara migration criada |
| **Evidência baseline** | `ls prisma/migrations/ \| grep 2026090100000[4-9]` → 0 matches |
| **Risco se DECLARED incompleto** | Sem migration, schema não é atualizado em produção; runtime Prisma rejeita queries em campos inexistentes |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | SQL da migration transferido; validação de indexes, constraints, FK, nullable strategy |

---

### LOTE3-B-006 — `tenant.status` revalidation em `requireTenant()` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-006 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P0 (agrava LOTE3-B-001) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/auth.ts:131-136` (requireTenant) |
| **Declaração Antigravity** | Commit `2e021a9d` declara "invalidation when tenant is not active" |
| **Evidência baseline** | `requireTenant()` L131-136 apenas retorna `tenantId` do session; `grep 'tenant.status' src/lib/auth.ts` → apenas 2 hits em login paths (L59, L103), nenhum em authorization path |
| **Risco se DECLARED incompleto** | Mesmo com `RevokedSession` table, `requireTenant()` não consulta; 3 arquivos que usam `requireTenant()` fazem bypass |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/auth.ts` `requireTenant()` mostrando `tenant.findUnique` + check `tenant.status === 'active'` |

---

### LOTE3-B-007 — `tenant.status` revalidation em `callbacks.session` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-007 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/auth.ts:112-115` (callbacks.session) |
| **Declaração Antigravity** | Commit `2e021a9d` declara invalidation quando tenant inativo |
| **Evidência baseline** | `callbacks.session` L112-115 apenas copia fields do token para `session.user`; `grep 'db.tenant' src/lib/auth.ts` → apenas em `callbacks.jwt` (L102) e `authorize` (L58), não em `callbacks.session` |
| **Risco se DECLARED incompleto** | 27 arquivos chamam `getServerSession(authOptions)` direto; sem check em `callbacks.session`, todos bypass |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/auth.ts` `callbacks.session` mostrando query de `tenant.status` e return `null` (ou similar) se suspenso |

---

### LOTE3-B-008 — `tenant.status` revalidation em `resolveTenantId` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-008 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/ddc/auth-utils.ts:19-56` (resolveTenantId) |
| **Declaração Antigravity** | Commit `2e021a9d` declara invalidation quando tenant inativo |
| **Evidência baseline** | `resolveTenantId` L19-56 apenas retorna `tenantId` do session; **79 arquivos** dependem desta função; `grep 'tenant.status' src/lib/ddc/auth-utils.ts` → 0 matches |
| **Risco se DECLARED incompleto** | 79 arquivos DDC bypass tenant suspension |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/ddc/auth-utils.ts` mostrando `tenant.findUnique` + status check; OU evidência de que `callbacks.session` é consultado implicitamente por `getServerSession` |

---

### LOTE3-B-009 — `tenant.status` revalidation em `requireTenantId` (tenant-context) ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-009 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/security/tenant-context.ts:26-49` (getTenantId) e `:55-61` (requireTenantId) |
| **Declaração Antigravity** | Commit `2e021a9d` declara invalidation |
| **Evidência baseline** | `getTenantId` L26-49 apenas retorna `tenantId` do session ou AsyncLocalStorage; `grep 'tenant.status' src/lib/security/tenant-context.ts` → 0 matches |
| **Risco se DECLARED incompleto** | Quaisquer routes usando `requireTenantId` ou `getTenantId` bypass |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/security/tenant-context.ts` |

---

### LOTE3-B-010 — `tenant.status` revalidation em `withApiGuard` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-010 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/lib/security/api-guard.ts:27-64` (withApiGuard) |
| **Declaração Antigravity** | Commit `2e021a9d` declara invalidation |
| **Evidência baseline** | `withApiGuard` L27-64 valida role e tenantId mas `grep 'tenant.status\|tenant.findUnique' src/lib/security/api-guard.ts` → 0 matches |
| **Risco se DECLARED incompleto** | Routes com `withTenantGuard`/`withAdminGuard` bypass tenant suspension |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/lib/security/api-guard.ts` mostrando tenant status lookup |

---

### LOTE3-B-011 — Middleware não revalida `tenant.status`

| Field | Value |
|---|---|
| **ID** | LOTE3-B-011 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P1 (middleware é Edge Runtime, sem Prisma) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/middleware.ts:59-80, 82-144` |
| **Declaração Antigravity** | "Middleware changes" em `2e021a9d` |
| **Evidência baseline** | Middleware L82-144 não consulta DB; `authorizeZcc` L65-80 apenas valida role + email allow-list; `grep 'tenant.status\|RevokedSession' src/middleware.ts` → 0 matches |
| **Risco se DECLARED incompleto** | Middleware Next.js Edge Runtime não pode usar Prisma; se LOTE 3 adiciona fetch a endpoint interno, latência adicional |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/middleware.ts` mostrando como `tenant.status` é checado (provavelmente via fetch a `/api/auth/check-tenant-status`) |

---

### LOTE3-B-012 — 81/84 rotas ZCC sem auth import

| Field | Value |
|---|---|
| **ID** | LOTE3-B-012 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P1 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/app/api/zcc/**/route.ts` (84 arquivos) |
| **Declaração Antigravity** | "Middleware changes" em `2e021a9d` |
| **Evidência baseline** | `grep -rL 'requireTenantAccess\|requireTenant(\|requireTenantId\|resolveTenantId\|requireDDCTenantId\|withAdminGuard\|withTenantGuard\|withApiGuard\|getServerSession' src/app/api/zcc/` → 81 arquivos sem match |
| **Risco se DECLARED incompleto** | 81 rotas ZCC dependem apenas de middleware; se middleware não revalida `tenant.status` (LOTE3-B-011), bypass |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de middleware OU diff de cada uma das 81 rotas adicionando auth check |

---

### LOTE3-B-013 — `passwordHash` update sites não atualizam `passwordChangedAt` (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-013 |
| **Categoria** | M-AUTH-005 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivos** | `src/app/api/auth/reset-password/route.ts:33`; `src/app/api/auth/register/route.ts:65`; `src/app/api/auth/magic-verify/route.ts:41` |
| **Declaração Antigravity** | Commit `2e021a9d` declara `Tenant.passwordChangedAt` + `authTime` |
| **Evidência baseline** | `grep 'passwordChangedAt' src/app/api/auth/` → 0 matches; 3 sites de update `passwordHash` não setam `passwordChangedAt` |
| **Risco se DECLARED incompleto** | Password rotation flow não atualiza `passwordChangedAt`; tokens antigos nunca invalidados; bypass permanente |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff dos 3 arquivos mostrando `passwordChangedAt: new Date()` em cada `tenant.update` |

---

### LOTE3-B-014 — Magic-verify não revoga sessões existentes (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-014 |
| **Categoria** | M-AUTH-005 |
| **Severidade** | P0 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/app/api/auth/magic-verify/route.ts:38-42` |
| **Declaração Antigravity** | Commit `2e021a9d` declara invalidation |
| **Evidência baseline** | `magic-verify/route.ts` apenas atualiza `passwordHash` (L39-41); **NÃO** cria `RevokedSession` para JTIs anteriores |
| **Risco se DECLARED incompleto** | Magic-link gera nova senha mas sessões antigas permanecem válidas até expirarem (24h) |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `magic-verify/route.ts` mostrando `RevokedSession.createMany` para JTIs do tenant |

---

### LOTE3-B-015 — Anti-pattern M2M (in-memory `revokedJtis`) replicável em LOTE 3

| Field | Value |
|---|---|
| **ID** | LOTE3-B-015 |
| **Categoria** | M-AUTH-002 |
| **Severidade** | P0 (se replicado) |
| **Estado** | 🟡 RISCO ARQUITETURAL |
| **Arquivo** | `src/lib/security/m2m-policy.ts:20, 138-143` |
| **Evidência baseline** | `const revokedJtis = new Set<string>();` em memória; perdido em cold start; não compartilhado entre instâncias |
| **Risco** | Se LOTE 3 replica este pattern para NextAuth JWTs, revogação é bypass em Vercel serverless (cada invocação = nova instância = Set vazio) |
| **Veredito** | RISCO IDENTIFICADO — sem patch, impossível confirmar se LOTE 3 evita este pattern |
| **Requer para VERIFIED** | Diff de `src/lib/auth.ts` mostrando consulta `db.revokedSession.findUnique` (DB persistente), NÃO `revokedJtis.has()` (in-memory) |

---

### LOTE3-B-016 — Cleanup cron para `RevokedSession` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-016 |
| **Categoria** | M-AUTH-002 |
| **Severidade** | P2 (operacional) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `src/app/api/cron/sessions-cleanup/route.ts` (esperado) |
| **Evidência baseline** | `ls src/app/api/cron/` → 30 cron routes; nenhum para cleanup de sessions |
| **Risco se DECLARED incompleto** | Tabela `revoked_sessions` cresce indefinidamente (estimativa: 100K+ rows/ano em sistema ativo); degrada performance de lookup |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `src/app/api/cron/sessions-cleanup/route.ts` OU evidência de cleanup via TTL PostgreSQL (não suportado nativamente) |

---

### LOTE3-B-017 — Test file `tests/security/auth-session-revocation-lote3.test.ts` ausente (baseline)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-017 |
| **Categoria** | M-AUTH-002 + M-AUTH-004 + M-AUTH-005 |
| **Severidade** | P0 (regression risk) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | `tests/security/auth-session-revocation-lote3.test.ts` |
| **Declaração Antigravity** | 8 testes declarados |
| **Evidência baseline** | `find tests -name '*lote3*' -o -name '*LOTE3*' -o -name '*auth-session*'` → 0 matches |
| **Risco se DECLARED incompleto** | Sem testes de regressão, qualquer regressão silenciosa em `callbacks.session` ou `requireTenant` não é detectada |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Test file transferido ao clone GLM; validação dos 8 testes com `it()` blocks cobrindo: RevokedSession table, jti issuance, authTime issuance, tenant suspension invalidation, password rotation invalidation, legacy token handling, multi-tenant boundary, cleanup |

---

### LOTE3-B-018 — `migration_lock.toml` declara sqlite em baseline (conflito com PostgreSQL)

| Field | Value |
|---|---|
| **ID** | LOTE3-B-018 |
| **Categoria** | M-AUTH-002 (migration) |
| **Severidade** | P1 (blocker se migration depende de postgres) |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE (assumindo LOTE 3 corrige como parte de L2.2) |
| **Arquivo** | `prisma/migrations/migration_lock.toml` |
| **Evidência baseline** | `cat prisma/migrations/migration_lock.toml` → `provider = "sqlite"` |
| **Risco** | Se LOTE 3 não muda lock para `postgresql`, migration `20260901000008` NÃO EXECUTA em produção Vercel Postgres |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Diff de `prisma/migrations/migration_lock.toml` mostrando `provider = "postgresql"` (assumindo declarado em L2.2 do LOTE 2) |

---

### LOTE3-B-019 — Anti-pattern Alexa JWT (in-memory `usedJtis` Map) como referência

| Field | Value |
|---|---|
| **ID** | LOTE3-B-019 |
| **Categoria** | M-AUTH-002 (architectural reference) |
| **Severidade** | P2 (documentação de pattern) |
| **Estado** | 🟢 NOTA INFORMATIVA |
| **Arquivo** | `src/lib/locks/alexa-security.ts:27, 63-82` |
| **Evidência baseline** | `const usedJtis = new Map<string, number>();` em memória; comentário explícito L15-19: "In-memory for now (single Vercel instance). For multi-instance, swap the Map for Redis" |
| **Valor** | Pattern CORRETO para JTI validation (reject se missing, validate iat window, mark as used), mas persistência incorreta para multi-instância |
| **Recomendação** | LOTE 3 deveria usar `RevokedSession` table (DB persistente), NÃO replicar este pattern in-memory |

---

### LOTE3-B-020 — Webhooks públicos não revalidam `tenant.status`

| Field | Value |
|---|---|
| **ID** | LOTE3-B-020 |
| **Categoria** | M-AUTH-004 (webhook bypass) |
| **Severidade** | P1 |
| **Estado** | 🔴 OPEN (não endereçado por LOTE 3) |
| **Arquivo** | `src/app/api/webhook-whatsapp/route.ts`; `src/app/api/webhooks/asaas/route.ts`; `src/app/api/checkout/webhook/route.ts` |
| **Evidência baseline** | `PUBLIC_API_PREFIXES` em `src/middleware.ts:7-14` inclui 3 webhook paths; webhooks autenticam via HMAC signature, não session; se tenant suspenso, webhook ainda processa |
| **Risco** | Tenant suspenso continua recebendo webhooks (e.g., webhook de pagamento processa, atualiza DB) — pode ser desejado (para reconciliação) ou não (para hard stop) |
| **Veredito** | OPEN — decidir política: webhooks continuam (reconciliação) ou são bloqueados (hard stop)? |
| **Requer para VERIFIED** | Documento de política sobre webhook handling para tenants suspensos |

---

### LOTE3-B-021 — Server Actions podem bypass middleware

| Field | Value |
|---|---|
| **ID** | LOTE3-B-021 |
| **Categoria** | M-AUTH-004 |
| **Severidade** | P1 |
| **Estado** | 🔴 OPEN (não endereçado por LOTE 3) |
| **Arquivo** | `'use server'` files em `src/` |
| **Evidência baseline** | Next.js 16 com Server Actions; middleware Next.js NÃO intercepta Server Actions |
| **Risco** | Server Actions que usam `getServerSession` direto bypass middleware; se LOTE 3 não atualiza Server Actions, tenant suspenso pode executar actions |
| **Veredito** | OPEN |
| **Requer para VERIFIED** | Auditoria de todos os Server Actions + diff de cada um adicionando `tenant.status` check |

---

### LOTE3-B-022 — Race window PostgreSQL read replica lag

| Field | Value |
|---|---|
| **ID** | LOTE3-B-022 |
| **Categoria** | M-AUTH-002 (race condition) |
| **Severidade** | P2 |
| **Estado** | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Arquivo** | N/A (infraestrutura DB) |
| **Evidência baseline** | Vercel Postgres + read replica declarado em MVK4 V3; replica lag até N segundos |
| **Risco** | Admin revoga sessão em T0; replica atualiza em T0+N; user request entre T0 e T0+N bypass check |
| **Veredito** | DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| **Requer para VERIFIED** | Política de consistência: usar primary para writes críticos (revocation) + aceitar lag para reads; OU cache invalidation pattern |

---

## 9. VALIDATION GAPS — Evidence required for VERIFIED

Para upgrade de `DECLARED_FIXED` → `VERIFIED`, o Antigravity precisa transferir os seguintes artefatos:

### 9.1 Patch do commit `2e021a9d` (LOTE 3)

**Formato:** `git format-patch -1 2e021a9d > lote3.patch` + transferir arquivo ao clone GLM
**Conteúdo esperado:**
- Diff de `src/lib/auth.ts` (callbacks.jwt + callbacks.session + requireTenant)
- Diff de `prisma/schema.prisma` (RevokedSession model + Tenant.passwordChangedAt)
- Diff de `prisma/migrations/migration_lock.toml` (sqlite → postgresql)
- Diff de `prisma/migrations/20260901000008_add_revoked_sessions_and_password_changed_at/migration.sql`
- Diff de `src/middleware.ts` (se aplicável)
- Diff de `src/lib/security/tenant-authorization.ts` (se aplicável)
- Diff de `src/lib/security/tenant-context.ts` (se aplicável)
- Diff de `src/lib/security/api-guard.ts` (se aplicável)
- Diff de `src/lib/ddc/auth-utils.ts` (se aplicável)
- Diff de `src/app/api/auth/reset-password/route.ts` (passwordChangedAt update)
- Diff de `src/app/api/auth/register/route.ts` (passwordChangedAt update)
- Diff de `src/app/api/auth/magic-verify/route.ts` (passwordChangedAt update + RevokedSession.createMany)
- Diff de `src/app/api/cron/sessions-cleanup/route.ts` (novo arquivo)
- Diff de `tests/security/auth-session-revocation-lote3.test.ts` (novo arquivo, 8 testes)
- Diff de `tests/auth/password-reset-flow.test.ts` (se LOTE 3 altera expectations)

### 9.2 Patch do commit `ebc54d25` (Fase 0 LOTE 3)

**Formato:** `git format-patch -1 ebc54d25 > lote3-fase0.patch`
**Conteúdo esperado:**
- Revert M-PAY-011 regression (já confirmado por Subagent A)
- Remove admin fallback hardcoded (já confirmado por Subagent A)

### 9.3 Diff específicos (checklist)

| # | Item | Arquivo | Função/Elemento | Critério de aceitação |
|---|---|---|---|---|
| 1 | RevokedSession model | `prisma/schema.prisma` | `model RevokedSession { ... }` | Tem `jti @unique`, `tenantId` FK, `expiresAt`, `revokedAt`, `@@index([jti])`, `@@index([tenantId, revokedAt])` |
| 2 | passwordChangedAt field | `prisma/schema.prisma` | `model Tenant { ... passwordChangedAt DateTime? }` | Nullable, sem default |
| 3 | jti issuance | `src/lib/auth.ts:98-110` (callbacks.jwt) | `token.jti = crypto.randomUUID()` | Quando `user` presente (sign-in), não em refresh |
| 4 | authTime issuance | `src/lib/auth.ts:98-110` (callbacks.jwt) | `token.authTime = Date.now()` | Quando `user` presente (sign-in) |
| 5 | RevokedSession check em callbacks.session | `src/lib/auth.ts:112-115` | `await db.revokedSession.findUnique({ where: { jti: token.jti } })` | Em cada `getServerSession` call |
| 6 | tenant.status check em callbacks.session | `src/lib/auth.ts:112-115` | `await db.tenant.findUnique({ where: { id: token.tenantId }, select: { status: true, passwordChangedAt: true } })` | Return null se status !== 'active' |
| 7 | passwordChangedAt comparison | `src/lib/auth.ts:112-115` | `if (token.authTime < tenant.passwordChangedAt.getTime()) return null` | Rejeita token anterior à rotação |
| 8 | tenant.status check em requireTenant | `src/lib/auth.ts:131-136` | `const tenant = await db.tenant.findUnique(...); if (tenant.status !== 'active') redirect('/login')` | Revalida em cada chamada |
| 9 | passwordChangedAt update em reset-password | `src/app/api/auth/reset-password/route.ts:33` | `data: { passwordHash, passwordChangedAt: new Date(), status: 'active' }` | Em cada reset |
| 10 | passwordChangedAt update em register | `src/app/api/auth/register/route.ts:65` | `passwordChangedAt: new Date()` (ou null se register é novo tenant) | Em cada register |
| 11 | passwordChangedAt update em magic-verify | `src/app/api/auth/magic-verify/route.ts:41` | `data: { passwordHash: tempPasswordHash, passwordChangedAt: new Date() }` | Em cada magic-link |
| 12 | RevokedSession.createMany em password change flows | `src/app/api/auth/reset-password/route.ts` + `magic-verify/route.ts` | `await db.revokedSession.createMany({ data: [...JTIs do tenant] })` | Invalida sessões existentes |
| 13 | Migration SQL | `prisma/migrations/20260901000008_add_revoked_sessions_and_password_changed_at/migration.sql` | CREATE TABLE + ALTER TABLE + indexes + FK | Sintaxe PostgreSQL válida |
| 14 | migration_lock.toml | `prisma/migrations/migration_lock.toml` | `provider = "postgresql"` | Corrige L2.2 |
| 15 | Cron cleanup | `src/app/api/cron/sessions-cleanup/route.ts` (novo) | `DELETE FROM revoked_sessions WHERE expiresAt < NOW()` | Agenda diária em vercel.json.crons ou crontab VPS |
| 16 | Test file | `tests/security/auth-session-revocation-lote3.test.ts` (novo) | 8 `it()` blocks | Cobertura: RevokedSession table, jti, authTime, tenant suspension, password rotation, legacy tokens, multi-tenant, cleanup |
| 17 | Middleware changes | `src/middleware.ts` | Verificar tenant.status via fetch a endpoint interno OU justificar que middleware não é o local apropriado | Edge Runtime sem Prisma |

### 9.4 Critical tests esperados no test file LOTE 3

```typescript
describe('LOTE 3 — Auth/Session Revocation', () => {
  it('M-AUTH-002: RevokedSession table exists in Prisma schema', () => { ... });
  it('M-AUTH-002: jwt callback issues jti', () => { ... });
  it('M-AUTH-002: jwt callback issues authTime', () => { ... });
  it('M-AUTH-002: session callback rejects revoked jti', () => { ... });
  it('M-AUTH-004: session callback rejects when tenant.status !== active', () => { ... });
  it('M-AUTH-004: requireTenant rejects when tenant.status !== active', () => { ... });
  it('M-AUTH-005: session callback rejects when token.authTime < tenant.passwordChangedAt', () => { ... });
  it('M-AUTH-005: password reset updates passwordChangedAt', () => { ... });
});
```

---

## 10. Bypass Kill Chain Analysis (LOTE 3 declaration context)

### 10.1 Kill Chain — JWT legacy sem `jti` + `authTime` (24h bypass window)

```
T0: Deploy LOTE 3
↓
Tokens NextAuth emitidos antes de T0 NÃO têm jti nem authTime
↓
T0+1s: User com token legacy faz request
↓
callbacks.session checa: if (token.jti) { ... } — faltando, skip
↓
callbacks.session checa: if (token.authTime) { ... } — faltando, skip
↓
Request passa (bypass)
↓
Até T0+24h (maxAge JWT) todos os tokens legacy são válidos
```

**Mitigação esperada:** refresh forçado de tokens legacy adicionando `jti` + `authTime` no próximo `callbacks.jwt`. **Sem patch, impossível confirmar.**

### 10.2 Kill Chain — Path paralelo de autorização (requireTenant não atualizado)

```
T0: LOTE 3 deploy — adiciona check em callbacks.session
↓
T1: User com tenant suspenso faz GET /api/v1/reservations
↓
Rota usa requireTenant() (auth.ts:131)
↓
requireTenant() NÃO atualizada — apenas retorna tenantId
↓
Request passa (bypass)
↓
Mesmo se callbacks.session rejeitou, requireTenant ainda chamou getServerSession(authOptions)
↓
Depende de implementação: se callbacks.session retorna session null, requireTenant redireciona para /login
↓
MAS: se callbacks.session retorna session sem user fields, requireTenant falha em redirect('/login')
↓
Resultado: User suspenso é redirecionado (não bypass)
```

**Conclusão:** Se LOTE 3 implementa `callbacks.session` corretamente retornando `null` ou session vazia quando tenant suspenso, **até paths paralelos são mitigados** (porque `getServerSession` sempre invoca `callbacks.session`). **Mas** se a implementação retorna session sem rejeitar (apenas remove fields), bypass persiste.

### 10.3 Kill Chain — Vercel serverless + anti-pattern M2M replicado

```
T0: LOTE 3 deploy — adiciona revokedJtis Set in-memory em auth.ts
↓
T1: Admin revoga sessão via /api/sessions/revoke
↓
revokedJtis.add(jti) em instância A
↓
T2: User faz request — Vercel roteia para instância B (cold start)
↓
Instância B tem Set vazio — revokedJtis.has(jti) = false
↓
Request passa (bypass)
```

**Mitigação requerida:** `RevokedSession` table DB persistente, NÃO in-memory Set. **Sem patch, impossível confirmar** qual pattern LOTE 3 adota.

---

## 11. VERDICT + REQUIRED EVIDENCE FOR VERIFIED

### 11.1 Verdict Summary

| Item | Estado |
|---|---|
| `RevokedSession` table | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| `jti` claim | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| `authTime` claim | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| `Tenant.passwordChangedAt` field | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| Migration `20260901000008` | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| Invalidation quando tenant inativo | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| Invalidation após credential rotation | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| WAF chaining changes | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| Middleware changes | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |
| Test file auth-session-revocation-lote3.test.ts | 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE |

**Total: 10 itens DECLARED_FIXED — 0 VERIFIED — 2 OPEN (LOTE3-B-020 webhooks, LOTE3-B-021 Server Actions)**

### 11.2 Final Verdict: 🟡 DECLARED_FIXED — INSUFFICIENT EVIDENCE

**Justificativa:**
- Commit `2e021a9d` declarado mas **NÃO TRANSFERIDO** ao clone GLM
- Supervisor diretriz aplicada: HEAD GLM `a0bb1a85` não é prova de ausência
- Architecture baseline demonstra **5+ caminhos paralelos de autorização**; mesmo se `callbacks.session` for atualizado, há risco de bypass em paths que não invocam `getServerSession(authOptions)` (raro mas possível — e.g., Server Actions, webhooks públicos)
- Anti-pattern M2M (in-memory `revokedJtis` Set) é **risco arquitetural replicável**; se LOTE 3 o replica, bypass silencioso em Vercel serverless
- Migration `migration_lock.toml` ainda declara `provider = "sqlite"` em baseline; se LOTE 3 não corrige, migration não executa em produção Postgres

### 11.3 GO/NO-GO

**🔴 NO-GO** — Go-Live bloqueado até:
1. Patch `2e021a9d` transferido ao clone GLM
2. Re-audit independente confirmando 17 checklist items (§9.3)
3. Validação de que anti-pattern M2M NÃO é replicado
4. Decisão de política sobre webhooks para tenants suspensos (LOTE3-B-020)
5. Auditoria de Server Actions (LOTE3-B-021)
6. Test file `auth-session-revocation-lote3.test.ts` transferido e 8 testes passando

### 11.4 Required Evidence for VERIFIED upgrade

**Para upgrade de DECLARED_FIXED → VERIFIED, o Antigravity deve:**

1. **Transferir patch do commit `2e021a9d`** ao clone GLM (`git format-patch -1 2e021a9d > lote3.patch`)
2. **Transferir patch do commit `ebc54d25`** ao clone GLM (Fase 0)
3. **Aplicar patches** em worktree separada e executar:
   - `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` para validar migration SQL
   - `npm run test -- tests/security/auth-session-revocation-lote3.test.ts` para validar 8 testes
   - `npm run test -- tests/auth/password-reset-flow.test.ts` para validar compatibilidade com test existente
4. **Confirmar via diff** que cada um dos 17 checklist items (§9.3) está implementado
5. **Confirmar** que anti-pattern M2M (`Set<string>` in-memory) NÃO é replicado em `src/lib/auth.ts` — deve usar `db.revokedSession.findUnique`
6. **Confirmar** que `migration_lock.toml` muda para `provider = "postgresql"` (ou já foi corrigido em LOTE 2)
7. **Confirmar** que 3 sites de update `passwordHash` (reset-password, register, magic-verify) adicionam `passwordChangedAt: new Date()`
8. **Confirmar** que `magic-verify/route.ts` adicionalmente cria `RevokedSession` para JTIs anteriores do tenant
9. **Confirmar** que cron job de cleanup existe (ou política alternativa documentada)

### 11.5 Bypass Kill Chain Residual (pós-LOTE 3 declarado, sem VERIFIED)

| Kill Chain | Vetor | Mitigação LOTE 3 declarada | Risco residual |
|---|---|---|---|
| 1 | JWT legacy sem `jti`/`authTime` (24h) | Refresh forçado (hipótese) | Bypass 24h pós-deploy |
| 2 | Path paralelo de autorização | `callbacks.session` (centralizado) | Se session não retorna null, bypass persiste |
| 3 | Vercel serverless + anti-pattern M2M | DB persistente (esperado) | Se replicado, bypass silencioso |
| 4 | Webhooks públicos para tenants suspensos | Não endereçado | Webhook continua processando |
| 5 | Server Actions bypass middleware | Não endereçado | Server Actions podem bypass |
| 6 | PostgreSQL read replica lag | Não endereçado | Bypass window de N segundos |

---

## 12. APÊNDICE — Statísticas do audit

### 12.1 File line counts (baseline)

```
src/lib/auth.ts                                      147 lines
src/middleware.ts                                     148 lines
src/lib/security/tenant-authorization.ts               77 lines
src/lib/security/api-guard.ts                         122 lines
src/lib/security/tenant-context.ts                      60 lines
src/lib/security/m2m-policy.ts                        144 lines
src/lib/security/cron-auth.ts                         113 lines
src/lib/locks/alexa-security.ts                      127 lines
src/lib/ddc/auth-utils.ts                              66 lines
prisma/schema.prisma                                2529 lines
─────────────────────────────────────────────────────────
Total                                               3533 lines
```

### 12.2 Authorization path distribution

```
requireTenant()                (src/lib/auth.ts)              3 files
requireTenantAccess()          (src/lib/security/...)         1 file (booking-sync)
requireTenantId()              (src/lib/security/...)         many via getTenantId
resolveTenantId()              (src/lib/ddc/auth-utils.ts)   79 files
withApiGuard/withTenantGuard   (src/lib/security/api-guard)   some
getServerSession(authOptions) direto                       27 files
/api/zcc/** routes sem auth import                          81/84
```

### 12.3 Search results (baseline `a0bb1a85`)

```
grep -nE 'RevokedSession|passwordChangedAt|authTime|\bjti\b' prisma/schema.prisma
→ 0 matches

grep -rn 'RevokedSession\|passwordChangedAt\|authTime' src/
→ 0 matches relevantes (apenas jti em M2M/cron/Alexa contexts)

grep -rn 'tenant\.status' src/app/api/ src/lib/
→ 12 matches (4 em login, 1 em checkout, 1 em requireTenantAccess, 6 em display/admin)

find tests -name '*lote3*' -o -name '*LOTE3*' -o -name '*auth-session*'
→ 0 matches

git log --all --oneline | grep -iE 'revoke|jti|authTime|passwordChangedAt'
→ 3 matches (smart-lock PIN revoke, NÃO session revocation)
```

### 12.4 Evidence sources

- HEAD GLM: `a0bb1a85` (zella submodule, `main` branch)
- Files: 9 arquivos auditados em detalhe (3533 linhas)
- Schema: 2529 linhas em `prisma/schema.prisma`
- Migrations: 9 migrations + `migration_lock.toml`
- Authorization paths: 6 funções distintas identificadas
- Routes API: 84 rotas ZCC + 27 routes com `getServerSession` direto + 79 com `resolveTenantId` + 3 com `requireTenant`

---

**Fim do audit.**

**Documento:** `/home/z/my-project/download/LOTE3_AUTH_SESSION_REVOCATION_AUDIT.md`
**Auditor:** GLM 5.2 Super Z — Subagent B (LOTE 3 wave)
**HEAD baseline:** `a0bb1a85` (zella)
**HEAD declarado LOTE 3:** `2e021a9d` (não transferido)
**HEAD declarado Fase 0:** `ebc54d25` (não transferido)
**Estado do repositório:** NENHUMA alteração aplicada ao código do projeto (READ-ONLY forensic audit)
