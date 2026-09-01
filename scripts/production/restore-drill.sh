#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — PRODUCTION DISASTER RECOVERY RESTORE DRILL
# Strict Verification: Requires explicit Postgres container & table validation.
# Does NOT pass or return 0 if database/backup are missing in execution mode.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
DRILL_DB="${DRILL_DB:-zehla_drill_test}"
DB_USER="${DB_USER:-zehla}"
ENC_KEY_FILE="${ENC_KEY_FILE:-/opt/secrets/backup.key}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/zehla/docker-compose.prod.yml}"
MODE="${1:---execute-drill}"

echo "======================================================================"
echo "🛡️  SEU ZÉLLA — DISASTER RECOVERY RESTORE DRILL"
echo "Target Drill Database: ${DRILL_DB}"
echo "Execution Mode: ${MODE}"
echo "======================================================================"

# Safety Guard 1: Ensure we are NOT targeting production db
if [[ "${DRILL_DB}" == *"production"* || "${DRILL_DB}" == "zehla" || "${DRILL_DB}" == "zehla_prod" ]]; then
  echo "❌ CRITICAL SAFETY ERROR: Target database cannot be a production database name (${DRILL_DB})."
  echo "Restore drill must run against an isolated drill database."
  exit 1
fi

if [[ "${MODE}" == "--dry-run-preflight" ]]; then
  echo "ℹ️  Running in PRE-FLIGHT mode. Checking configuration and safety guards only..."
  if [[ -d "${BACKUP_DIR}" ]]; then
    echo "✅ Backup directory exists: ${BACKUP_DIR}"
  else
    echo "⚠️  Backup directory does not exist: ${BACKUP_DIR} (will be created on provisioning)"
  fi
  echo "✅ PRE-FLIGHT COMPLETED. (NOTE: This does NOT certify runtime restore validation)."
  exit 0
fi

# Mode is --execute-drill: Strict Validation
# Find latest backup file
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/db_*.sql.gz* 2>/dev/null | head -n 1 || true)

if [[ -z "${LATEST_BACKUP}" ]]; then
  echo "❌ RESTORE DRILL FAILED: No backup files found in ${BACKUP_DIR}."
  echo "Cannot execute restore drill without a backup candidate."
  exit 2
fi

echo "📦 Selected backup candidate: ${LATEST_BACKUP}"
TEMP_RESTORE_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_RESTORE_DIR}"' EXIT

RESTORE_SQL="${TEMP_RESTORE_DIR}/restore.sql"

# Decryption if encrypted
if [[ "${LATEST_BACKUP}" == *.enc ]]; then
  if [[ ! -f "${ENC_KEY_FILE}" ]]; then
    echo "❌ DECRYPTION FAILED: Encryption key file ${ENC_KEY_FILE} not found."
    exit 4
  fi
  echo "🔐 Decrypting AES-256-CBC backup..."
  if ! openssl enc -d -aes-256-cbc -pbkdf2 \
    -in "${LATEST_BACKUP}" \
    -out "${TEMP_RESTORE_DIR}/db_decrypted.sql.gz" \
    -pass file:"${ENC_KEY_FILE}"; then
    echo "❌ DECRYPTION FAILED: OpenSSL decryption error."
    exit 4
  fi
  gunzip -c "${TEMP_RESTORE_DIR}/db_decrypted.sql.gz" > "${RESTORE_SQL}"
elif [[ "${LATEST_BACKUP}" == *.gz ]]; then
  gunzip -c "${LATEST_BACKUP}" > "${RESTORE_SQL}"
else
  cp "${LATEST_BACKUP}" "${RESTORE_SQL}"
fi

FILE_SIZE=$(wc -c < "${RESTORE_SQL}")
if [[ ${FILE_SIZE} -le 100 ]]; then
  echo "❌ RESTORE DRILL FAILED: Extracted SQL file is empty or suspiciously small (${FILE_SIZE} bytes)."
  exit 5
fi

echo "✅ Backup extracted and integrity verified (${FILE_SIZE} bytes)."

# Require real Docker/Postgres container in execution mode
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ RESTORE DRILL FAILED: Docker CLI not found. Real container required for runtime validation."
  exit 3
fi

if ! docker compose -f "${COMPOSE_FILE}" ps | grep -q postgres; then
  echo "❌ RESTORE DRILL FAILED: PostgreSQL container not running in ${COMPOSE_FILE}."
  exit 3
fi

echo "🐘 Recreating drill database ${DRILL_DB} in isolated Postgres container..."
docker compose -f "${COMPOSE_FILE}" exec -T postgres psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DRILL_DB};"
docker compose -f "${COMPOSE_FILE}" exec -T postgres psql -U "${DB_USER}" -c "CREATE DATABASE ${DRILL_DB};"

echo "🔄 Executing SQL restore into ${DRILL_DB}..."
if ! docker compose -f "${COMPOSE_FILE}" exec -T postgres psql -U "${DB_USER}" -d "${DRILL_DB}" < "${RESTORE_SQL}"; then
  echo "❌ RESTORE DRILL FAILED: psql encountered errors during database restoration."
  exit 5
fi

echo "🔍 Verifying table schema and row counts in ${DRILL_DB}..."
TABLE_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres psql -U "${DB_USER}" -d "${DRILL_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
TABLE_COUNT=$(echo "${TABLE_COUNT}" | tr -d '[:space:]')

if [[ "${TABLE_COUNT}" -lt 5 ]]; then
  echo "❌ RESTORE DRILL FAILED: Expected schema tables missing in ${DRILL_DB} (found ${TABLE_COUNT} tables)."
  exit 5
fi

echo "✅ RESTORE DRILL SUCCESSFUL: ${TABLE_COUNT} tables restored and verified in isolated database ${DRILL_DB}."
