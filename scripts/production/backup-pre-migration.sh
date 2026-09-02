#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — PRE-MIGRATION DATABASE BACKUP (Wave 15 / F04 / NB-003)
# ==============================================================================
# Executes a pg_dump backup of the production PostgreSQL database BEFORE
# running `prisma migrate deploy`. The pipeline fails closed if the backup
# cannot be produced — migrations NEVER run without a successful backup.
#
# SECURITY:
#   - Never prints DATABASE_URL or passwords.
#   - Uses PGPASSWORD environment variable (not connection string).
#   - Backup artifact is identified by timestamp + git SHA.
#   - No destructive operations (no DROP, no migrate reset).
#
# USAGE (inside docker-compose.prod.yml stack):
#   bash scripts/production/backup-pre-migration.sh
#
# REQUIRED ENV VARS (provided by docker-compose.prod.yml):
#   DB_USER, DB_PASS, DB_NAME
#
# OPTIONAL ENV VARS:
#   BACKUP_DIR (default: /opt/backups/pre-migration)
#   RETENTION_DAYS (default: 30)
#
# EXIT CODES:
#   0 = backup successful
#   1 = backup failed (pipeline must abort)
# ==============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/pre-migration}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Required env vars — fail closed if missing.
: "${DB_USER:?DB_USER is required for pre-migration backup}"
: "${DB_PASS:?DB_PASS is required for pre-migration backup}"
: "${DB_NAME:?DB_NAME is required for pre-migration backup}"

# Export PGPASSWORD so pg_dump can authenticate WITHOUT exposing it in the
# process list or command line.
export PGPASSWORD="${DB_PASS}"

# ── Identifiers ──────────────────────────────────────────────────────────────
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
BACKUP_FILE="pre_migration_${TIMESTAMP}_${GIT_SHA}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

mkdir -p "${BACKUP_DIR}"

# ── Logging (non-sensitive) ─────────────────────────────────────────────────
echo "Database backup: START"
echo "  target: ${BACKUP_PATH}"
echo "  git_sha: ${GIT_SHA}"
echo "  timestamp: ${TIMESTAMP}"

# ── Execute pg_dump ──────────────────────────────────────────────────────────
# Uses `docker compose exec -T postgres` to run pg_dump inside the postgres
# container, piping through gzip on the host. This avoids exposing DB_PASS
# to the host process list.
BACKUP_START_EPOCH=$(date +%s)

if ! docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
     pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl 2>/dev/null \
     | gzip > "${BACKUP_PATH}"; then
  echo "Database backup: FAILED"
  echo "  reason: pg_dump pipeline error"
  # Clean up partial artifact to avoid false sense of safety.
  rm -f "${BACKUP_PATH}"
  unset PGPASSWORD
  exit 1
fi

BACKUP_END_EPOCH=$(date +%s)
BACKUP_DURATION_SEC=$((BACKUP_END_EPOCH - BACKUP_START_EPOCH))

# ── Verify backup artifact integrity ─────────────────────────────────────────
if [ ! -s "${BACKUP_PATH}" ]; then
  echo "Database backup: FAILED"
  echo "  reason: backup artifact is empty or missing"
  rm -f "${BACKUP_PATH}"
  unset PGPASSWORD
  exit 1
fi

BACKUP_SIZE_BYTES=$(stat -c %s "${BACKUP_PATH}" 2>/dev/null || stat -f %z "${BACKUP_PATH}" 2>/dev/null || echo 0)
BACKUP_SIZE_MB=$((BACKUP_SIZE_BYTES / 1024 / 1024))

# Sanity check: gzip integrity verification (decompress test, no actual extraction).
if ! gzip -t "${BACKUP_PATH}" 2>/dev/null; then
  echo "Database backup: FAILED"
  echo "  reason: gzip integrity check failed (artifact may be corrupted)"
  rm -f "${BACKUP_PATH}"
  unset PGPASSWORD
  exit 1
fi

# ── Success logging (non-sensitive) ──────────────────────────────────────────
echo "Database backup: SUCCESS"
echo "  artifact: ${BACKUP_FILE}"
echo "  size: ${BACKUP_SIZE_MB} MB"
echo "  duration: ${BACKUP_DURATION_SEC}s"

# ── Retention: clean up old backups (older than RETENTION_DAYS) ──────────────
# Only deletes pre-migration backups; never touches other backup directories.
DELETED_COUNT=$(find "${BACKUP_DIR}" -type f -name "pre_migration_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete 2>/dev/null | wc -l)
if [ "${DELETED_COUNT}" -gt 0 ]; then
  echo "  retention: removed ${DELETED_COUNT} old backup(s) older than ${RETENTION_DAYS} days"
fi

# Unset PGPASSWORD as defense-in-depth.
unset PGPASSWORD

# ── Export artifact path for downstream pipeline steps ───────────────────────
# Pipeline can read this file to know which artifact was produced.
echo "${BACKUP_PATH}" > /tmp/last_pre_migration_backup_path

exit 0
