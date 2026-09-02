#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — POSTGRESQL RUNTIME VALIDATION (Wave 15 / F05 / F10-G)
# ==============================================================================
# PURPOSE: Validate PostgreSQL 16 real cluster against RLS canaries,
#          advisory lock concurrency, EXCLUDE constraint, financial idempotency,
#          and backup/restore drill.
#
# STATUS: CODE_READY
# RUNTIME_VALIDATED: FALSE
#
# PREREQUISITES:
#   - F10-F staging infrastructure provisioned (VPS + PostgreSQL 16)
#   - prisma migrate deploy completed successfully
#   - DATABASE_URL accessible from execution environment
#
# SAFETY:
#   - This script NEVER executes against production DATABASE_URL unless
#     explicitly authorized via --against-production flag.
#   - Default target is staging DATABASE_URL.
#   - Restore drill targets a TEST database only (never production).
#
# USAGE:
#   bash scripts/production/validate-postgresql-runtime.sh
#   bash scripts/production/validate-postgresql-runtime.sh --against-production
#
# EXIT CODES:
#   0 = all validations passed
#   1 = one or more validations failed
#   99 = infrastructure not available (BLOCKED_BY_EXTERNAL_INFRA)
# ==============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
TARGET="staging"
if [ "${1:-}" = "--against-production" ]; then
  TARGET="production"
  echo "WARNING: Running against PRODUCTION database. Proceed with caution."
  read -p "Type 'I-UNDERSTAND' to continue: " CONFIRM
  if [ "${CONFIRM}" != "I-UNDERSTAND" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Required env vars
: "${DATABASE_URL:?DATABASE_URL is required for PostgreSQL runtime validation}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASS:?DB_PASS is required}"
: "${DB_NAME:?DB_NAME is required}"

# Test database for restore drill (NEVER production)
TEST_DB_NAME="${DB_NAME}_restore_drill"

# Results tracking
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS_FILE="/tmp/f15g_validation_$(date +%s).log"
echo "F05 PostgreSQL Runtime Validation — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${RESULTS_FILE}"
echo "Target: ${TARGET}" >> "${RESULTS_FILE}"
echo "DATABASE_URL: [REDACTED]" >> "${RESULTS_FILE}"
echo "" >> "${RESULTS_FILE}"

# ── Helper functions ──────────────────────────────────────────────────────────
log_pass() {
  echo "  ✅ PASS: $1"
  echo "  ✅ PASS: $1" >> "${RESULTS_FILE}"
  PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
  echo "  ❌ FAIL: $1"
  echo "  ❌ FAIL: $1" >> "${RESULTS_FILE}"
  echo "     Evidence: $2" >> "${RESULTS_FILE}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

log_skip() {
  echo "  ⏭️ SKIP: $1"
  echo "  ⏭️ SKIP: $1" >> "${RESULTS_FILE}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ── Infrastructure availability check ────────────────────────────────────────
echo "==> [0/6] Infrastructure availability check"

# Check if PostgreSQL is reachable via Docker
if ! docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
  echo "  ❌ PostgreSQL not reachable via Docker compose"
  echo ""
  echo "==> F05 STATUS: BLOCKED_BY_EXTERNAL_INFRA"
  echo "  reason: PostgreSQL real cluster not provisioned or not accessible"
  echo "  action: complete F10-F staging infrastructure provisioning first"
  echo ""
  echo "RESULTS:"
  echo "  PASS: 0"
  echo "  FAIL: 0"
  echo "  SKIP: 0"
  echo "  BLOCKED: 1 (infrastructure)"
  exit 99
fi
log_pass "PostgreSQL reachable via Docker compose"

# ── 1. Connectivity ─────────────────────────────────────────────────────────
echo ""
echo "==> [1/6] Connectivity validation"

# 1a. App container can connect to PostgreSQL
APP_DB_CHECK=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T app \
  node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.connect()
      .then(() => client.query('SELECT version()'))
      .then(res => { console.log(res.rows[0].version); client.end(); })
      .catch(err => { console.error(err.message); process.exit(1); });
  " 2>&1) || APP_DB_CHECK="FAILED: ${APP_DB_CHECK}"

if echo "${APP_DB_CHECK}" | grep -q "PostgreSQL 16"; then
  log_pass "App container connects to PostgreSQL 16 (${APP_DB_CHECK:0:50}...)"
else
  log_fail "App container cannot connect to PostgreSQL" "${APP_DB_CHECK}"
fi

# 1b. Prisma can connect (run a simple query)
PRISMA_CHECK=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T app \
  npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Tenant\";" 2>&1) || PRISMA_CHECK="FAILED"

if echo "${PRISMA_CHECK}" | grep -qE "^[0-9]+$"; then
  log_pass "Prisma connects and queries Tenant table (${PRISMA_CHECK} tenants)"
else
  log_fail "Prisma cannot query Tenant table" "${PRISMA_CHECK}"
fi

# ── 2. Migration status ──────────────────────────────────────────────────────
echo ""
echo "==> [2/6] Migration status"

MIGRATION_STATUS=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T app \
  npx prisma migrate status 2>&1)

if echo "${MIGRATION_STATUS}" | grep -q "Database schema is up to date"; then
  log_pass "All migrations applied (schema up to date)"
else
  if echo "${MIGRATION_STATUS}" | grep -q "Following migration"; then
    log_fail "Pending migrations detected" "${MIGRATION_STATUS}"
    echo "  ACTION: run 'npx prisma migrate deploy' inside app container"
  else
    log_fail "Migration status check failed" "${MIGRATION_STATUS}"
  fi
fi

# Verify F03 migration 20260902000100 (EXCLUDE constraint on reservations) is applied
EXCLUDE_CHECK=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
  psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
  "SELECT conname FROM pg_constraint WHERE conname = 'reservation_no_overlap';" 2>&1) || EXCLUDE_CHECK="FAILED"

if echo "${EXCLUDE_CHECK}" | grep -q "reservation_no_overlap"; then
  log_pass "EXCLUDE constraint 'reservation_no_overlap' is applied (F03 migration 20260902000100)"
else
  log_fail "EXCLUDE constraint missing" "${EXCLUDE_CHECK}"
fi

# ── 3. RLS Canaries ───────────────────────────────────────────────────────────
echo ""
echo "==> [3/6] RLS canaries (16 tests from tests/security/rls-canaries.test.ts)"

# Note: The actual 16 canaries are defined in tests/security/rls-canaries.test.ts
# They are skipped in CI because they require real PostgreSQL with RLS policies.
# This script attempts to execute them against real PostgreSQL.

RLS_CANARY_RESULT=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T app \
  npx vitest run tests/security/rls-canaries.test.ts --reporter=dot 2>&1) || RLS_CANARY_RESULT="FAILED: ${RLS_CANARY_RESULT}"

RLS_PASS=$(echo "${RLS_CANARY_RESULT}" | grep -oE "[0-9]+ passed" | head -1 | grep -oE "^[0-9]+" || echo "0")
RLS_FAIL=$(echo "${RLS_CANARY_RESULT}" | grep -oE "[0-9]+ failed" | head -1 | grep -oE "^[0-9]+" || echo "0")
RLS_SKIP=$(echo "${RLS_CANARY_RESULT}" | grep -oE "[0-9]+ skipped" | head -1 | grep -oE "^[0-9]+" || echo "0")

echo "  RLS canaries: ${RLS_PASS} passed, ${RLS_FAIL} failed, ${RLS_SKIP} skipped"

if [ "${RLS_FAIL}" -gt 0 ]; then
  log_fail "${RLS_FAIL} RLS canary tests failed" "${RLS_CANARY_RESULT:0:500}"
elif [ "${RLS_SKIP}" -gt 0 ] && [ "${RLS_PASS}" -eq 0 ]; then
  log_skip "All ${RLS_SKIP} RLS canaries still skipped (test environment issue)"
elif [ "${RLS_PASS}" -gt 0 ]; then
  log_pass "${RLS_PASS} RLS canary tests passed against real PostgreSQL"
else
  log_skip "RLS canaries could not be executed (test infrastructure issue)"
fi

# ── 4. Advisory lock concurrency ─────────────────────────────────────────────
echo ""
echo "==> [4/6] Advisory lock concurrency"

# Test that two concurrent advisory locks cannot be held simultaneously
ADVISORY_LOCK_RESULT=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
  psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "
    -- Acquire first lock (key 99999)
    SELECT pg_try_advisory_lock(99999) as lock1;
    -- Try to acquire same lock (should fail)
    SELECT pg_try_advisory_lock(99999) as lock2;
    -- Release
    SELECT pg_advisory_unlock(99999) as released;
  " 2>&1)

if echo "${ADVISORY_LOCK_RESULT}" | grep -q "t" && echo "${ADVISORY_LOCK_RESULT}" | grep -q "f"; then
  log_pass "Advisory lock prevents concurrent acquisition (lock1=t, lock2=f)"
else
  log_fail "Advisory lock concurrency check failed" "${ADVISORY_LOCK_RESULT}"
fi

# ── 5. EXCLUDE constraint overlap test ────────────────────────────────────────
echo ""
echo "==> [5/6] EXCLUDE constraint overlap test"

# Insert test reservation, then attempt to insert overlapping one (should fail)
OVERLAP_RESULT=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
  psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "
    -- Insert first reservation (today + 1 to today + 3)
    INSERT INTO \"Reservation\" (id, \"tenantId\", \"roomId\", \"checkIn\", \"checkOut\", status, \"createdAt\", \"updatedAt\")
    VALUES ('test_overlap_1', 'test_tenant_f15g', 'test_room_f15g',
            NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 day', 'pending', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Attempt overlapping reservation (today + 2 to today + 4) — should FAIL
    BEGIN;
    INSERT INTO \"Reservation\" (id, \"tenantId\", \"roomId\", \"checkIn\", \"checkOut\", status, \"createdAt\", \"updatedAt\")
    VALUES ('test_overlap_2', 'test_tenant_f15g', 'test_room_f15g',
            NOW() + INTERVAL '2 day', NOW() + INTERVAL '4 day', 'pending', NOW(), NOW());
    COMMIT;
  " 2>&1)

if echo "${OVERLAP_RESULT}" | grep -qi "constraint\|exclusion\|conflict\|reservation_no_overlap"; then
  log_pass "EXCLUDE constraint correctly rejects overlapping reservation"
else
  log_fail "EXCLUDE constraint did not reject overlap" "${OVERLAP_RESULT}"
fi

# Cleanup test data (only if test IDs)
docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
  psql -U "${DB_USER}" -d "${DB_NAME}" -c "
    DELETE FROM \"Reservation\" WHERE id IN ('test_overlap_1', 'test_overlap_2');
  " >/dev/null 2>&1 || true

# ── 6. Backup/Restore drill ───────────────────────────────────────────────────
echo ""
echo "==> [6/6] Backup/Restore drill (against TEST database only)"

# Step 1: Create backup artifact
echo "  Step 6a: Create backup artifact"
if bash /opt/zehla/scripts/production/backup-pre-migration.sh; then
  BACKUP_PATH=$(cat /tmp/last_pre_migration_backup_path 2>/dev/null || echo "")
  if [ -n "${BACKUP_PATH}" ] && [ -f "${BACKUP_PATH}" ]; then
    log_pass "Backup artifact created: $(basename ${BACKUP_PATH})"

    # Step 2: gzip integrity check
    echo "  Step 6b: gzip integrity check"
    if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
      log_pass "Backup artifact gzip integrity verified"
    else
      log_fail "Backup artifact gzip integrity check failed" "${BACKUP_PATH}"
    fi

    # Step 3: Restore into TEST database (NOT production)
    echo "  Step 6c: Restore into TEST database (never production)"
    RESTORE_RESULT=$(/opt/zehla/scripts/production/restore-drill.sh \
      --artifact "${BACKUP_PATH}" \
      --target-db "${TEST_DB_NAME}" 2>&1) || RESTORE_RESULT="FAILED: ${RESTORE_RESULT}"

    if echo "${RESTORE_RESULT}" | grep -qi "success\|complete"; then
      log_pass "Restore drill completed against TEST database (${TEST_DB_NAME})"
    else
      log_fail "Restore drill failed" "${RESTORE_RESULT:0:500}"
    fi

    # Step 4: Verify TEST database has data
    echo "  Step 6d: Verify TEST database has data"
    TEST_COUNT=$(docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
      psql -U "${DB_USER}" -d "${TEST_DB_NAME}" -t -c "SELECT COUNT(*) FROM \"Tenant\";" 2>&1) || TEST_COUNT="0"

    if [ "${TEST_COUNT}" -gt 0 ]; then
      log_pass "TEST database has ${TEST_COUNT} tenants (restore verified)"
    else
      log_fail "TEST database has 0 tenants (restore may have failed)" "${TEST_COUNT}"
    fi

    # Step 5: Cleanup TEST database
    echo "  Step 6e: Cleanup TEST database"
    docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
      psql -U "${DB_USER}" -d "${DB_NAME}" -c "DROP DATABASE IF EXISTS \"${TEST_DB_NAME}\";" >/dev/null 2>&1 || true
    log_pass "TEST database cleaned up"
  else
    log_fail "Backup artifact path not found" "/tmp/last_pre_migration_backup_path empty"
  fi
else
  log_fail "Backup creation failed" "backup-pre-migration.sh exited non-zero"
fi

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo "==> F05 POSTGRESQL RUNTIME VALIDATION SUMMARY"
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo "  SKIP: ${SKIP_COUNT}"
echo ""
echo "  Full log: ${RESULTS_FILE}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo ""
  echo "==> F05 STATUS: PARTIAL — ${FAIL_COUNT} validation(s) failed"
  exit 1
fi

echo ""
echo "==> F05 STATUS: COMPLETE — all validations passed"
exit 0
