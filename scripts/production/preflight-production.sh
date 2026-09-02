#!/usr/bin/env bash
set -Eeuo pipefail

# Production preflight is intentionally read-only. It never writes .env,
# mutates firewall rules, runs migrations, or starts services.
failures=0
warn() { printf 'PREFLIGHT_WARN %s\n' "$*"; }
fail() { printf 'PREFLIGHT_FAIL %s\n' "$*" >&2; failures=$((failures + 1)); }
ok() { printf 'PREFLIGHT_OK %s\n' "$*"; }

require_cmd() { command -v "$1" >/dev/null 2>&1 && ok "command=$1" || fail "missing_command=$1"; }

for cmd in node npm git curl; do require_cmd "$cmd"; done
require_cmd psql || warn 'psql_missing (required for physical PostgreSQL validation)'
require_cmd redis-cli || warn 'redis-cli_missing (required for physical Redis validation)'

if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$node_major" == "20" ]] && ok "node_major=$node_major" || fail "node_major=$node_major expected=20"
fi

if [[ "$(id -u)" == '0' ]]; then
  warn 'running_as_root; deployment should use a dedicated deploy user'
else
  ok "runtime_user=$(id -un)"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  if [[ "$DATABASE_URL" == *'localhost'* || "$DATABASE_URL" == *'127.0.0.1'* || "$DATABASE_URL" == *'postgres'* ]]; then
    ok 'DATABASE_URL_present_without_remote_host_assertion'
  else
    warn 'DATABASE_URL_present_remote_host_must_be_reviewed_manually'
  fi
else
  fail 'DATABASE_URL_missing'
fi

for name in NEXTAUTH_SECRET ENCRYPTION_SECRET; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then fail "$name=missing"; elif (( ${#value} < 32 )); then fail "$name=too_short"; else ok "$name=present_length=${#value}"; fi
done

for name in ZEHLA_MASTER_ADMIN_PASSWORD; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then fail "$name=missing"; elif (( ${#value} < 12 )); then fail "$name=too_short"; else ok "$name=present"; fi
done

if [[ -n "${REDIS_URL:-}" ]]; then ok 'REDIS_URL=present'; else warn 'REDIS_URL=missing (BullMQ/multi-instance runtime unavailable)'; fi
if [[ -n "${APP_URL:-}" ]]; then ok "APP_URL=$APP_URL"; else warn 'APP_URL=missing'; fi

if [[ -f .env && -z "${ALLOW_DOTENV_FILE_IN_PREFLIGHT:-}" ]]; then
  fail '.env_exists_in_worktree (refuse to inspect or print contents)'
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git branch --show-current)"
  head="$(git rev-parse HEAD)"
  ok "git_branch=$branch"
  ok "git_head=$head"
  if [[ -n "$(git status --porcelain)" ]]; then warn 'git_worktree_dirty'; else ok 'git_worktree_clean'; fi
fi

if (( failures > 0 )); then
  printf 'PREFLIGHT_RESULT=FAIL failures=%d\n' "$failures" >&2
  exit 1
fi
printf 'PREFLIGHT_RESULT=PASS\n'
