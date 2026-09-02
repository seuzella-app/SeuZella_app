# SEU ZÉLLA — AUTHORIZATION MATRIX (Wave R1)

**Date:** 2026-09-02
**Baseline:** fc2d8652 (main)

---

## 1. Authentication vs Authorization

### Authentication (WHO are you?)
- **NextAuth session** — owner/staff login via `/api/auth/[...nextauth]`
- **ZCC admin** — `verifyZCCAccessOrReject` (admin email + role check)
- **Cron/M2M** — `verifyCronAuth` / `verifyCronM2MToken` (machine-to-machine)
- **Webhook HMAC** — provider signature verification (Asaas, MP, WhatsApp, Booking.com)
- **Guest (LGPD)** — no session; identified by `guestPhone` + `tenantId` in body

### Authorization (WHAT can you do?)

| Resource       | Owner (pousadeiro) | Admin (ZCC) | Staff | Guest (hóspede) | System (cron/M2M) |
|----------------|:------------------:|:-----------:|:-----:|:---------------:|:-----------------:|
| Reservas       |        RW          |      R      |  RW   |        R        |        RW         |
| Financeiro     |        R           |     RW      |   R   |        -        |        RW         |
| Cérebro        |        RW          |     RW      |   R   |        -        |        RW         |
| LGPD (own)     |        RW*         |      R      |   -   |       RW**      |         -         |
| Config         |        RW          |     RW      |   R   |        -        |         -         |
| Upsell         |        R           |     RW      |   R   |        -        |        RW         |
| Analytics      |        R           |     RW      |   R   |        -        |         -         |
| Onboarding     |        RW          |     RW      |   -   |        -        |         -         |
| WhatsApp       |        RW          |      R      |  RW   |        W        |        RW         |

\* Owner = pousadeiro manages their own LGPD compliance
\** Guest = exercises own LGPD rights (consent, deletion, export)

---

## 2. Multi-Tenant Isolation

### tenantId derivation rules:
1. **DDC routes** — `tenantId` from `getServerSession(authOptions)` → `(session.user as any).tenantId`
2. **ZCC admin routes** — `tenantId` from `searchParams.get('tenantId')` (admin selects tenant; protected by `verifyZCCAccessOrReject`)
3. **Cron routes** — `tenantId` from `searchParams.get('tenantId')` (system provides; protected by `verifyCronAuth`)
4. **Webhook routes** — `tenantId` derived from webhook payload (HMAC-verified)
5. **LGPD guest routes** — `tenantId` from body (guest identifies which pousada; rate-limited)
6. **Telemetry ingest** — `tenantId` from `requireDDCTenantId()` (session) + cross-checks against body

### NEVER accepted from client:
- `body.tenantId` in DDC routes (must come from session)
- `searchParams.get('tenantId')` in DDC routes (must come from session)
- `headers['x-tenant-id']` as sole auth source (must cross-check with session)

---

## 3. Route Classification (319 total)

| Category | Count | Auth Mechanism | tenantId Source |
|----------|------:|----------------|-----------------|
| DDC tenant-scoped | ~100+ | `getServerSession` / `resolveTenantId` / `requireDDCTenantId` | session |
| ZCC admin | 71 | `verifyZCCAccessOrReject` | searchParams (admin-selected) |
| Cron | 35 | `verifyCronAuth` / `verifyCronSecret` / `verifyCronM2MToken` | searchParams (system-provided) |
| Webhooks | 9 | HMAC signature verification | payload-derived |
| Auth endpoints | 6 | NextAuth | N/A (creating session) |
| Public (intentional) | 3 | rate-limited only | N/A |
| LGPD guest-facing | 4 | `withApiGuard` + rate limit | body (guest-provided) |
| Telemetry | 2 | `verifyZCCAccessOrReject` (query) / `requireDDCTenantId` (ingest) | session / searchParams |

---

## 4. IDOR Fixes Applied (Wave B + R1)

Total: 7 IDOR vulnerabilities fixed:

| # | Route | Was | Now |
|---|-------|-----|-----|
| 1 | GET /api/ddc/guest-registration | `searchParams.get('tenantId')` | `session.user.tenantId` |
| 2 | GET /api/ddc/billing/invoices | `searchParams.get('tenantId')` | `session.user.tenantId` |
| 3 | GET+POST /api/ddc/personality | `searchParams.get('tenantId')` / `body.tenantId` | `session.user.tenantId` |
| 4 | GET+POST /api/ddc/onboarding-wizard | `searchParams.get('tenantId')` / `body.tenantId` | `session.user.tenantId` |
| 5 | GET /api/lgpd/export-my-data | `session.tenantId || searchParams.get('tenantId')` | `session.user.tenantId` only |
| 6 | GET /api/brain/intents | `searchParams.get('tenantId')` (no auth!) | `session.user.tenantId` + auth added |
| 7 | GET /api/brain/health | `searchParams.get('tenantId')` (no auth!) | `session.user.tenantId` + auth added |

---

## 5. Routes That LEGITIMATELY Use searchParams.get('tenantId')

These are NOT IDORs — tenantId is a filter (not auth):

- `zcc/consent` — ZCC admin views tenant's consent records (protected by `verifyZCCAccessOrReject`)
- `zcc/semantica/*` — ZCC admin views tenant's semantic data (protected by `verifyZCCAccessOrReject`)
- `telemetry/query` — ZCC admin queries tenant telemetry (protected by `verifyZCCAccessOrReject`)
- `ddc/partner-program/badge` — Fallback to `requireTenant()` if searchParams absent (protected by `withSecurity`)
- `cron/learning-cycle` — System provides tenantId (protected by `verifyCronAuth`)

---

## 6. Routes That LEGITIMATELY Use body.tenantId

These are NOT IDORs — guest-facing endpoints without session:

- `lgpd/consent` — Guest registers consent for a specific pousada (rate-limited)
- `lgpd/delete-my-data` — Guest requests deletion from a specific pousada (rate-limited)
- `telemetry/ingest` — Cross-checks `body.tenantId` against session-derived `tenantId`
