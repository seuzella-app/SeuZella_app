#!/usr/bin/env bash
set -Eeuo pipefail

# Seu Zélla production preflight — READ ONLY.
# Validates the host contract from MASTER_DEPLOYMENT_PLAN without mutating
# the host, database, git state, or deployment state.

fail=0
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS %-28s\n' "$name"
  else
    printf 'FAIL %-28s\n' "$name"
    fail=1
  fi
}

printf '%s\n' 'SEU ZÉLLA VPS PREFLIGHT (READ ONLY)'
printf 'timestamp=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check 'node>=20' bash -c 'command -v node && test "$(node -p "parseInt(process.versions.node.split(\".\")[0],10)")" -ge 20'
check 'npm available' command -v npm
check 'postgres client' command -v psql
check 'pg_dump available' command -v pg_dump
check 'curl available' command -v curl
check 'openssl available' command -v openssl
check 'ufw available' command -v ufw
check 'systemctl available' command -v systemctl

if [[ -n "${DATABASE_URL:-}" ]]; then
  printf 'PASS %-28s\n' 'DATABASE_URL present'
  if [[ "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
    printf 'PASS %-28s\n' 'DATABASE_URL postgres scheme'
  else
    printf 'FAIL %-28s\n' 'DATABASE_URL postgres scheme'
    fail=1
  fi
else
  printf 'WARN %-28s\n' 'DATABASE_URL absent (runtime)'
fi

for secret in NEXTAUTH_SECRET ENCRYPTION_SECRET ZEHLA_MASTER_ADMIN_PASSWORD; do
  value="${!secret:-}"
  if [[ -n "$value" && ${#value} -ge 32 ]]; then
    printf 'PASS %-28s present_length=%d\n' "$secret" "${#value}"
  else
    printf 'FAIL %-28s missing_or_short\n' "$secret"
    fail=1
  fi
done

if command -v ufw >/dev/null 2>&1; then
  status="$(ufw status 2>/dev/null | head -n 1 || true)"
  printf 'INFO %-28s %s\n' 'ufw' "${status:-unavailable}"
fi

if (( fail != 0 )); then
  printf '%s\n' 'PREFLIGHT=FAIL'
  exit 1
fi
printf '%s\n' 'PREFLIGHT=PASS'
