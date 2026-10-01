#!/usr/bin/env bash
# Seu Zélla — Go-Live Gate (read-only)
# Reports structural readiness and external blockers without reading or printing secret values.
set -Eeuo pipefail

PASS_COUNT=0
BLOCKED_COUNT=0
FAIL_COUNT=0

pass() { printf 'PASS    %s\n' "$1"; PASS_COUNT=$((PASS_COUNT + 1)); }
blocked() { printf 'BLOCKED_EXTERNAL_INFRA    %s\n' "$1"; BLOCKED_COUNT=$((BLOCKED_COUNT + 1)); }
fail() { printf 'FAIL    %s\n' "$1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

printf '%s\n' 'Seu Zélla — Go-Live Gate (read-only)'
printf 'commit=%s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf 'branch=%s\n' "$(git branch --show-current 2>/dev/null || echo unknown)"

for required in package.json prisma/schema.prisma Dockerfile docker-compose.prod.yml scripts/production/preflight-production.sh scripts/production/validate-postgresql-runtime.sh scripts/production/validate-redis-runtime.sh; do
  if [[ -f "$required" ]]; then pass "file:$required"; else fail "missing:$required"; fi
done

if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
  pass 'git_worktree_clean'
else
  fail 'git_worktree_not_clean'
fi

if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
  pass 'DATABASE_URL_present_postgresql_scheme'
else
  blocked 'DATABASE_URL_missing_or_not_postgresql'
fi

if [[ -n "${REDIS_URL:-${REDIS_CONNECTION_STRING:-}}" ]]; then
  pass 'native_redis_url_present'
else
  blocked 'native_redis_url_missing_bullmq_sse_unvalidated'
fi

if [[ -n "${UPSTASH_REDIS_REST_URL:-}" && -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]]; then
  pass 'upstash_rest_pair_present'
else
  blocked 'upstash_rest_pair_missing_serverless_rate_limit_unvalidated'
fi

if [[ -n "${NEXTAUTH_SECRET:-}" && -n "${NEXTAUTH_URL:-}" ]]; then
  pass 'auth_runtime_variables_present'
else
  blocked 'auth_runtime_variables_missing'
fi

if [[ -n "${VPS_HOST:-}" ]]; then
  pass 'VPS_HOST_present'
else
  blocked 'VPS_HOST_missing_deploy_target_not_configured'
fi

printf '\nSUMMARY pass=%s blocked=%s fail=%s\n' "$PASS_COUNT" "$BLOCKED_COUNT" "$FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo 'GO_LIVE_GATE=FAIL'
  exit 2
fi

if [[ "$BLOCKED_COUNT" -gt 0 ]]; then
  echo 'GO_LIVE_GATE=BLOCKED_EXTERNAL_INFRA'
  exit 0
fi

echo 'GO_LIVE_GATE=READY_FOR_RUNTIME_VALIDATION'
