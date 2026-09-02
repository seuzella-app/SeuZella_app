# SEU ZÉLLA — NETWORK POLICY (Wave 15 / F09 / F10-D)

**Status:** TEMPLATE_READY
**Config:** BLOCKED_EXTERNAL (Supervisor must provide real IPs)
**Date:** 2026-09-02

---

## 1. EXECUTIVE SUMMARY

This document maps the network surface of Seu Zélla and provides the production
nginx allowlist template for ZCC simulation/lab routes that don't require
admin authentication because they return synthetic data only.

The allowlist template uses RFC1918 + loopback placeholder IPs. The Supervisor
must replace these with real egress IPs before deploying to production.

---

## 2. NETWORK BOUNDARIES

```
Internet (ports 80, 443)
    │
    ▼
┌─────────────────────────────────────────┐
│ Nginx (host)                            │
│ - TLS termination (Certbot/Let's Encrypt) │
│ - Rate limiting (4 zones: global/auth/  │
│   webhook/api)                          │
│ - ZCC simulation allowlist (F09)        │
│ - Reverse proxy to 127.0.0.1:3000       │
└──────────────────────┬──────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────┐
│ Docker Compose Stack                    │
│  ┌────────────────────────────────────┐ │
│  │ app (Next.js :3000)                │ │
│  │  - 127.0.0.1:3000 only (not public)│ │
│  │  - depends_on: postgres, redis    │ │
│  └─────────┬──────────────┬───────────┘ │
│            │              │             │
│  ┌─────────▼────────┐  ┌──▼──────────┐  │
│  │ postgres:16      │  │ redis:7      │  │
│  │ - internal:true   │  │ - internal:  │  │
│  │ - 127.0.0.1 only │  │   true       │  │
│  │ - pgdata volume   │  │ - requirepass│  │
│  └──────────────────┘  └─────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ worker (BullMQ :workers)           │ │
│  │  - 5 queues (WhatsApp/Payment/Lock │ │
│  │    /Scheduler/DLQ)                 │ │
│  │  - depends_on: redis               │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 3. ENDPOINT CLASSIFICATION

| Category | Count | Auth | Public? |
|---|---|---|---|
| ZCC admin-auth (`verifyZCCAccessOrReject`) | 71 | ZCC admin | ❌ |
| ZCC simulation/lab routes (F09 allowlist target) | 18 | None in dev | ⚠️ (template closes gap) |
| Cron routes (`verifyCronAuth`/`verifyCronSecret`/`verifyCronM2MToken`) | 35 | Cron secret | ❌ |
| Webhook routes (HMAC) | 9 | HMAC signature | ✅ (rate-limited) |
| Session tenant-scoped (`requireTenant`/`getServerSession`) | ~100+ | Session | ❌ |
| Intentional public (F9 documented) | 3 (credits/track-click, notifications/v2, runtime-version) | None | ✅ |
| Anonymous public (health, readiness, landing, vapid) | ~6 | None | ✅ |
| **Total API routes** | **318** | — | — |

---

## 4. ZCC SIMULATION ROUTE ANALYSIS (18 routes)

These routes return synthetic/in-memory data and don't require app-layer admin
auth in dev. The nginx allowlist provides network-level mitigation in production.

| Route | Returns | Risk |
|---|---|---|
| `/api/zcc/national-simulator/*` | Synthetic national pricing | LOW (synthetic data) |
| `/api/zcc/synthetic-brazil/*` | Synthetic Brazilian pousada data | LOW |
| `/api/zcc/simulation-lab/*` | Simulation lab data | LOW |
| `/api/zcc/digital-twin/*` | Digital Twin boot/snapshot (F9 added verifyZCCAccessOrReject) | MEDIUM (POST can boot) |
| `/api/zcc/brain/*` | Brain state | LOW |
| `/api/zcc/cognitive-bus/*` | Cognitive bus state | LOW |
| `/api/zcc/cognitive-memory/*` | Cognitive memory state | LOW |
| `/api/zcc/cortex/*` | Cortex growth/state | LOW |
| `/api/zcc/dspy-compiler/*` | DSPy compiler output | LOW |
| `/api/zcc/personas/*` | Synthetic personas | LOW |
| `/api/zcc/zgs/decisions/*` | ZGS decision log | LOW |
| `/api/zcc/leads/brain-analyze/*` | Lead brain analysis | MEDIUM (3 LLM routes cost) |
| `/api/zcc/infra/scaling-ruler/*` | Scaling ruler | LOW |
| `/api/zcc/adapters/*` | Adapter mode map | LOW |
| `/api/zcc/github/expiry-check/*` | GitHub expiry check | LOW (cron-conditional) |

---

## 5. ALLOWLIST TEMPLATE

File: `nginx/zcc-simulation-allowlist.conf.template`

Structure:
- 15 `location` blocks targeting ZCC simulation routes
- 4 placeholder IPs per block (RFC1918 + loopback):
  - `allow 10.0.0.0/8;`
  - `allow 172.16.0.0/12;`
  - `allow 192.168.0.0/16;`
  - `allow 127.0.0.1/32;`
- `deny all;` default-deny catch-all
- `proxy_pass http://seuzella_app;` upstream
- `limit_req zone=api burst=20 nodelay;` rate limit (5 r/s)
- `limit_req_status 429;`

**EXPLICITLY EXCLUDED** (NOT in allowlist):
- `/api/zcc/observability` — has verifyZCCAccessOrReject
- `/api/zcc/infrastructure` — has verifyZCCAccessOrReject
- `/api/zcc/cerebro/stream` — has withSecurity({ auth: 'zcc-admin' })
- `/api/zcc/cerebro/ml-stats` — has getServerSession
- `/api/zcc/partner-program/reopen` — has isZccAdmin (F5)
- `/api/zcc/health` — returns only booleans (no PII), kept reachable
- `/api/zcc/airbnb/webhook` — has verifyZCCAccessOrReject

---

## 6. IMPLEMENTATION STATUS

```
TEMPLATE_READY        = TRUE  (nginx/zcc-simulation-allowlist.conf.template)
NOT_DEPLOYED          = TRUE  (blocked by external input)
CONFIG_BLOCKED        = TRUE  (Supervisor must provide real egress IPs)
include_directive     = operator step (NOT yet performed)
nginx -t validation   = BLOCKED (no nginx in sandbox)
```

---

## 7. RECOMMENDED POLICY

1. Deploy F09 allowlist template with Supervisor-provided IPs (BLOCKED)
2. Add `include /etc/nginx/snippets/zcc-simulation-allowlist.conf;` to
   `nginx/seuzella.conf` HTTPS server block (DOCUMENTED in template header;
   NOT yet executed — would modify existing nginx config)
3. Run `nginx -t && systemctl reload nginx` post-include
4. Verify reachability matrix (authorized=200, non-authorized=403)
5. Quarterly IP rotation review (NEW)
6. Monitor HTTP 403 spikes on ZCC simulation routes (NEW)

---

## 8. BLOCKED ITEMS

- **BLK-F09-1**: Supervisor-provided egress IPs — template uses RFC1918 placeholders
- **BLK-F09-2**: nginx `include` directive addition to `nginx/seuzella.conf` — operator step
- **BLK-F09-3**: `nginx -t` runtime validation — requires real nginx binary

---

## 9. CROSS-REFERENCES

- `nginx/seuzella.conf` — existing Nginx config (rate limiting, TLS redirect)
- `nginx/zcc-simulation-allowlist.conf.template` (F09) — NEW allowlist template
- `docs/STAGING_INFRASTRUCTURE_PLAN.md` (F10) — VPS provisioning plan
- `docs/RECOVERY_PROCEDURE.md` (F10-C) — backup/restore procedure
- `docs/OBSERVABILITY_STATUS.md` (F10-E) — observability map
