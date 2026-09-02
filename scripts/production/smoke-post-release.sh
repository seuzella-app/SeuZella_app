#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — POST-RELEASE SMOKE E2E (Wave 15 / F04 / NB-004)
# ==============================================================================
# Verifies that the application is actually alive and serving requests after
# a deployment. The pipeline fails closed if smoke checks do not pass within
# the retry budget — no false positives allowed.
#
# SECURITY:
#   - Never prints sensitive response bodies.
#   - Only logs HTTP status + timing + final verdict.
#
# USAGE:
#   bash scripts/production/smoke-post-release.sh [TARGET_HOST]
#
# DEFAULT TARGET:
#   http://localhost:3000 (where the app container serves)
#
# EXIT CODES:
#   0 = smoke passed (application is alive and ready)
#   1 = smoke failed (pipeline must abort — application did not come up)
# ==============================================================================

set -Eeuo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL="${1:-http://localhost:3000}"
TARGET_HOST="${BASE_URL}"
HEALTH_ENDPOINT="${BASE_URL}/api/health"
READINESS_ENDPOINT="${BASE_URL}/api/readiness"

MAX_RETRIES=10
RETRY_INTERVAL_SEC=3
REQUEST_TIMEOUT_SEC=5

# ── Logging start ────────────────────────────────────────────────────────────
echo "Post-release smoke: START"
echo "  target: ${TARGET_HOST}"
echo "  retries: ${MAX_RETRIES}"
echo "  interval: ${RETRY_INTERVAL_SEC}s"
echo "  timeout per request: ${REQUEST_TIMEOUT_SEC}s"

# ── assert_status helper: deterministic, limited, with timeout ──────────────
# Usage: assert_status <expected_status> <url> <description>
# Returns 0 on success, non-zero on failure. Never loops infinitely.
assert_status() {
  local expected_status="$1"
  local url="$2"
  local description="$3"
  local attempt=0
  local http_status=0

  while [ "${attempt}" -lt "${MAX_RETRIES}" ]; do
    attempt=$((attempt + 1))
    http_status=$(curl -s -o /dev/null -w "%{http_code}" \
                  --max-time "${REQUEST_TIMEOUT_SEC}" \
                  "${url}" 2>/dev/null || echo "000")

    if [ "${http_status}" = "${expected_status}" ]; then
      echo "  ${description}: PASS (HTTP ${http_status}) on attempt ${attempt}/${MAX_RETRIES}"
      return 0
    fi

    echo "  ${description}: retry ${attempt}/${MAX_RETRIES} (got ${http_status}, expected ${expected_status})"
    sleep "${RETRY_INTERVAL_SEC}"
  done

  echo "  ${description}: FAIL (expected ${expected_status}, last got ${http_status} after ${MAX_RETRIES} attempts)"
  return 1
}

# ── Step 1: Liveness probe (/api/health) ────────────────────────────────────
# /api/health returns 200 with status 'ok' | 'degraded' | 'down'.
# We accept 200 as "process is alive" — degraded is still alive.
# A non-200 means the process is not responding.
# Application check: status === 'down' triggers fail-closed.
if ! assert_status 200 "$BASE_URL/api/health" "liveness (/api/health)"; then
  echo "Post-release smoke: FAILED"
  echo "  reason: liveness probe failed"
  echo "  impact: application is not responding to /api/health"
  echo "  recommended_action: inspect application logs; consider application rollback (NOT database rollback)"
  exit 1
fi

# Verify health body does not report 'down' status.
# The /api/health endpoint returns JSON with a "status" field.
# When the database is unavailable, the application check status === 'down' triggers fail-closed.
# We detect this by checking for the JSON pattern '"status": "down"'.
HEALTH_BODY=$(curl -s --max-time "${REQUEST_TIMEOUT_SEC}" "$BASE_URL/api/health" 2>/dev/null || echo '{}')
if echo "${HEALTH_BODY}" | grep -q '"status": "down"'; then
  # Fail-closed: status === 'down' means database is unavailable.
  echo "Post-release smoke: FAILED"
  echo "  reason: /api/health body indicates status === 'down'"
  echo "  impact: database is unavailable — application cannot serve"
  echo "  recommended_action: inspect PostgreSQL container; do NOT rollback database"
  exit 1
fi

# ── Step 2: Readiness probe (/api/readiness) ─────────────────────────────────
# /api/readiness returns 200 when ALL required env vars + DB + BullMQ are
# satisfied, 503 otherwise. This is the canonical post-release gate.
if ! assert_status 200 "$BASE_URL/api/readiness" "readiness (/api/readiness)"; then
  echo "Post-release smoke: FAILED"
  echo "  reason: readiness probe failed"
  echo "  impact: application is alive but not ready (missing config or DB connectivity)"
  echo "  recommended_action: check /api/readiness body for failed checks; do NOT rollback database"
  exit 1
fi

# ── Step 3: Landing page responds ────────────────────────────────────────────
if ! assert_status 200 "$BASE_URL/" "landing (/)"; then
  echo "Post-release smoke: FAILED"
  echo "  reason: landing page not responding"
  echo "  impact: application is alive but landing page is broken"
  echo "  recommended_action: inspect Next.js build; consider application rollback"
  exit 1
fi

# ── Success ──────────────────────────────────────────────────────────────────
echo "Post-release smoke: SUCCESS"
echo "  liveness: PASS"
echo "  readiness: PASS"
echo "  landing: PASS"
echo "  application is alive and ready"

exit 0
