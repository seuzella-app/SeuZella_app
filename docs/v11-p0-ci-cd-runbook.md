# V11-P0 — CI/CD Runbook (Google Antigravity)

This document is the single source of truth for running V11-P0 CI/CD
checks both locally and via GitHub Actions / Google Antigravity.

---

## 1. Workflows Overview

| Workflow                                   | Trigger                                  | Purpose                                              | Duration  |
| ------------------------------------------ | ---------------------------------------- | ---------------------------------------------------- | --------- |
| `ci-v11-p0-security.yml`                   | push + PR + `workflow_dispatch`          | M2M EdDSA auth tests + ZCC shield audit + cron audit | ~10 min   |
| `ci-v11-p0-canaries.yml`                   | push + PR + `workflow_dispatch`          | SQLite + PostgreSQL multi-tenant isolation canaries  | ~15 min   |
| `ci-v11-p0-harness.yml`                    | push + PR + `workflow_dispatch`          | Schema validation + typecheck + DSPy audit + build   | ~25 min   |
| `ci-v11-p0-antigravity.yml`                | `workflow_dispatch` only                 | Orchestrator — all stages, single GO/NO-GO verdict   | ~60 min   |

All four workflows live in `.github/workflows/`.

---

## 2. Local Commands (run inside repo root)

```bash
# Install dependencies
npm ci --legacy-peer-deps

# Generate Prisma client (required before typecheck/tests)
npx prisma generate

# Initialize dev SQLite DB
npx prisma db push --skip-generate

# Validate schema
npx prisma validate

# TypeScript typecheck
npx tsc --noEmit

# Run V11-P0 security tests (M2M auth, 13 cases)
npm run test:v11-security

# Run V11-P0 canaries (multi-tenant isolation, 16 cases)
npm run test:v11-canaries

# Run both V11-P0 suites sequentially
npm run test:v11-all

# Production build smoke test
npm run build
```

---

## 3. Google Antigravity — Step-by-Step

### 3.1 Quick Smoke (3 stages, ~15 min)
Recommended for daily iteration and pre-PR validation.

1. Open the repo on GitHub.
2. Go to **Actions** tab.
3. Select workflow **"V11-P0 — Security Suite"** (`ci-v11-p0-security.yml`).
4. Click **Run workflow** → select branch `main` → **Run workflow**.
5. Wait for the 3 jobs to complete:
   - `m2m-auth-tests` (M2M EdDSA, 13 cases)
   - `zcc-shield-audit` (5 ZCC routes with withSecurity)
   - `cron-route-auth-audit` (3 cron routes with verifyCronM2MToken)
6. All 3 must show ✅.

### 3.2 Canary Check (2 stages, ~15 min)
Validates multi-tenant isolation on SQLite + PostgreSQL.

1. Go to **Actions** → **"V11-P0 — RLS Canaries"**.
2. **Run workflow** → branch `main`.
3. Both `sqlite-canaries` and `postgresql-canaries` must pass.
   - SQLite: 16 cases (6 PolicyAudit, 4 CompiledPrompt, 4 schema, 2 RLS skip).
   - PostgreSQL: same 16 cases, RLS cases execute.

### 3.3 Full Build Verification (~25 min)
Validates Prisma schema + typecheck + DSPy wire + production build.

1. Go to **Actions** → **"V11-P0 — Harness Build & Integration"**.
2. **Run workflow** → branch `main`.
3. Four jobs run sequentially / in parallel:
   - `prisma-schema-validation`
   - `typescript-typecheck`
   - `dspy-loader-audit` (verifies P0.6 wire in `cognitive-router.ts`)
   - `build-smoke-test` (runs `npm run build`)

### 3.4 Full Orchestrator (~60 min, GO/NO-GO verdict)
**Recommended before any production deploy.** Runs all stages and
emits a single verdict.

1. Go to **Actions** → **"V11-P0 — Google Antigravity Orchestrator"**.
2. **Run workflow** → configure inputs:
   - `run_canaries_pg` (default true): uncheck to skip PostgreSQL canaries.
   - `run_build` (default true): uncheck to skip production build.
   - `fail_fast` (default false): check to stop on first failure.
3. Wait for the 6 stages + final `verdict` job.
4. The `verdict` job will print:
   - `VERDICT: GO ✅` if all mandatory + requested optional stages pass.
   - `VERDICT: NO-GO ❌` otherwise (with which stage failed).

---

## 4. Stage → Commit Mapping

| V11-P0 Commit                                    | Stage Validating It                          |
| ------------------------------------------------ | -------------------------------------------- |
| `7c4dea8b` Prisma migration (CompiledPrompt + PolicyAudit) | `prisma-schema-validation` + `sqlite-canaries` |
| `2ec9f962` User Harness docs (CLAUDE.md + AGENTS.md) | (no CI stage — documentation only)            |
| `6f7346c2` M2M EdDSA cron auth + token endpoint  | `m2m-auth-tests` + `cron-route-auth-audit`   |
| `602f5a7a` DSPy CompiledPrompt loader wire       | `dspy-loader-audit`                          |
| `87670316` withSecurity wrap for 5 ZCC routes (analyses, anomalies, refactors, test-alert, stream)    | `zcc-shield-audit`                           |
| `5109efaa` Canary tests (RLS multi-tenant)       | `sqlite-canaries` + `postgres-canaries`      |

---

## 5. CI/CD Commit (this PR)

Adds:
- `.github/workflows/ci-v11-p0-security.yml`
- `.github/workflows/ci-v11-p0-canaries.yml`
- `.github/workflows/ci-v11-p0-harness.yml`
- `.github/workflows/ci-v11-p0-antigravity.yml`
- `package.json` scripts: `test:v11-security`, `test:v11-canaries`, `test:v11-all`
- This document (`docs/v11-p0-ci-cd-runbook.md`)

Cleans up:
- Removes stale tracked file `upload/Relatório Avançado...md` (already gitignored, was committed before rule was added).

---

## 6. Branch Protection Recommendation

After the first successful run, configure GitHub branch protection
on `main`:

1. Settings → Branches → Add rule for `main`.
2. Require status checks:
   - `M2M EdDSA Auth (Cron + Token Issuance)`
   - `ZCC withSecurity Wrapping Audit`
   - `Cron Routes Auth Audit (M2M)`
   - `SQLite (Dev) Multi-Tenant Isolation`
   - `Prisma Schema Validation`
   - `TypeScript Typecheck (Full)`
   - `DSPy CompiledPrompt Loader Wire (P0.6)`
3. Require branches up-to-date before merge.
4. Require 1 review (the user themselves or a designated reviewer).

---

## 7. Secrets & Environment Variables

The workflows use only in-repo-safe defaults (no secrets required):

| Variable              | Value (CI)                                          | Required For                |
| --------------------- | --------------------------------------------------- | --------------------------- |
| `DATABASE_URL`        | `file:./dev.db` (SQLite) or PG service container   | All stages using DB         |
| `DATABASE_PROVIDER`   | `sqlite` or `postgres`                              | Canaries                    |
| `NEXTAUTH_SECRET`     | `ci-v11-*-secret-*` (32+ chars, non-production)    | All stages                  |
| `NODE_ENV`            | `test` (tests) / `production` (build)              | All stages                  |

No GitHub Actions secrets need to be configured for V11-P0 CI.
For production deploys (post-P0), add:
- `M2M_ED25519_PRIVATE_KEY` (PKCS#8 PEM)
- `M2M_ED25519_PUBLIC_KEY` (SPKI PEM)
- `M2M_CLIENT_SECRET_HASH` (SHA-256 hex of the client secret)

---

## 8. What's Next (P0.8+)

- **P0.8** — Add CodeQL workflow (GitHub native SAST) for `src/lib/security/**`.
- **P0.9** — Add dependency-review-action on PRs (blocks vulnerable deps).
- **P1.0** — Wire DSPy prompt optimizer (`scripts/dspy_prompt_optimizer.py`) as a
  scheduled job that populates `CompiledPrompt` weekly.
- **P1.1** — Replace filemode-based dev DB with ephemeral Docker PostgreSQL in CI
  for full RLS coverage on every push.
