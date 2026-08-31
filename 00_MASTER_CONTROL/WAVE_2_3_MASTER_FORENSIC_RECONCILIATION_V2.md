# WAVE 2/3 MASTER FORENSIC RECONCILIATION V2

**DATA:** 2026-08-27 23:00 BRT
**AUDITOR:** GLM 5.2 — Super Z (Cérebro de Supervisão Forense)
**TASK ID:** 9 (FRONT 9 — MASTER RECONCILIATION)
**PROJECT:** Seu ZéllA / Smart Hotel
**MODO:** READ-ONLY ABSOLUTO
**ENTREGAS:** 8 relatórios individuais + 1 master consolidado

---

## 1. VERDICT EXECUTIVO

### 🔴 BLOCKED — GO-LIVE NÃO AUTORIZADO

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   ESTADO FINAL DA WAVE 2/3 — RECONCILIAÇÃO MASTER V2          │
│                                                               │
│   8 frentes paralelas executadas                             │
│   8 relatórios individuais produzidos                        │
│   1 master reconciliation (este documento)                   │
│                                                               │
│   P0 BLOCKERS (únicos, pós-dedup): 30                        │
│   P1 HIGH: 35+                                                │
│   P2 MEDIUM: 40+                                              │
│   P3 LOW: 20+                                                 │
│                                                               │
│   VERDICTO FINAL: 🔴 BLOCKED                                 │
│                                                               │
│   MOTIVO: 30 P0 bloqueadores não resolvidos no HEAD          │
│   acessível (a0bb1a85 em main) — incluindo:                  │
│     • magic-verify ainda presente e público                  │
│     • JWT sem revogação                                       │
│     • 30+ endpoints sem auth ou com filtro tenant ausente    │
│     • 22/84 rotas ZCC sem verifyZCCAccessOrReject            │
│     • middleware aceita Authorization: Bearer <qualquer>     │
│     • C4 patch NÃO aplicado ao HEAD                          │
│     • LOTE 2 patch INDISPONÍVEL                              │
│     • migration_lock.toml = sqlite                            │
│     • relationMode = "prisma" desabilita FK nativa           │
│     • Transaction sem externalId/metadata → webhooks falham   │
│     • systemd chama workers:start inexistente                 │
│     • Redis não instalado / REDIS_URL não documentado        │
│     • Nginx config quebrada (limit_req zone)                 │
│     • master-gate.yml ausente no HEAD                         │
│     • migrations rodam pós-container                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. ESTADO DO PROJETO — DECLARADO vs REAL

| Atributo | Declarado pelo Antigravity | Verificado GLM | Status |
|---|---|---|---|
| Branch atual | `wave/8-implementation-v3` | `main` | 🔴 DIVERGENTE |
| HEAD commit | `6263cc89fa4ee74663671ec176fe98795810c405` | `a0bb1a85` | 🔴 DIVERGENTE |
| Worktree | LIMPO | DIRTY (17 arquivos) | 🔴 DIVERGENTE |
| Commit C4 (`59f8ec1e`) acessível | LOCAL Antigravity | AUSENTE | 🔴 DIVERGENTE |
| Commit L2 (`6263cc89`) acessível | LOCAL Antigravity | AUSENTE | 🔴 DIVERGENTE |
| Patch LOTE 2 transferido | SIM (em macOS path) | NÃO no env GLM | 🔴 DIVERGENTE |
| C4 aplicado ao código | SIM (declarado) | writeReversalTransaction=0, notifyPaymentRefunded=0 | 🔴 DIVERGENTE |
| LOTE 2 aplicado ao código | SIM (declarado) | @@unique ausente, executeWithBillingIdempotency ausente | 🔴 DIVERGENTE |
| migration_lock provider | `postgresql` (declarado) | `sqlite` | 🔴 DIVERGENTE |
| Testes LOTE 2: 8/8 PASS | SIM (declarado) | Não reproduzível sem patch | ⚪ INSUFFICIENT EVIDENCE |

### Implicação arquitetural crítica

**O ambiente GLM (HEAD `a0bb1a85` em `main`) é ancestral do baseline V3 (`0d375afa`).** As auditorias V3 anteriores foram executadas contra um commit mais recente do que o HEAD atualmente acessível. Isso significa:

1. **Implementações certificadas em ondas anteriores (C4, Auth Hardening) NÃO estão presentes no código-fonte acessível ao GLM.**
2. **Implementações declaradas pelo Antigravity (LOTE 2) também não estão presentes.**
3. As certificações GO emitidas pelo GLM para C4 (LOTE 1) foram baseadas em **auditoria do conteúdo do patch transferido**, NÃO no estado aplicado ao ambiente GLM.
4. A certificação esperada para LOTE 2 é impossível sem o patch.

---

## 3. PANORAMA DAS 8 FRENTES

| # | Frente | Verdict | P0 | P1 | P2 | P3 | Linhas | SHA256 (8 chars) |
|---|---|---|---|---|---|---|---|---|
| 1 | LOT2 V2 — LOTE 2 Forensic Certification | ⚪ INSUFFICIENT EVIDENCE | 0 | 0 | 0 | 0 | 224 | `ff1e6a0e` |
| 2 | AUTH/SESSION/REVOCATION V2 | 🔴 NO-GO | 2 | 3 | 9 | 2 | 863 | `14edb995` |
| 3 | MULTI-TENANT/IDOR V4 | 🔴 NO-GO | 8 | 13 | 7 | 4 | 1136 | `8167770e` |
| 4 | BILLING/PAYMENT/WEBHOOK Adversarial V4 | 🔴 NO-GO + INSUF. EVIDENCE | 5 | 9 | 9 | 0 | 923 | `e961c1dc` |
| 5 | DATABASE/CONCURRENCY V4 | 🔴 NO-GO + INSUF. EVIDENCE | 17 | 13 | 10 | 4 | 1456 | `9b4663f6` |
| 6 | VPS HOSTINGER MVK4 V2 | 🔴 NO-GO + INSUF. EVIDENCE | 12 | 13 | 11 | 4 | 1484 | `9fa2075d` |
| 7 | CI/CD/RELEASE V4 | 🟠 NO-GO + INSUF. EVIDENCE | 9 | 12 | 9 | 9 | 1201 | `63fcbcac` |
| 8 | FULL GO-LIVE RED TEAM V1 | 🔴 NO-GO | 5 | 5 | 6 | 3 | 1284 | `563a9f20` |

**Totais brutos:** 58 P0, 68 P1, 61 P2, 26 P3 = 213 findings

**Após deduplicação cruzada (seção 5):** 30 P0 únicos + 35+ P1 únicos

---

## 4. CROSS-CUTTING FINDINGS — DEDUPLICADOS

Cada P0 abaixo é único (após eliminação de duplicatas entre fronts). A coluna "Origem" indica quais frentes reportaram o achado.

### 4.1 — AUTH/SESSION P0 BLOCKERS (5 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-AUTH-001** | F2-001, F8-002 | P0 | `/api/auth/magic-verify` AINDA existe, é público, usa `Math.random()`, sobrescreve passwordHash de qualquer tenant sem token. V3 recomendou deletar — **não foi feito**. Pior: magic-link provisão `system_admin` (FRONT8-002). | SIM |
| **M-AUTH-002** | F2-002 | P0 | JWT sem revogação: zero `jti`, zero tabela `RevokedSession`, zero revalidação de `tenant.status` no callback `session()`. JWTs válidos por 24h após password change / tenant suspension / admin revoke. | SIM |
| **M-AUTH-003** | F2 (rate limit), F8-005 | P0 | Zero rate limiting em 7 endpoints `/api/auth/**` (login, register, forgot-password, reset-password, magic-link, magic-verify, callback). Enumeration e brute force viáveis. | SIM |
| **M-AUTH-004** | F8-004 | P0 | `/api/auth/register` auto-provisiona plano `lite` pago sem checkout — qualquer atacante cria contas pagas instantaneamente. | SIM |
| **M-AUTH-005** | F2-006 | P0 | `requireTenant()` não revalida `tenant.status` — sessões de tenants suspensos continuam válidas por 24h. | SIM |

### 4.2 — IDOR/AUTHORIZATION P0 BLOCKERS (9 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-IDOR-001** | F3, F8-001 | P0 | Middleware (`src/middleware.ts:127-131`) aceita apenas a **presença** do header `Authorization` (qualquer valor), sem validar o JWT. Cria "thin gate" bypassável com `Authorization: Bearer x`. **Pior**: bloqueia receptores de webhook legítimos (Stripe, MP, Meta, GitHub) que não enviam `Authorization`. | SIM |
| **M-IDOR-002** | F3 | P0 | 13 endpoints V3-flaggados persistem sem auth: `properties/[id]`, `targets/[id]`, `agent-logs`, `ddc/guests/[id]`, `ddc/training/[id]`, `ddc/conversations/[id]/*`, `ddc/live-feed`. | SIM |
| **M-IDOR-003** | F3, F8-003 | P0 | 22 de 84 rotas `/api/zcc/**` admin SEM `verifyZCCAccessOrReject` — escalada vertical por qualquer tenant user. | SIM |
| **M-IDOR-004** | F3 | P0 | `getTenantDb` adoption 0% em API routes — apenas `src/lib/ai/tools/yield-profit-tracker.ts` usa o Prisma extension tenant-scoped. | SIM |
| **M-IDOR-005** | F3 | P0 | Cross-tenant guest PII + physical lock release via `ddc/guest-registration` sem filtro tenantId. | SIM |
| **M-IDOR-006** | F3 | P0 | Cross-tenant AI training corpus poisoning via `ddc/dpo-capture`. | SIM |
| **M-IDOR-007** | F3 | P0 | Cross-tenant Asaas invoice + bankSlipUrl disclosure via `ddc/billing/invoices`. | SIM |
| **M-IDOR-008** | F3 | P0 | Live-feed SSE cross-tenant message surveillance via `ddc/live-feed` polling fallback. | SIM |
| **M-IDOR-009** | F8-006, F8-010 | P0 | LGPD export/delete endpoints com IDOR — `allowGlobalAccess` flag permite exclusão cross-tenant. | SIM |

### 4.3 — BILLING/PAYMENT P0 BLOCKERS (5 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-PAY-001** | F4, F5 | P0 | **C4 patch NÃO aplicado ao HEAD GLM.** `writeReversalTransaction=0`, `notifyPaymentRefunded=0`, `validatePaymentWebhookTransition` callers=0, `bridges.ts` case 'refunded' ausente. Reversal financeira inexistente. | SIM |
| **M-PAY-002** | F4, F1 (LOT2 V2) | P0 | **LOTE 2 patch INDISPONÍVEL.** L2.1 (`@@unique([paymentMethod, externalId])`), L2.2 (postgres migration_lock), L2.3 (`executeWithBillingIdempotency` em monthly-billing), L2.4 (C6 wiring) — todos INSUFFICIENT EVIDENCE. | SIM |
| **M-PAY-003** | F4 | P0 | `NODE_ENV !== 'production'` bypass em `/webhooks/payment` + `monthly-billing` — em dev/staging, assinatura de webhook é ignorada. | SIM |
| **M-PAY-004** | F4 | P0 | `metadata.tenantId` confiado em 3 webhook routes (legacy payment + Stripe) — atacante forja tenantId para ativar plano MAX grátis. | SIM |
| **M-PAY-005** | F4 | P0 | `monthly-billing` cron double-charge em retry — sem `pg_advisory_lock`, sem `executeWithBillingIdempotency` wired. Cenário de R$370K exposure por retry. | SIM |

### 4.4 — DATABASE/CONCURRENCY P0 BLOCKERS (6 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-DB-001** | F5 | P0 | `Transaction` model AUSENTE em `externalId` e `metadata` — 6 sites de código (Asaas webhook, Stripe webhook, ical-sync cron, payment-confirmation cron) referenciam campos inexistentes. Runtime: `PrismaClientValidationError` → webhooks/crons **sempre falham**. | SIM |
| **M-DB-002** | F5 | P0 | Zero proteção física contra double-booking no DB: zero EXCLUDE constraint, zero btree_gist, zero pg_advisory, zero Serializable isolation. Apenas application-level checks racy. | SIM |
| **M-DB-003** | F4, F5 | P0 | `idempotency.ts` é DEAD CODE — zero callers em `src/app/`. Mesmo se invocado, usa `findFirst+create` fora de transaction (race window). | SIM |
| **M-DB-004** | F5, F6 | P0 | `relationMode = "prisma"` desabilita FK nativa do PostgreSQL — integridade referencial depende exclusivamente de application-level checks. | SIM |
| **M-DB-005** | F5, F6, F7 | P0 | `migration_lock.toml` diz `provider = "sqlite"` mas `schema.prisma` diz `postgresql` — migrations podem falhar contra PostgreSQL. | SIM |
| **M-DB-006** | F4, F5 | P0 | `checkout/create` + `checkout/upgrade` sem locking transacional — double-click = double charge R$150, unrecoverable. | SIM |

### 4.5 — VPS/PRODUCTION P0 BLOCKERS (7 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-VPS-001** | F6-001, F7-005 | P0 | `deploy/systemd/zehla-workers.service` `ExecStart=/usr/bin/npm run workers:start` — mas `package.json` NÃO tem script `workers:start`. Worker nunca inicia. | SIM |
| **M-VPS-002** | F6-003 | P0 | Redis não instalado por nenhum setup script (`setup-vps.sh`, `deploy-vps.sh`) — BullMQ/Inngest não funcionam. | SIM |
| **M-VPS-003** | F6-004 | P0 | `REDIS_URL` não documentado em nenhum `.env.example` (23KB) — sem Redis configurável, filas não operam. | SIM |
| **M-VPS-004** | F6, F7-006 | P0 | `deploy/nginx.conf` usa `limit_req zone=webhooks` (linha 130) mas `limit_req_zone` declaration está COMENTADA (linha 190) — `nginx -t` falha, `deploy-vps.sh` aborta no passo 11. | SIM |
| **M-VPS-005** | F6 | P0 | Backup script com bug `pg_dump --format=custom \| gzip` (pipe incorreto) + path `/home/z/zella-mobile/` inexistente — backup nunca completa. | SIM |
| **M-VPS-006** | F6 | P0 | 5 narrativas de deploy conflitantes (deploy-vps.sh, setup-vps.sh, docker-compose.prod.yml, ecosystem.config.js, docs/production/GO-LIVE-RUNBOOK.md) — operador sem caminho canônico. | SIM |
| **M-VPS-007** | F6-012, F7 race 3 | P0 | 28 crons em `vercel.json` + 19 crons em `vps-crontab` = 47 crons potencialmente duplicados em produção VPS. | SIM |

### 4.6 — CI/CD/RELEASE P0 BLOCKERS (4 únicos)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-CICD-001** | F7-001 | P0 | `master-gate.yml` AUSENTE no HEAD GLM (foi adicionado posteriormente em `82c30e63`). Sem gate centralizado. | SIM |
| **M-CICD-002** | F7-002 | P0 | `deploy.yml` `validate` job muito fraco: sem ESLint, apenas 46 de 1955 testes, sem `npm run build`, usa `npm install` (não `npm ci`). PRs quebrados passam. | SIM |
| **M-CICD-003** | F7-003 | P0 | `production-check.ts` dá FALSE POSITIVE para DB connectivity em CI — db module cai para noop proxy quando `DATABASE_URL` ausente → `$queryRaw` retorna null sem throw → DB-01 check reporta PASS. | SIM |
| **M-CICD-004** | F7-004, F6 | P0 | Migrations rodam AFTER container start (`docker compose up -d` → `docker compose exec app prisma migrate deploy`) — janela de 5-30s de queries quebradas em todo deploy. | SIM |

### 4.7 — RED TEAM/NOVOS P0 BLOCKERS (4 únicos — não capturados por fronts 2-7)

| ID Master | Origem | Severidade | Título | Bloqueia Go-Live |
|---|---|---|---|---|
| **M-RT-001** | F8-001 | P0 | Middleware BLOQUEIA webhooks legítimos (Stripe, MP, Meta, GitHub) porque não enviam `Authorization` header. Em produção, todos os webhooks falham antes de chegar no handler. | SIM |
| **M-RT-002** | F8-009 | P1 (elevated to P0 in production context) | WiFi password hardcoded em fonte — exposto via /properties/[id] (M-IDOR-002). | SIM |
| **M-RT-003** | F8-011 | P2 (elevated to P0 if exposed) | Cron `?secret=URL` — CRON_SECRET vaza via logs de access (nginx, Caddy, Vercel analytics). | SIM (se logs públicos) |
| **M-RT-004** | F8-019 | P3 (informational) | Magic-link token exposto em URL (referrer leakage). | NÃO (mas agrava M-AUTH-001) |

---

## 5. MASTER MATRIX

### 5.1 — P0 BLOCKERS (30 únicos)

| ID | Categoria | Severidade | Status | Bloqueia Go-Live | Lote Sugerido |
|---|---|---|---|---|---|
| M-AUTH-001 | Auth | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-AUTH-002 | Auth | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-AUTH-003 | Auth | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-AUTH-004 | Auth | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-AUTH-005 | Auth | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-001 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-002 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-003 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-004 | IDOR | P0 | 🟡 PARTIAL (1 uso) | SIM | LOTE A (Wave 4) |
| M-IDOR-005 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-006 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-007 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-008 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-IDOR-009 | IDOR | P0 | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-PAY-001 | Billing | P0 | 🔴 CONFIRMED — C4 patch ausente | SIM | LOTE B (Wave 5) |
| M-PAY-002 | Billing | P0 | ⚪ INSUFFICIENT EVIDENCE | SIM | LOTE B (Wave 5) |
| M-PAY-003 | Billing | P0 | 🔴 CONFIRMED | SIM | LOTE B (Wave 5) |
| M-PAY-004 | Billing | P0 | 🔴 CONFIRMED | SIM | LOTE B (Wave 5) |
| M-PAY-005 | Billing | P0 | 🔴 CONFIRMED | SIM | LOTE B (Wave 5) |
| M-DB-001 | Database | P0 | 🔴 CONFIRMED — runtime error | SIM | LOTE B (Wave 5) |
| M-DB-002 | Database | P0 | 🔴 CONFIRMED | SIM | LOTE B (Wave 5) |
| M-DB-003 | Database | P0 | 🔴 CONFIRMED — dead code | SIM | LOTE B (Wave 5) |
| M-DB-004 | Database | P0 | 🔴 CONFIRMED | SIM | LOTE C (Wave 6) |
| M-DB-005 | Database | P0 | 🔴 CONFIRMED — sqlite vs postgresql | SIM | LOTE C (Wave 6) |
| M-DB-006 | Database | P0 | 🔴 CONFIRMED | SIM | LOTE B (Wave 5) |
| M-VPS-001 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-VPS-002 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-VPS-003 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-VPS-004 | Infra | P0 | 🔴 CONFIRMED — nginx falha | SIM | LOTE D (Wave 7) |
| M-VPS-005 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-VPS-006 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-VPS-007 | Infra | P0 | 🔴 CONFIRMED | SIM | LOTE D (Wave 7) |
| M-CICD-001 | CI/CD | P0 | 🔴 CONFIRMED | SIM | LOTE E (Wave 8) |
| M-CICD-002 | CI/CD | P0 | 🔴 CONFIRMED | SIM | LOTE E (Wave 8) |
| M-CICD-003 | CI/CD | P0 | 🔴 CONFIRMED — false positive | SIM | LOTE E (Wave 8) |
| M-CICD-004 | CI/CD | P0 | 🔴 CONFIRMED — race migration vs app | SIM | LOTE E (Wave 8) |
| M-RT-001 | Red Team | P0 | 🔴 CONFIRMED — middleware blocks webhooks | SIM | LOTE A (Wave 4) |
| M-RT-002 | Red Team | P0 (elevated) | 🔴 CONFIRMED | SIM | LOTE A (Wave 4) |
| M-RT-003 | Red Team | P0 (elevated) | 🟡 PARTIAL — depende de log exposure | SIM (condicional) | LOTE D (Wave 7) |
| M-RT-004 | Red Team | P3 (info) | 🔴 CONFIRMED | NÃO | Tech debt |

### 5.2 — Categorização por status

#### 🟢 MITIGADOS (0 — nenhum P0 foi mitigado nesta onda)
Nenhum P0 da wave anterior foi efetivamente mitigado no HEAD acessível. As "mitigações" declaradas pelo Antigravity (magic-verify removed, C4 applied, LOTE 2 applied) **não estão refletidas no código-fonte GLM**.

#### 🟡 PARCIAIS (2)
- M-IDOR-004 — `getTenantDb` adotado em 1 arquivo (yield-profit-tracker.ts); 0% nas API routes
- M-RT-003 — CRON_SECRET em URL; depende de logs serem acessíveis

#### 🔴 BLOQUEADORES (36 — 30 P0 + 6 dependências)
Todos os 30 P0 únicos listados acima + 6 que foram elevados de P1/P2 a P0 pelo contexto de produção.

#### ⚪ INSUFFICIENT EVIDENCE (3)
- M-PAY-002 — LOTE 2 patch indisponível
- L2.1, L2.2, L2.3, L2.4 — todos INSUFFICIENT EVIDENCE
- C4 aplicação ao HEAD GLM — divergência não esclarecida

#### 🔵 TECHNICAL DEBT (não bloqueia)
- M-RT-004 — magic-link token em URL (referrer leakage)
- 35+ P1 únicos (rate limits, partial soft-delete, etc.)
- 40+ P2 únicos (lint, types, dead code, etc.)

---

## 6. ORDEM ÓTIMA DE IMPLEMENTAÇÃO

Conforme a regra estabelecida pelo Supervisor:

```
P0 → P1 → integridade financeira → tenant isolation → authentication/session →
database concurrency → infraestrutura → CI/CD → test certification → Go-Live
```

### Wave 4 — LOTE A: Auth + IDOR + Middleware (15 P0 — paralelo com LOTE B)

| Sub-lote | P0 cobertos | Arquivos | Esforço |
|---|---|---|---|
| **A.1** Auth hardening | M-AUTH-001 (deletar magic-verify + caller), M-AUTH-002 (RevokedSession table + jti + tenant.passwordChangedAt + session callback revalidation), M-AUTH-003 (rate limit em 7 endpoints), M-AUTH-004 (register sem auto-provisioning pago), M-AUTH-005 (requireTenant revalida status) | `src/app/api/auth/magic-verify/route.ts` (DELETAR), `src/app/login/page.tsx:101-142` (remover caller), `src/lib/auth.ts`, `src/middleware.ts`, `prisma/schema.prisma` (RevokedSession, passwordChangedAt), nova migration, novo `authRatelimit` import | Alto (2-3 dias) |
| **A.2** IDOR hardening | M-IDOR-002 (13 endpoints), M-IDOR-003 (22 ZCC routes), M-IDOR-005/006/007/008 (DDC cross-tenant), M-IDOR-009 (LGPD) | 35+ arquivos `route.ts` em `src/app/api/properties`, `targets`, `agent-logs`, `ddc/*`, `zcc/*` | Muito alto (3-5 dias) |
| **A.3** Middleware fix | M-IDOR-001, M-RT-001 (middleware aceita Authorization sem validar + bloqueia webhooks) | `src/middleware.ts:127-131` — refazer matcher para validar JWT real E excluir paths de webhook (HMAC path) | Médio (4-6h) |
| **A.4** getTenantDb rollout | M-IDOR-004 | Refatorar 302 rotas para usar `getTenantDb(ctx)` em vez de `prisma` direto | Muito alto (5-7 dias) — pode ser paralelo |

### Wave 5 — LOTE B: Payment + Database Integrity (11 P0 — depende de LOTE A.3)

| Sub-lote | P0 cobertos | Arquivos | Esforço |
|---|---|---|---|
| **B.1** Aplicar C4 patch | M-PAY-001 | Reaplicar commit `59f8ec1e` (writeReversalTransaction, validatePaymentWebhookTransition callers, notifyPaymentRefunded, bridges.ts 'refunded' case, revokeReservationPins wiring) | Médio (assumindo patch disponível) |
| **B.2** Database schema fix | M-DB-001 (adicionar `externalId`, `metadata` a `Transaction`), M-DB-005 (migration_lock → postgresql) | `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, nova migration | Médio (1-2 dias) |
| **B.3** Idempotency wiring | M-PAY-005 (monthly-billing), M-DB-003 (idempotency.ts dead code), M-DB-006 (checkout lock) | `src/app/api/cron/monthly-billing/route.ts`, `src/app/api/checkout/create/route.ts`, `src/app/api/checkout/upgrade/route.ts`, `src/lib/idempotency.ts` (refatorar para pg_advisory_xact_lock + upsert) | Alto (2-3 dias) |
| **B.4** Webhook hardening | M-PAY-003 (NODE_ENV bypass), M-PAY-004 (metadata.tenantId trust) | `src/app/api/webhooks/payment/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/api/webhooks/asaas/route.ts` | Médio (1-2 dias) |
| **B.5** Double-booking prevention | M-DB-002 (EXCLUDE + btree_gist + advisory locks) | Nova migration `add_reservation_overlap_exclude`, `prisma/schema.prisma` raw extension | Alto (2-3 dias) |

### Wave 6 — LOTE C: Database Architecture (2 P0 — depende de LOTE B)

| Sub-lote | P0 cobertos | Esforço |
|---|---|---|
| **C.1** relationMode removal | M-DB-004 (`relationMode = "prisma"` → remove; adicionar FKs nativas; garantir migrations compatíveis) | Muito alto (3-5 dias) — pode quebrar queries |
| **C.2** LOTE 2 re-audit | M-PAY-002 (após patch fornecido) | Auditoria — 2-4h |

### Wave 7 — LOTE D: VPS / Production Infra (8 P0 — paralelo com LOTE E)

| Sub-lote | P0 cobertos | Esforço |
|---|---|---|
| **D.1** Workers + systemd | M-VPS-001 (adicionar `workers:start` script ou trocar `ExecStart`) | Baixo (1h) |
| **D.2** Redis setup | M-VPS-002, M-VPS-003 (instalar Redis via apt, configurar persistência AOF, documentar `REDIS_URL` em `.env.example`) | Médio (4-6h) |
| **D.3** Nginx fix | M-VPS-004 (descomentar `limit_req_zone` ou remover `limit_req zone=webhooks`) | Baixo (30min) |
| **D.4** Backup script | M-VPS-005 (corrigir `pg_dump` pipe, path `/home/z/my-project/` ou similar) | Baixo (1h) |
| **D.5** Deploy narrative | M-VPS-006 (escolher 1 canônico: PM2+Nginx+systemd ou Docker compose — deprecar os outros 4) | Médio (4-6h) |
| **D.6** Cron deduplication | M-VPS-007 (remover `vercel.json` crons se VPS, ou vice-versa) | Baixo (1h) |
| **D.7** CRON_SECRET in header | M-RT-003 (mudar crons para header `X-Cron-Secret` em vez de `?secret=`) | Baixo (2h) |

### Wave 8 — LOTE E: CI/CD (4 P0 — depende de LOTE D)

| Sub-lote | P0 cobertos | Esforço |
|---|---|---|
| **E.1** master-gate.yml | M-CICD-001 (criar workflow centralizado que agrega verdicts de todos os outros) | Médio (4-6h) |
| **E.2** deploy.yml validate job | M-CICD-002 (adicionar ESLint, `npm ci`, `npm run build`, executar suite completa de testes) | Médio (4-6h) |
| **E.3** production-check.ts | M-CICD-003 (fail-closed quando `DATABASE_URL` ausente — throw se `$queryRaw` retorna null) | Baixo (1h) |
| **E.4** Migration ordering | M-CICD-004 (mover `prisma migrate deploy` para entrypoint do container, antes de `next start`) | Médio (2-3h) |

### Wave 9 — LOTE F: Test Certification + Smoke + Disaster Recovery (final)

| Sub-lote | Atividades | Esforço |
|---|---|---|
| **F.1** Test suite cleanup | Reduzir 83% de testes source-text (toContain/toMatch); adicionar testes de regression para cada P0 corrigido | Alto (5-7 dias) |
| **F.2** Smoke tests | E2E test suite para fluxos críticos (login, checkout, webhook, cron, tenant isolation) | Alto (3-5 dias) |
| **F.3** Disaster recovery | Teste de reboot, crash, OOM, disk full, DB corruption | Médio (2-3 dias) |
| **F.4** Backup restore drill | Teste real de restore do backup em ambiente staging | Médio (1-2 dias) |

---

## 7. CRONOGRAMA SUGERIDO

```
WAVE 4 (LOTE A)         ████ 5-7 dias   (Auth + IDOR + Middleware)
WAVE 5 (LOTE B)            ████ 5-7 dias   (Payment + Database) — pode iniciar após A.3
WAVE 6 (LOTE C)               ███ 3-5 dias   (relationMode + LOTE 2 re-audit)
WAVE 7 (LOTE D)         ████ 2-3 dias   (VPS) — paralelo a LOTE E
WAVE 8 (LOTE E)            ███ 2-3 dias   (CI/CD) — depende de D
WAVE 9 (LOTE F)               ██████ 7-10 dias (Tests + Smoke + DR)

TOTAL ESTIMADO: 14-21 dias de engenharia concentrada
```

---

## 8. DEPENDÊNCIAS CRÍTICAS

```
M-AUTH-* ──┬──> M-IDOR-001 (middleware fix depende de auth rewrite)
           └──> M-RT-001 (webhook middleware path)

M-PAY-001 (C4 patch) ──> M-PAY-002 (LOTE 2 depende de C4 aplicado)
                    ──> M-DB-001 (Transaction.externalId é prerequisite de C4 reversal)

M-DB-005 (migration_lock) ──> todas as migrations futuras
M-DB-004 (relationMode) ──> M-DB-002 (EXCLUDE constraint requer FKs nativas)

M-VPS-001 (workers:start) ──> todas as filas (BullMQ/Inngest) operacionais
M-VPS-002 (Redis) ──> M-VPS-001 (workers dependem de Redis)

M-CICD-004 (migration ordering) ──> M-VPS-006 (deploy narrative canônica)
M-CICD-001 (master-gate) ──> todos os P0 devem ter testes de regression antes do gate ser efetivo
```

---

## 9. CONFLITOS IDENTIFICADOS

1. **V3 audit (baseline 0d375afa) vs HEAD GLM (a0bb1a85):** V3 elogiou `master-gate.yml` e `pg_advisory_xact_lock` em `idempotency.ts` — ambos **AUSENTES** no HEAD GLM (ancestral). V3 estava auditando um commit mais novo. Conflito de baseline deve ser resolvido pelo Supervisor.

2. **Antigravity "C4 11/11 PASS" vs GLM HEAD:** Os testes existem apenas no ambiente Antigravity local. Sem o patch aplicado ao HEAD GLM (ou sem acesso ao ambiente Antigravity), a reprodutibilidade é impossível.

3. **Antigravity "LOTE 2 8/8 PASS" vs GLM:** Idem. Patch indisponível.

4. **V1 VPS audit vs V2:** V1 elogiou Nginx "VERIFIED ✓" — V2 contradiz (`limit_req zone` indefinido, `nginx -t` falha). V1 tinha baseline diferente.

5. **Front 3 (IDOR) reportou "302 rotas" vs Front 7 (CI/CD) reportou "1955 testes":** Ambos estão corretos — 302 routes vs 165 test files × ~12 tests/file ≈ 1955 testes. Números consistentes.

---

## 10. REGRESSÕES IDENTIFICADAS

1. **`magic-verify` regression:** V3 recomendou deletar; Auth Hardening (commit `b1c5b6d3`) declarou "remoção definitiva". No HEAD GLM, **ainda existe e ainda é chamado** por `login/page.tsx:106`. Ou o commit `b1c5b6d3` não está aplicado ao HEAD GLM, ou a "remoção" foi revertida.

2. **Migration drift:** 3 migrations presentes no baseline V3 (`0d375afa`) estão AUSENTES no HEAD GLM (`a0bb1a85`): `20260824000010_add_reservation_payments`, `20260824000011_lock_room_assignment`, `20260824000012_security_findings`. A aplicação do LOTE 2 a um HEAD sem essas migrations pode falhar.

3. **Schema drift:** `schema.prisma` no HEAD GLM não contém `Transaction.externalId` nem `Transaction.metadata`, mas 6 sites de código referenciam esses campos. Em runtime, `PrismaClientValidationError` é lançado.

---

## 11. FALSIDADES DESCOBERTAS EM RELATÓRIOS ANTERIORES

| Relatório anterior | Claim | Verdade verificada |
|---|---|---|
| V3 BILLING | "Asaas/MP canonical path is VERIFIED IDEMPOTENT via `process-webhook.ts:65`" | **FALSO** — `process-webhook.ts` NÃO EXISTE em `src/` (deletado em `974df8b5` refactor). V3 auditou arquivo fantasma. |
| V3 BILLING | "MP webhook is VERIFIED IDEMPOTENT" | **FALSO** — `processarWebhookMercadoPago` é STUB que apenas loga e retorna. Nenhuma mutação DB, nenhuma idempotência. |
| V3 DATABASE | D7: "pg_advisory_xact_lock em idempotency.ts é boa prática" | **FALSO** — `git grep pg_advisory src/` retorna 0 resultados. V3 auditou código inexistente. |
| V3 DATABASE | D8: "reservation_payments table protegida" | **FALSO** no HEAD `a0bb1a85` — migration `20260824000010_add_reservation_payments` AUSENTE neste commit. |
| Auth Hardening commit `b1c5b6d3` | "remoção definitiva de `/api/auth/magic-verify`" | **FALSO** no HEAD GLM — magic-verify/route.ts ainda existe, ainda é chamado. |
| Antigravity "C4 11/11 PASS" | Testes C4 passam | **INVERIFICÁVEL** — patch não aplicado ao HEAD GLM; commits locais no Antigravity não acessíveis. |
| Antigravity "LOTE 2 8/8 PASS" | Testes L2 passam | **INVERIFICÁVEL** — patch indisponível. |

---

## 12. VERDICTO FINAL

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   WAVE 2/3 — MASTER FORENSIC RECONCILIATION V2                       │
│                                                                      │
│   🔴 BLOCKED — GO-LIVE NÃO AUTORIZADO                                │
│                                                                      │
│   30 P0 BLOCKERS únicos (pós-dedup)                                  │
│   + 6 P0 elevados de P1/P2 em contexto produção                      │
│   = 36 P0 a resolver antes de Go-Live                                │
│                                                                      │
│   3 INSUFFICIENT EVIDENCE:                                           │
│     • LOTE 2 patch indisponível (L2.1-L2.4)                          │
│     • C4 aplicação ao HEAD GLM não esclarecida                       │
│     • Divergência HEAD declarado vs HEAD verificado                  │
│                                                                      │
│   PRÓXIMA AÇÃO OBRIGATÓRIA:                                          │
│   1. Fornecer patch LOTE 2 ao GLM                                    │
│   2. Esclarecer divergência HEAD (a0bb1a85 vs 6263cc89)              │
│   3. Aplicar (ou confirmar aplicação) do C4 patch ao ambiente alvo  │
│   4. Iniciar Wave 4 — LOTE A (Auth + IDOR + Middleware)             │
│                                                                      │
│   ESTIMATIVA PARA GO-LIVE: 14-21 DIAS DE ENGENHARIA CONCENTRADA      │
│                                                                      │
│   NENHUMA ALTERAÇÃO APLICADA AO CÓDIGO DO PROJETO                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 13. ARTEFATOS PRODUZIDOS NESTA ONDA

| Frente | Documento | Linhas | Bytes | SHA256 |
|---|---|---|---|---|
| 1 | `/home/z/my-project/download/LOT2_POST_IMPLEMENTATION_FORENSIC_AUDIT_V2.md` | 224 | 13.763 | `ff1e6a0e06e0559d11a724d798f463213d133361dbf67c532f0dbec79304fff3` |
| 2 | `/home/z/my-project/download/AUTH_SESSION_REVOCATION_FORENSIC_V2.md` | 863 | 60.392 | `14edb995fca85725f39a1c16965c72b598890710f10b035b72e2505f11e094f6` |
| 3 | `/home/z/my-project/download/MULTI_TENANT_IDOR_FORENSIC_V4.md` | 1136 | 88.329 | `8167770e4ad2aa6a1b0d009c18b7b35ff77c25da0f8da1bc33ca5e8aae18f5b6` (parcial) |
| 4 | `/home/z/my-project/download/BILLING_PAYMENT_WEBHOOK_ADVERSARIAL_V4.md` | 923 | 62.817 | `e961c1dc8a5467cb401fffae0aca53eb50e4dc388f688b37f84d116850de3ea0` |
| 5 | `/home/z/my-project/download/DATABASE_CONCURRENCY_FORENSIC_V4.md` | 1456 | 69.264 | `9b4663f69aeb7869622e33b65d9dd7c035f21e3b0407fb5030738aa87cdeb8c2` |
| 6 | `/home/z/my-project/download/GOLIVE_HOSTINGER_MVK4_PRODUCTION_FORENSIC_V2.md` | 1484 | 84.014 | `9fa2075d9123a2635ee77b58bf465258246de2ee75e0b09a554a65ff3d781171` |
| 7 | `/home/z/my-project/download/CICD_RELEASE_FORENSIC_V4.md` | 1201 | 79.801 | `63fcbcac9db4770f090a1054db87f4366027c0f85b5ea6d8b3edf0fdcde0bf66` |
| 8 | `/home/z/my-project/download/SEUZELLA_FULL_GO_LIVE_REDTEAM_FORENSIC_V1.md` | 1284 | 60.181 | `563a9f202d6a91a0d0ea3b98d9c0678912837296426bfb54b2fba94f1f7605aa` |
| **9 (master)** | `/home/z/my-project/download/WAVE_2_3_MASTER_FORENSIC_RECONCILIATION_V2.md` | (este) | (este) | (este) |

**Total da onda:** 9 documentos, ~8.571 linhas, ~527 KB de inteligência técnica verificável.

---

**FIM DA RECONCILIAÇÃO MASTER V2.**
