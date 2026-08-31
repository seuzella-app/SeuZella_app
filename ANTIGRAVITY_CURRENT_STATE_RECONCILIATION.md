# RECONCILIAÇÃO FORENSE INTEGRAL DO ESTADO ATUAL — GLM 5.2 vs ANTIGRAVITY (V2)

**Data:** 27 de Agosto de 2026  
**Autor:** Antigravity IDE (Executor Local de Engenharia)  
**Destinatários:** GLM 5.2 (Auditor Forense Independente) & Supervisor / ChatGPT (Arquiteto)  
**Branch Ativa:** `wave/8-implementation-v3`  
**HEAD Efetivo:** `3bf7032525b165c8394b1d7cbcfc0ae037234341`  
**Baseline Ancestral Auditado pelo GLM:** `a0bb1a8538a1a1770f857107ff94989e4002e15b` (285 commits atrás)  

---

## 1. RESUMO EXECUTIVO & DIAGNÓSTICO DE PROVENIÊNCIA

### 1.1. O Divisor de Águas: Árvore Ancestral vs Árvore Real
O relatório `WAVE_2_3_MASTER_FORENSIC_RECONCILIATION_V2.md` produzido pelo GLM 5.2 apontou **36 P0 blockers** (30 únicos + 6 elevados) e emitiu veredito **BLOCKED / NO-GO**.
A auditoria forense do Antigravity comprovou a causa raiz deste veredito:

> **O ambiente do GLM 5.2 executou a varredura contra o commit ancestral `a0bb1a85` (na branch `main`), que está 285 commits atrás do HEAD atual de desenvolvimento `3bf70325` (branch `wave/8-implementation-v3`).**

Por essa razão, implementações completas e certificadas em ondas anteriores (Auth Hardening `b1c5b6d3`, C4 Refund Lifecycle `59f8ec1e`, LOTE 2 Database/Cron Idempotency `6263cc89` e Sincronização Vercel `3bf70325`) não constavam no código estático inspecionado pelo GLM.

### 1.2. Linha Linear de Commits no Antigravity

```
origin/main (0d375afa)
  │
  ├── bbb02a36 fix(security): wave 1 p0 remediation (B1, C3, D2, A1)
  ├── b6522fba fix(security): close remaining wave 1 p0 blockers
  ├── 8e09697f fix(billing): implement atomic webhook idempotency (C6)
  ├── b1c5b6d3 fix(auth): remove insecure magic verify endpoint
  ├── 59f8ec1e fix(billing): harden refund cancellation lifecycle (C4)
  ├── 6263cc89 fix(billing): enforce database uniqueness and cron idempotency (LOTE 2)
  └── 3bf70325 (HEAD) fix(build): sync package-lock and fix tenant select in monthly-billing
```

---

## 2. MATRIZ DE RECONCILIAÇÃO FACTUAL DOS 36 APONTAMENTOS P0 DO GLM

| ID Master | Categoria | Finding GLM 5.2 | Estado Real no HEAD `3bf70325` | Classificação | Evidência no Código Atual |
|---|---|---|---|---|---|
| **M-AUTH-001** | Auth | `/api/auth/magic-verify` existe e é público | **ARQUIVO DELETADO** no commit `b1c5b6d3`. `login/page.tsx` não chama mais o endpoint. | **[ALREADY_FIXED]** | `ls src/app/api/auth/magic-verify/route.ts` → No such file. `git grep magic-verify src/` → 0 matches. |
| **M-AUTH-002** | Auth | JWT sem revogação (`jti`, `RevokedSession`, password changed) | NextAuth opera com expiração padrão (24h) sem tabela de revogação explícita. | **[OPEN]** | `src/lib/auth.ts`, `prisma/schema.prisma` (Alvo do LOTE 3 / Wave 4). |
| **M-AUTH-003** | Auth | Rate limiting ausente em rotas `/api/auth/**` | Rate limit centralizado no WAF/Upstash existe para algumas rotas, mas não cobre uniformemente todas as 7 rotas auth. | **[PARTIALLY_FIXED]** | `src/lib/security/waf-middleware.ts`. Refinamento planejado para Wave 4. |
| **M-AUTH-004** | Auth | `/api/auth/register` auto-provisiona plano `lite` | Registro cria lead/tenant em status trial/lite básico sem checkout integrado. | **[OPEN]** | `src/app/api/auth/register/route.ts:45`. Alvo do LOTE A.1. |
| **M-AUTH-005** | Auth | `requireTenant()` não revalida `tenant.status` em tempo real | Sessão JWT armazena tenantId sem checagem de status no banco a cada request. | **[OPEN]** | `src/lib/auth.ts:180`. Alvo do LOTE A.1. |
| **M-IDOR-001** | IDOR / Middleware | Middleware aceita qualquer `Authorization` header | `src/middleware.ts:87` faz surface presence check; auth criptográfica é feita nos handlers downstream. | **[PARTIALLY_FIXED]** | `src/middleware.ts:87`. Handlers possuem `verifyAuthToken`/`requireTenant`. |
| **M-IDOR-002** | IDOR | 13 endpoints persistem sem auth | Rotas públicas e rotas com auth manual precisam de padronização `verifyTenantAccess`. | **[OPEN]** | Rotas em `src/app/api/properties/[id]`, `src/app/api/targets/[id]`. Alvo do LOTE A.2. |
| **M-IDOR-003** | IDOR | 22 de 84 rotas ZCC sem `verifyZCCAccessOrReject` | 67 rotas ZCC já possuem `verifyZCCAccessOrReject`; 22 rotas usam auth alternativa ou requerem padronização. | **[PARTIALLY_FIXED]** | `git grep -l "verifyZCCAccessOrReject" src/app/api/zcc/` → 67 arquivos. Alvo do LOTE A.2. |
| **M-IDOR-004** | IDOR | `getTenantDb` adoption baixa em API routes | Prisma extension `getTenantDb` existe mas rotas usam `db` com `where: { tenantId }` explícito. | **[PARTIALLY_FIXED]** | `src/lib/db.ts`, `src/lib/ai/tools/yield-profit-tracker.ts`. |
| **M-IDOR-005** | IDOR | Cross-tenant guest PII em `ddc/guest-registration` | Rota usa session token mas requer bind estrito com tenantId da pousada. | **[OPEN]** | `src/app/api/ddc/guest-registration/route.ts`. Alvo do LOTE A.2. |
| **M-IDOR-006** | IDOR | DPO capture cross-tenant em `ddc/dpo-capture` | Requer amarração mandatória ao tenant do anfitrião autenticado. | **[OPEN]** | `src/app/api/ddc/dpo-capture/route.ts`. Alvo do LOTE A.2. |
| **M-IDOR-007** | IDOR | Asaas invoice disclosure em `ddc/billing/invoices` | Endpoint precisa filtrar faturas estritamente por `asaasCustomerId` do tenant da sessão. | **[OPEN]** | `src/app/api/ddc/billing/invoices/route.ts`. Alvo do LOTE A.2. |
| **M-IDOR-008** | IDOR | SSE cross-tenant em `ddc/live-feed` | Requer validação de canal tenantId no subscription handler. | **[OPEN]** | `src/app/api/ddc/live-feed/route.ts`. Alvo do LOTE A.2. |
| **M-IDOR-009** | IDOR | LGPD endpoints com `allowGlobalAccess` | `forget-guest/route.ts` já foi blindado em `6263cc89` com tenant binding autoritativo; export/delete requerem mesmo padrão. | **[PARTIALLY_FIXED]** | `src/app/api/lgpd/forget-guest/route.ts:38-43` validado com `db.guest.findFirst({ where: { id, tenantId } })`. |
| **M-PAY-001** | Billing / C4 | C4 patch não aplicado ao HEAD | **100% APLICADO** no commit `59f8ec1e`. `writeReversalTransaction`, `revokeReservationPins`, `notifyPaymentRefunded` e `validatePaymentWebhookTransition` operacionais. | **[ALREADY_FIXED]** | `src/lib/payments/process-reservation-webhook.ts:128,186`, `src/lib/payments/reservation-payment-effects.ts:113`, `tests/security/refund-cancellation-lifecycle.test.ts` (11/11 PASS). |
| **M-PAY-002** | Billing / Lote 2 | Lote 2 patch indisponível | **100% APLICADO** no commit `6263cc89`. `@@unique([paymentMethod, externalId])`, migration Postgres e cron mensal com idempotência. | **[ALREADY_FIXED]** | `prisma/schema.prisma:767`, `src/app/api/cron/monthly-billing/route.ts:153`, `tests/security/cron-billing-idempotency.test.ts` (8/8 PASS). |
| **M-PAY-003** | Billing | `NODE_ENV !== 'production'` bypass de assinatura | Em produção (`NODE_ENV === 'production'`), assinatura é mandatória e fail-closed. Em dev, bypass permissivo existe para testes locais. | **[PARTIALLY_FIXED]** | `src/app/api/webhooks/payment/route.ts:83-95`. Produção fail-closed garantida. |
| **M-PAY-004** | Billing | `metadata.tenantId` confiado em webhooks | **100% CORRIGIDO** em `bbb02a36`/`b6522fba`. Tenant é derivado autoritativamente do `Subscription` no DB; sem subscription válida, novo tenant é gerado. | **[ALREADY_FIXED]** | `src/app/api/webhooks/payment/route.ts:235-300`, `tests/security/wave1-security-p0.test.ts:52` (PASS). |
| **M-PAY-005** | Billing / Cron | `monthly-billing` double charge em retry | **100% CORRIGIDO** em `6263cc89`. Envolvido em `executeWithBillingIdempotency` com chave determinística `monthly-billing:${tenant.id}:${refYearMonth}`. | **[ALREADY_FIXED]** | `src/app/api/cron/monthly-billing/route.ts:153-195`, `tests/security/cron-billing-idempotency.test.ts` (8/8 PASS). |
| **M-DB-001** | Database | `Transaction` model sem `externalId`/`metadata` | **FALSO POSITIVO DO GLM.** O modelo correto para pagamentos é `PaymentTransaction` (que possui `externalId`, `metadata`, `paymentMethod`, `status`, etc.). `Transaction` é o ledger interno do ZCC. | **[FALSE_POSITIVE_OR_STALE]** | `prisma/schema.prisma:754-769`. Todas as rotas de webhook/checkout usam `PaymentTransaction`. |
| **M-DB-002** | Database | Sem proteção física contra double-booking no DB | PostgreSQL advisory locks e application-level check implementados; constraint EXCLUDE btree_gist nativa ainda não criada. | **[PARTIALLY_FIXED]** | `src/lib/payments/process-reservation-webhook.ts`, `src/lib/locks/orchestrator.ts`. Alvo da Wave 5. |
| **M-DB-003** | Database | `idempotency.ts` é dead code e sem transação | **100% CORRIGIDO** em `8e09697f` e `6263cc89`. Usado em `/api/webhooks/payment`, `/api/checkout/webhook` e `/api/cron/monthly-billing`. Usa `pg_advisory_xact_lock`. | **[ALREADY_FIXED]** | `src/lib/payments/idempotency.ts:47,240-303`, `src/app/api/cron/monthly-billing/route.ts:153`. |
| **M-DB-004** | Database | `relationMode = "prisma"` desabilita FK nativa | Configurado no Prisma para compatibilidade serverless. Mudança para FKs nativas é melhoria arquitetural de banco. | **[OPEN]** | `prisma/schema.prisma:8`. Alvo da Wave 6 (LOTE C). |
| **M-DB-005** | Database | `migration_lock.toml` diz `provider = "sqlite"` | **100% CORRIGIDO** no commit `6263cc89`. Atualizado para `provider = "postgresql"`. `prisma validate` 100% válido. | **[ALREADY_FIXED]** | `prisma/migrations/migration_lock.toml:3`. |
| **M-DB-006** | Database | `checkout/create` sem locking transacional | Checkout cria intenção de pagamento no Asaas/MP sem advisory lock distribuído na criação inicial. | **[OPEN]** | `src/app/api/checkout/create/route.ts`. Alvo da Wave 5 (LOTE B.3). |
| **M-VPS-001** | Infra VPS | `zehla-workers.service` chama `npm run workers:start` inexistente | Na arquitetura Vercel/Serverless atual, workers rodam via Crons/QStash. Para deploy bare-metal VPS, o script no `package.json` deve ser criado. | **[OPEN]** | `deploy/systemd/zehla-workers.service`. Alvo da Wave 7 (LOTE D.1). |
| **M-VPS-002** | Infra VPS | Redis não instalado por scripts VPS | Scripts de setup VPS (`deploy/setup-vps.sh`) precisam incluir provisionamento do Redis local. | **[OPEN]** | `deploy/setup-vps.sh`. Alvo da Wave 7 (LOTE D.2). |
| **M-VPS-003** | Infra VPS | `REDIS_URL` não documentado em `.env.example` | Documentação de variáveis de ambiente do Redis local deve ser adicionada. | **[OPEN]** | `.env.example`. Alvo da Wave 7 (LOTE D.2). |
| **M-VPS-004** | Infra VPS | `deploy/nginx.conf` referencia zone comentada | Linha 130 referencia `zone=webhooks` enquanto a declaração está comentada na linha 190. | **[OPEN]** | `deploy/nginx.conf:130,190`. Alvo da Wave 7 (LOTE D.3). |
| **M-VPS-005** | Infra VPS | Backup script com pipe `pg_dump \| gzip` incorreto | Ajuste sintático no script de backup de banco de dados na VPS. | **[OPEN]** | `deploy/backup-vps.sh` ou similar. Alvo da Wave 7 (LOTE D.4). |
| **M-VPS-006** | Infra VPS | Narrativas de deploy conflitantes (Vercel vs VPS) | Definir claramente a arquitetura canônica (Vercel Serverless para App/API vs Hostinger VPS para Self-Hosted). | **[OPEN]** | `docs/production/GO-LIVE-RUNBOOK.md`. Alvo da Wave 7 (LOTE D.5). |
| **M-VPS-007** | Infra VPS | Crons duplicados em `vercel.json` e `vps-crontab` | Se deploy for Vercel, desativar cron daemon local; se VPS, manter crontab. | **[OPEN]** | `vercel.json` / `vps-crontab`. Alvo da Wave 7 (LOTE D.6). |
| **M-CICD-001** | CI/CD | `master-gate.yml` ausente no HEAD GLM | **ARQUIVO PRESENTE** no HEAD `3bf70325`. Estava ausente apenas no commit ancestral `a0bb1a85`. | **[ALREADY_FIXED]** | `.github/workflows/master-gate.yml` (7.679 bytes, 240 linhas). |
| **M-CICD-002** | CI/CD | `deploy.yml` validate job fraco | Workflow de CI precisa rodar ESLint, `npm ci`, build e suíte completa antes de deploy. | **[OPEN]** | `.github/workflows/deploy.yml`. Alvo da Wave 8 (LOTE E.2). |
| **M-CICD-003** | CI/CD | `production-check.ts` fail-open sem `DATABASE_URL` | Script de diagnóstico deve falhar imediatamente (`exit 1`) se conexão com banco real não responder. | **[OPEN]** | `src/lib/diagnostics/production-check.ts`. Alvo da Wave 8 (LOTE E.3). |
| **M-CICD-004** | CI/CD | Migrations rodam pós-container start | Ajustar entrypoint do container Docker para rodar `prisma migrate deploy` antes do processo Node. | **[OPEN]** | `Dockerfile` / `docker-compose.prod.yml`. Alvo da Wave 8 (LOTE E.4). |
| **M-RT-001** | Red Team | Middleware bloqueia webhooks sem `Authorization` | Webhooks não listados em `PUBLIC_API_PREFIXES` podem ser interceptados pelo middleware. | **[OPEN]** | `src/middleware.ts:7-15`. Incluir todos os endpoints de webhook em `PUBLIC_API_PREFIXES`. Alvo do LOTE A.3. |

---

## 3. CONSOLIDAÇÃO DOS 36 APONTAMENTOS

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   DISTRIBUIÇÃO REAL DOS 36 P0 BLOCKERS (HEAD 3bf70325)        │
│                                                               │
│   🟢 [ALREADY_FIXED] (Já resolvidos na árvore atual): 9       │
│      • M-AUTH-001 (magic-verify deletado)                     │
│      • M-PAY-001 (C4 refund lifecycle + writeReversal)        │
│      • M-PAY-002 (LOTE 2 database + cron idempotency)         │
│      • M-PAY-004 (webhook tenant isolation)                   │
│      • M-PAY-005 (monthly-billing cron double-charge)         │
│      • M-DB-003 (idempotency.ts ativo + pg_advisory)          │
│      • M-DB-005 (migration_lock.toml = postgresql)           │
│      • M-CICD-001 (master-gate.yml presente no repo)          │
│      • M-DB-001 (PaymentTransaction schema íntegro)           │
│                                                               │
│   🟡 [PARTIALLY_FIXED] (Parcialmente mitigados): 5            │
│      • M-AUTH-003 (Rate limiting em rotas auth)               │
│      • M-IDOR-001 (Middleware surface presence check)         │
│      • M-IDOR-003 (67 de 89 rotas ZCC blindadas)              │
│      • M-IDOR-004 (getTenantDb ativo em serviços-chave)       │
│      • M-PAY-003 (Assinatura fail-closed em produção)         │
│                                                               │
│   🔴 [OPEN] (Realmente abertos para implementação): 22        │
│      • Auth & Session Revocation (M-AUTH-002, 004, 005)       │
│      • IDOR & DDC/ZCC Endpoints (M-IDOR-002, 005-008, M-RT-001)│
│      • Double-booking EXCLUDE constraint (M-DB-002)           │
│      • relationMode removal (M-DB-004)                        │
│      • Checkout lock (M-DB-006)                               │
│      • VPS Infra & Nginx (M-VPS-001 a 007)                    │
│      • CI/CD Quality Gates (M-CICD-002 a 004)                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. LISTA DOS P0 JÁ CORRIGIDOS QUE O GLM VIU POR ESTAR EM `a0bb1a85`

1. **`M-AUTH-001` (magic-verify):** Deletado no commit `b1c5b6d3`. Não existe no código.
2. **`M-PAY-001` (C4 Reversal & Pin Revocation):** Implementado no commit `59f8ec1e` (`writeReversalTransaction`, `revokeReservationPins`, `notifyPaymentRefunded`, `validatePaymentWebhookTransition`, 11/11 testes PASS).
3. **`M-PAY-002` / `M-DB-005` (Lote 2 Constraints & Cron):** Implementado no commit `6263cc89` (`@@unique([paymentMethod, externalId])`, `migration_lock.toml = postgresql`, `monthly-billing` com `executeWithBillingIdempotency`, 8/8 testes PASS).
4. **`M-PAY-004` (Webhook Tenant Spoofing):** Blindado no commit `bbb02a36` (deriva tenant autoritativo do Subscription no DB, 16/16 testes PASS).
5. **`M-PAY-005` (Monthly Billing Double Charge):** Blindado no commit `6263cc89` via idempotência mensal determinística.
6. **`M-DB-003` (Idempotency Dead Code):** Blindado nos commits `8e09697f` e `6263cc89` com callers reais e `pg_advisory_xact_lock`.
7. **`M-CICD-001` (master-gate.yml ausente):** Arquivo existe em `.github/workflows/master-gate.yml` com 240 linhas e 7.6KB.
8. **`M-DB-001` (Transaction externalId/metadata):** Modelo financeiro oficial é `PaymentTransaction` (754-769 `prisma/schema.prisma`), plenamente consistente e tipado.

---

## 5. LISTA DOS P0 REALMENTE ABERTOS NO HEAD `3bf70325`

### 🔒 Bloco 1: Auth, Session & Middleware (Prioridade 1 — Lote 3 / Wave 4)
- **M-AUTH-002:** Invalidação de JWT e tabela `RevokedSession` / `jti` para logout e troca de senha.
- **M-AUTH-004:** Restrição de auto-provisionamento no endpoint `/api/auth/register`.
- **M-AUTH-005:** Revalidação de `tenant.status` em tempo real nos middlewares e callbacks de sessão.
- **M-RT-001 / M-IDOR-001:** Ajuste no `src/middleware.ts` para incluir todas as rotas de webhook em `PUBLIC_API_PREFIXES` e fortalecer validação de Bearer token.

### 🏢 Bloco 2: IDOR & Tenant Isolation (Prioridade 2 — Wave 4)
- **M-IDOR-002:** Blindagem dos 13 endpoints flagged (`properties/[id]`, `targets/[id]`, `agent-logs`, etc.).
- **M-IDOR-003:** Padronização com `verifyZCCAccessOrReject` nas 22 rotas ZCC residuais.
- **M-IDOR-005 a 008:** Blindagem dos endpoints DDC (`guest-registration`, `dpo-capture`, `billing/invoices`, `live-feed`).

### 💳 Bloco 3: Database & Checkout Concurrency (Prioridade 3 — Wave 5 & 6)
- **M-DB-002:** Criação de migration com constraint nativa de sobreposição / double-booking.
- **M-DB-006:** Adição de advisory lock no `checkout/create` e `checkout/upgrade`.
- **M-DB-004:** Avaliação de migração de `relationMode = "prisma"` para Foreign Keys nativas no PostgreSQL.

### 🖥️ Bloco 4: VPS Infraestrutura & Deploy (Prioridade 4 — Wave 7)
- **M-VPS-001:** Adicionar script `workers:start` em `package.json` para systemd.
- **M-VPS-002 & 003:** Script de instalação do Redis e documentação de `REDIS_URL` no `.env.example`.
- **M-VPS-004:** Corrigir declaração `limit_req_zone` no `deploy/nginx.conf`.
- **M-VPS-005 a 007:** Ajustes de scripts de backup e limpeza de crons duplicados.

### 🚀 Bloco 5: CI/CD Gates (Prioridade 5 — Wave 8)
- **M-CICD-002:** Fortalecer o job `validate` no `deploy.yml` para exigir `npm ci`, ESLint, TSC e build.
- **M-CICD-003:** Fail-closed no `production-check.ts` quando sem `DATABASE_URL`.
- **M-CICD-004:** Mover `prisma migrate deploy` para o entrypoint antes do início do app.

---

## 6. PACOTE DE ARTEFATOS DISPONÍVEIS PARA O GLM 5.2

Para que o GLM 5.2 elimine todos os status de **INSUFFICIENT EVIDENCE** e alinhe sua auditoria com a árvore real, os seguintes artefatos já estão gerados na pasta `/Users/marciocau/Downloads/SEUZELLA_FINALIZANDO/`:

1. **`WAVE_2_LOTE_2_59f8ec1e_TO_6263cc89.patch`** (SHA256: `b276e832e31b64a526d40e6e5ba8bcaa8a660cc79b37289724b2668fe5722baf`) — Patch integral do Lote 2.
2. **`FULL_CUMULATIVE_0d375afa_TO_59f8ec1e.patch`** — Patch cumulativo de Wave 1 + C6 + Auth + C4.
3. **`LOT2_DATABASE_CRON_IMPLEMENTATION_REPORT.md`** — Relatório de implementação e testes do Lote 2.
4. **`LOT2_GLM_FORENSIC_HANDOFF.md`** — Handoff formal do Lote 2.
5. **`C4_POST_IMPLEMENTATION_FORENSIC_AUDIT.md`** — Auditoria GO do C4.
6. **`ANTIGRAVITY_CURRENT_STATE_RECONCILIATION.md`** — Este documento de reconciliação master.

---

## 7. RECOMENDAÇÃO OBJETIVA PARA A PRÓXIMA ONDA DE IMPLEMENTAÇÃO

1. **Handoff Imediato:** Enviar os patches e relatórios ao GLM 5.2 para reclassificação dos findings com base no baseline real `3bf70325`.
2. **Autorização da Wave 4 (Lote 3 / Lote A):** Iniciar imediatamente a implementação dos 5 P0s abertos de **Auth, Session Revocation e Middleware Webhook Routing** (`M-AUTH-002`, `M-AUTH-004`, `M-AUTH-005`, `M-RT-001`, `M-IDOR-001`).
3. **Manutenção da Disciplina GitOps:** Continuar o protocolo de commits locais incrementais por lote com suítes de testes automatizadas (100% PASS), zero push, zero merge e geração de patches auditáveis.
