# ZéCode × GitHub — GitOps Layer

> **Doc oficial:** `Biblia-do-ZeCode-GitHub-GitOps.pdf` (gerada em `/download/`)

Camada de integração GitHub × ZCC que permite ao ZéCode operar o GitHub
como plataforma de GitOps completa: criar branches, abrir PRs, comentar
em issues, disparar workflows de CI/CD, e responder a webhooks em tempo
real — tudo com segurança enterprise-grade.

---

## Arquitetura

```
┌──────────────────────────────────────────────────────┐
│  GITHUB (conta corporativa)                          │
│  • Fine-Grained PAT (40+ permissões granulares)      │
│  • Webhooks → /api/zcc/github/webhook                │
│  • GitHub Actions → .github/workflows/ze-code-review │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  ZCC API (Next.js)                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  PAT Vault (AES-256-GCM)                     │   │
│  │  - encryptPat() / decryptPat()               │   │
│  │  - rotateCredential() (zero-downtime)        │   │
│  │  - emergencyRevoke()                          │   │
│  │  - checkPatExpiry() (cron diário)            │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  GitHubClient                                 │   │
│  │  - createBranch / commitFiles (átomo)         │   │
│  │  - createPR / createPRReview / mergePR        │   │
│  │  - createIssue / addLabels                    │   │
│  │  - getWorkflowRuns / getCheckStatuses         │   │
│  │  - rate limit + retry + ETag cache            │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  ApplyViaPR (Evolve-to-PR pipeline)          │   │
│  │  - RefactorSuggestion → Branch → Commit → PR │   │
│  │  - Dry-run mode + GODMODE lock               │   │
│  │  - MAX_OPEN_PRS=3 limite                      │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Quick Start (5 minutos)

### 1. Configurar variáveis de ambiente

```bash
# Adicione ao .env:

# CRÍTICO: master key para criptografia AES-256-GCM dos PATs
GITHUB_PAT_MASTER_KEY="$(openssl rand -base64 32)"

# URL pública do ZCC (HTTPS obrigatório em produção)
ZCC_PUBLIC_URL="https://zcc.seuzella.com"

# Token para GitHub Action chamar ZCC
ZE_CODE_WEBHOOK_TOKEN="$(openssl rand -hex 32)"

# Secret para validar webhook do GitHub
GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# Cron secret (para endpoints de cron diário)
CRON_SECRET="$(openssl rand -hex 32)"
```

### 2. Aplicar migration do Prisma

```bash
npx prisma migrate deploy
# ou
npx prisma db push
```

### 3. Criar Fine-Grained PAT no GitHub

1. Acesse: https://github.com/settings/personal-access-tokens/new
2. Configure conforme Bíblia (Cap. 3.2):
   - **Token name:** `ze-code-prod-corporate`
   - **Expiration:** 90 days
   - **Repository access:** Only select → SmartHotel_Zehla
   - **Permissions:**
     - Contents: Read and write
     - Pull requests: Read and write
     - Issues: Read and write
     - Workflows: Read-only
     - Metadata: Read-only (obrigatório)
3. Generate → COPIE o token (github_pat_xxx...)

### 4. Cadastrar PAT no Vault

```bash
# Via API:
curl -X POST http://localhost:3000/api/zcc/github/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "label": "ze-code-prod-corporate",
    "authType": "fine_grained_pat",
    "pat": "github_pat_xxx...",
    "scopes": ["contents:write", "pull_requests:write", "issues:write", "workflows:read", "metadata:read"],
    "repositoryAccess": ["MarcioCau14/SmartHotel_Zehla"],
    "expiresAt": "2026-11-19"
  }'

# Ou via UI:
# ZCC → Settings → GitHub Credentials → Adicionar Credencial
```

### 5. Configurar Webhook no GitHub

1. Repo: Settings → Webhooks → Add webhook
2. **Payload URL:** `https://zcc.seuzella.com/api/zcc/github/webhook`
3. **Content type:** `application/json`
4. **Secret:** (mesmo valor de `GITHUB_WEBHOOK_SECRET`)
5. **Events:** Pull requests, Pushes, Check suites, Check runs, Issues
6. Add webhook → verifique "Recent Deliveries" retornou 200

### 6. Configurar GitHub Secrets (para Action de PR Review)

1. Repo: Settings → Secrets and variables → Actions → New repository secret
2. Adicione:
   - `ZE_CODE_API_URL` = `https://zcc.seuzella.com`
   - `ZE_CODE_WEBHOOK_TOKEN` = (mesmo valor do `.env`)

### 7. Testar

```bash
# Abra um PR de teste no repositório
# O workflow ze-code-review.yml deve rodar automaticamente
# Verifique: GitHub → Actions tab
# Verifique: ZCC → Audit Log (deve registrar API_CALL)
```

---

## Estrutura de Arquivos

```
src/lib/github/
  pat-vault.ts              # AES-256-GCM encryption + CRUD + rotation
  github-client.ts          # 30+ métodos para API GitHub
src/lib/cerebro/ze-code/
  apply-via-pr.ts           # Evolve-to-PR pipeline
src/app/api/zcc/github/
  webhook/route.ts          # Listener de webhooks GitHub
  credentials/route.ts      # List/Create credentials
  credentials/[id]/
    rotate/route.ts         # Rotação zero-downtime
    revoke/route.ts         # Revogação emergencial
  credentials/validate/route.ts  # Validar PAT antes de salvar
  credentials/audit/route.ts    # Audit log (com filtros)
  apply-pr/route.ts        # Aplicar suggestion via PR
  expiry-check/route.ts    # Cron diário (checar expiração)
src/components/zcc/panels/
  github-credentials-panel.tsx  # Admin UI
.github/workflows/
  ze-code-review.yml       # CI/CD para PR review
prisma/migrations/
  20260819000001_add_github_gitops_layer/migration.sql
scripts/github/
  migrate-to-corporate.sh  # Mirror de conta corporativa
  mailmap.txt              # Template de mapeamento
```

---

## Segurança

### 20+ locks implementados

- ✅ AES-256-GCM com master key via env var (nunca em DB)
- ✅ IV único por ciphertext (random)
- ✅ Auth tag verificada a cada leitura
- ✅ SHA-256 fingerprint para dedup
- ✅ Reject PAT clássico (ghp_) — apenas Fine-Grained (github_pat_)
- ✅ TTL enforcement (alerta a 14 dias, auto-revoke na expiração)
- ✅ Rotação zero-downtime (cria novo, marca antigo inativo)
- ✅ Revogação emergencial (1 click)
- ✅ Audit log de TODA operação (read, rotate, revoke, api_call)
- ✅ Validação de webhook HMAC SHA-256 (timing-safe comparison)
- ✅ IP allowlist (faixas oficiais do GitHub)
- ✅ Idempotência via X-GitHub-Delivery UUID
- ✅ Rate limit tracking (respeita X-RateLimit-Remaining)
- ✅ Retry com backoff exponencial (429, 502, 503, 504)
- ✅ ETag caching para GETs (reduz consumo de rate limit)
- ✅ Branches sempre dedicadas (feat/ze-code/...) — nunca push em main
- ✅ Commit message prefixado [ze-code-automated]
- ✅ Co-authored-by trailer identifica o bot
- ✅ Limite MAX_OPEN_PRS=3 (evita spam de PRs)
- ✅ Dry-run mode (preview antes de criar PR)
- ✅ GODMODE required para live mode
- ✅ GitHub Action com permissions mínimas (contents:read, pull-requests:write)
- ✅ Skip automático em PRs do próprio ZéCode (evita loop infinito)
- ✅ Timeout de 10 min no workflow (falha graciosa)
- ✅ Diff > 500KB pulado automaticamente

### Em caso de incidente (PAT vazado)

1. **Imediato (<1 min):** Revoke no GitHub → https://github.com/settings/tokens
2. **(<2 min):** ZCC → Settings → GitHub Credentials → Emergency Revoke
3. **(<5 min):** Auditar últimas 24h no Audit Log
4. **(<30 min):** Forense no GitHub → Settings → Security log
5. **(pós):** Criar novo PAT + rotação completa

---

## Doc oficial

Para referência completa, leia:
- `Biblia-do-ZeCode-GitHub-GitOps.pdf` (53 páginas)
- Capítulos 4-9 cobrem implementação detalhada
- Capítulo 10 cobre rotação e resposta a incidentes
- Capítulo 11 tem checklist completo de implantação
- Capítulo 12 tem troubleshooting
