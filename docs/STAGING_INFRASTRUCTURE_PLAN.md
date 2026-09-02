# SEU ZÉLLA — STAGING INFRASTRUCTURE PLAN (Wave 15 / F10 / F10-F)

**Status:** CODE_READY
**Runtime:** BLOCKED_BY_EXTERNAL_INFRA (VPS Hostinger MVK4 not provisioned)
**Date:** 2026-09-02
**Baseline HEAD:** a410845a (main, after Wave 13/14 merge)

---

## 1. EXECUTIVE SUMMARY

This document specifies the complete staging infrastructure plan for Seu Zélla
VPS deployment. It is **CODE_READY** — all configuration templates, scripts,
and validation runners exist in the repository. It is **NOT RUNTIME_VALIDATED**
— no real VPS, PostgreSQL, or Redis has been provisioned.

The plan reduces the distance between CODE_READY and RUNTIME_VALIDATED by
preparing every operator-actionable step in advance. When the Supervisor
provides VPS credentials, this document + companion scripts will execute
end-to-end without ambiguity.

---

## 2. INFRASTRUCTURE REQUIREMENTS

### 2.1 VPS Hostinger MVK4

| Requirement | Specification |
|---|---|
| Provider | Hostinger VPS MVK4 (or equivalent KVM VPS) |
| OS | Ubuntu 22.04 LTS (Jammy) or 24.04 LTS |
| vCPU | 4 vCPU minimum (8 recommended for staging) |
| RAM | 8 GB minimum (16 GB recommended) |
| Storage | 100 GB SSD minimum (200 GB recommended for backups + DB) |
| Bandwidth | 4 TB/month minimum |
| Public IP | Static, fixed |
| Region | Brazil (São Paulo or equivalent for LGPD compliance) |

### 2.2 DNS Records Required

| Record | Type | Value | Purpose |
|---|---|---|---|
| `seuzella.com` | A | `<VPS_PUBLIC_IP>` | Primary domain |
| `www.seuzella.com` | CNAME | `seuzella.com` | WWW redirect |
| `app.seuzella.com` | A | `<VPS_PUBLIC_IP>` | API endpoint (optional, can be path-based) |
| `zcc.seuzella.com` | A | `<VPS_PUBLIC_IP>` | ZCC admin panel (optional, can be path-based) |

**Action required:** Supervisor configures DNS at Hostinger/Cloudflare BEFORE
running staging-bootstrap.sh.template.

### 2.3 System Packages

```bash
# Required packages (installed by staging-bootstrap.sh.template)
- docker.io (or docker-ce)
- docker-compose-plugin (or docker-compose)
- nginx
- certbot (or python3-certbot-nginx)
- ufw
- fail2ban
- ntp (or chrony)
- unattended-upgrades
- auditd
- jq
- curl
- gnupg
- ca-certificates
```

### 2.4 System Users

| User | Shell | Sudo | Docker Group | Purpose |
|---|---|---|---|---|
| `root` | /bin/bash | YES | YES | Initial bootstrap only |
| `deploy` | /bin/bash | YES (NOPASSWD) | YES | Deployments + git pull + docker compose |
| `runtime` | /usr/sbin/nologin | NO | YES | Container runtime only (no SSH) |
| `zehla` | /bin/bash | NO | YES | SSH deploy (used by GitHub Actions) |

---

## 3. SECRET MATRIX

**CRITICAL:** All values below are PLACEHOLDERS. The Supervisor must provision
real values via GitHub Secrets + VPS environment files. The repository must
NEVER contain real secrets.

| Secret | Origin | Required? | Consumer | Risk if Leaked |
|---|---|---|---|---|
| `VPS_HOST` | VPS public IP (Supervisor provides) | ✅ YES | deploy.yml | SSH target exposed |
| `VPS_SSH_PRIVATE_KEY` | Generate via ssh-keygen | ✅ YES | deploy.yml | Full VPS compromise |
| `DB_USER` | `zehla` (or supervisor-chosen) | ✅ YES | docker-compose, backup scripts | DB access |
| `DB_PASS` | Generate via openssl rand -base64 32 | ✅ YES | docker-compose, backup scripts | DB compromise |
| `DB_NAME` | `zehla_production` (or staging suffix) | ✅ YES | docker-compose | DB name exposure |
| `REDIS_PASSWORD` | Generate via openssl rand -base64 32 | ✅ YES | docker-compose, bullmq-queue.ts | Redis compromise |
| `ZELLA_ENCRYPTION_KEY` | Generate via openssl rand -base64 32 | ✅ YES | secret-vault.ts | Secret vault compromise |
| `ENCRYPTION_SECRET` | Generate via openssl rand -base64 32 | ✅ YES | encryption.ts | AES-256-GCM key compromise |
| `NEXTAUTH_SECRET` | Generate via openssl rand -base64 32 | ✅ YES | NextAuth | Session forgery |
| `NEXTAUTH_URL` | `https://seuzella.com` | ✅ YES | NextAuth | Auth redirect |
| `META_APP_SECRET` | Meta Developer Platform | ✅ YES (WhatsApp) | webhook-verify.ts | Webhook forgery |
| `META_ACCESS_TOKEN` | Meta Developer Platform | ✅ YES (WhatsApp) | whatsapp-send.ts | WhatsApp impersonation |
| `META_PHONE_NUMBER_ID` | Meta Developer Platform | ✅ YES (WhatsApp) | whatsapp-send.ts | Phone ID exposure |
| `META_WABA_ID` | Meta Developer Platform | ✅ YES (WhatsApp) | WhatsApp Business API | WABA exposure |
| `ASAAS_ACCESS_TOKEN` | Asaas dashboard | ✅ YES (billing) | asaas.ts | Payment fraud |
| `ASAAS_WEBHOOK_SECRET` | Asaas dashboard | ✅ YES (billing) | webhooks/asaas/route.ts | Webhook forgery |
| `MP_ACCESS_TOKEN` | Mercado Pago dashboard | ✅ YES (alt billing) | mercadopago-service.ts | Payment fraud |
| `MP_WEBHOOK_SECRET` | Mercado Pago dashboard | ✅ YES (alt billing) | webhooks/mercadopago/route.ts | Webhook forgery |
| `BOOKING_COM_WEBHOOK_SECRET` | Generate via openssl rand -hex 32 | ✅ YES (Booking.com) | webhooks/booking-com/reviews/route.ts | Webhook forgery |
| `ZELLA_M2M_ED25519_PRIVATE_KEY` | Generate via openssl genpkey -algorithm ed25519 | ✅ YES (crons) | cron-auth.ts | Cron impersonation |
| `ZELLA_M2M_ED25519_PUBLIC_KEY` | Extract from private key | ✅ YES (crons) | cron-auth-unified.ts | Cron verification bypass |
| `ZELLA_M2M_ADMIN_CLIENT_ID` | `zella-admin` | ✅ YES (crons) | m2m-policy.ts | Admin client ID exposure |
| `ZELLA_M2M_AUDIENCE` | `https://seuzella.com` | ✅ YES (crons) | cron-auth.ts | JWT audience mismatch |
| `ZELLA_M2M_ISSUER` | `https://seuzella.com` | ✅ YES (crons) | cron-auth.ts | JWT issuer mismatch |
| `SENTRY_DSN` | Sentry project dashboard | 🟡 OPTIONAL | error-tracking.ts | Sentry data exposure |
| `OFFSITE_BUCKET` | S3/B2 bucket name | 🟡 OPTIONAL | offsite-sync.sh | Backup data exposure |
| `OFFSITE_ACCESS_KEY_ID` | S3/B2 IAM credentials | 🟡 OPTIONAL | offsite-sync.sh | Backup write access |
| `OFFSITE_SECRET_ACCESS_KEY` | S3/B2 IAM credentials | 🟡 OPTIONAL | offsite-sync.sh | Backup compromise |
| `OFFSITE_ENDPOINT` | S3/B2 endpoint URL | 🟡 OPTIONAL | offsite-sync.sh | Endpoint exposure |

**Total required secrets:** 24 (mandatory) + 5 (optional) = 29 secrets

---

## 4. DOCKER COMPOSE STACK

The existing `docker-compose.prod.yml` already defines:
- `app` (Next.js standalone)
- `postgres` (postgres:16-alpine)
- `redis` (redis:7-alpine)

**Required additions for staging (NOT yet in compose file):**
- `worker` (separate container running `npm run workers:start`)
- `nginx` (reverse proxy)

**Action required:** Supervisor decides whether to:
- (a) Add `worker` and `nginx` as compose services (single-stack), OR
- (b) Run `nginx` on host (more common for production, allows Certbot)

**Recommendation:** Option (b) — Nginx on host, Worker in compose.

---

## 5. NETWORK ARCHITECTURE

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

### 5.1 UFW Firewall Rules

```bash
# Default deny incoming
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (rate-limited)
ufw limit 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# NEVER allow:
# - 5432/tcp (PostgreSQL — internal only)
# - 6379/tcp (Redis — internal only)
# - 3000/tcp (app — internal only, proxied by Nginx)

ufw enable
```

### 5.2 fail2ban Configuration

```ini
# /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
```

---

## 6. SSH HARDENING

```bash
# /etc/ssh/sshd_config (key changes)
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers zehla deploy
Port 22  # (or custom port — Supervisor decision)
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
```

**Action required:** Supervisor generates SSH key pair, adds public key to
`~/.ssh/authorized_keys` for `zehla` user, configures private key as GitHub
Secret `VPS_SSH_PRIVATE_KEY`.

---

## 7. SYSTEM TUNING

### 7.1 Swap (if RAM < 16GB)

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p
```

### 7.2 NTP / Timezone

```bash
timedatectl set-timezone America/Sao_Paulo
timedatectl set-ntp true
```

### 7.3 journald

```bash
# /etc/systemd/journald.conf
SystemMaxUse=2G
SystemKeepFree=4G
MaxFileSec=1month
```

---

## 8. PROVISIONING SEQUENCE

**Strictly ordered — each step depends on the previous:**

```
1. [OPERATOR] Purchase VPS Hostinger MVK4
   ↓
2. [OPERATOR] Configure DNS (A records → VPS IP)
   ↓
3. [OPERATOR] SSH into VPS as root
   ↓
4. [OPERATOR] Run staging-bootstrap.sh.template (replace placeholders first)
   ↓
5. [OPERATOR] Generate all secrets (openssl rand, ssh-keygen, ed25519)
   ↓
6. [OPERATOR] Configure GitHub Secrets (28 secrets)
   ↓
7. [OPERATOR] Create /opt/zehla/.env.production with real values
   ↓
8. [OPERATOR] git clone repo to /opt/zehla
   ↓
9. [OPERATOR] docker compose -f docker-compose.prod.yml build
   ↓
10. [OPERATOR] docker compose -f docker-compose.prod.yml up -d postgres redis
    ↓
11. [OPERATOR] bash scripts/production/backup-pre-migration.sh
    ↓
12. [OPERATOR] docker compose exec app npx prisma migrate deploy
    ↓
13. [OPERATOR] docker compose -f docker-compose.prod.yml up -d app worker
    ↓
14. [OPERATOR] Configure Nginx + Certbot (TLS via Let's Encrypt)
    ↓
15. [OPERATOR] bash scripts/production/smoke-post-release.sh http://localhost:3000
    ↓
16. [OPERATOR] Verify https://seuzella.com/api/health returns 200
    ↓
17. [OPERATOR] Verify https://seuzella.com/api/readiness returns 200
    ↓
18. [GLM] Execute validate-postgresql-runtime.sh (F05 / F10-G)
    ↓
19. [GLM] Execute validate-redis-runtime.sh (F06 / F10-H)
    ↓
20. [GLM] Cross-audit + consolidated report
```

---

## 9. VALIDATION CRITERIA

| Criterion | Expected | How to Verify |
|---|---|---|
| VPS accessible via SSH | SSH login succeeds | `ssh zehla@<VPS_IP>` |
| Docker installed | `docker --version` returns v24+ | `docker --version` |
| Compose installed | `docker compose version` returns v2+ | `docker compose version` |
| PostgreSQL healthy | `pg_isready` returns "accepting connections" | `docker compose exec postgres pg_isready` |
| Redis healthy | `redis-cli ping` returns PONG | `docker compose exec redis redis-cli ping` |
| App healthy | `/api/health` returns 200 | `curl http://localhost:3000/api/health` |
| App ready | `/api/readiness` returns 200 | `curl http://localhost:3000/api/readiness` |
| TLS valid | `https://seuzella.com` loads with valid cert | Browser inspection |
| UFW active | `ufw status` shows "Status: active" | `ufw status` |
| fail2ban active | `fail2ban-client status` shows sshd jail | `fail2ban-client status` |
| Worker running | `docker compose logs worker` shows "5 workers registered" | `docker compose logs worker` |
| Backup artifact exists | `/opt/backups/pre-migration/` contains `.sql.gz` file | `ls -la /opt/backups/pre-migration/` |

---

## 10. ROLLBACK PROCEDURE

If staging bootstrap fails at any step:

1. **Stop** — do NOT continue
2. **Capture** — save logs from failed step
3. **Rollback app** (if needed): `git reset --hard <PREV_COMMIT>` + rebuild
4. **NEVER rollback database** — migrations are irreversible; use restore-drill.sh against backup artifact if data corruption detected
5. **Document** — record the failure point + evidence
6. **Report** — escalate to Supervisor before retrying

---

## 11. CROSS-REFERENCES

- `docker-compose.prod.yml` — existing stack definition
- `nginx/seuzella.conf` — existing Nginx config (rate limiting, TLS redirect)
- `nginx/zcc-simulation-allowlist.conf.template` (F09) — ZCC route restrictions
- `.github/workflows/deploy.yml` (F10-B) — hardened deploy pipeline
- `scripts/production/backup-pre-migration.sh` (F04) — pre-migration backup
- `scripts/production/smoke-post-release.sh` (F04) — post-release smoke
- `scripts/production/restore-drill.sh` (F10-C) — restore drill
- `scripts/production/offsite-sync.sh` (F10-C) — offsite sync
- `scripts/production/validate-postgresql-runtime.sh` (F05) — PostgreSQL validation
- `scripts/production/validate-redis-runtime.sh` (F06) — Redis validation
- `scripts/production/vps-preflight.sh` (Wave 14) — VPS preflight check
- `scripts/production/release-preflight.sh` (Wave 14) — release preflight
- `scripts/production/backup-verify.sh` (Wave 14) — backup integrity verifier
- `scripts/production/smoke-release.sh` (Wave 14) — release smoke
- `docs/RECOVERY_PROCEDURE.md` (F10-C) — recovery procedure
- `docs/NETWORK_POLICY.md` (F09) — network map
- `docs/OBSERVABILITY_STATUS.md` (F10-E) — observability map (pending recreation)
- `docs/GO-LIVE-CHECKLIST-MVK4.md` — existing Go-Live checklist
- `docs/production/GO-LIVE-RUNBOOK.md` — existing Go-Live runbook
