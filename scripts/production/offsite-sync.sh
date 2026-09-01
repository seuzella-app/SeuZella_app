#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — OFFSITE BACKUP SYNC SCRIPT (S3/R2 / Cloud Storage)
# Fail-closed: Exits with error 1 if mandatory bucket configuration is missing.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
OFFSITE_BUCKET="${OFFSITE_BUCKET:-}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-}"

echo "======================================================================"
echo "☁️  SEU ZÉLLA — OFFSITE BACKUP SYNCHRONIZATION"
echo "======================================================================"

# Fail-closed guard: mandatory config check
if [[ -z "${OFFSITE_BUCKET}" ]]; then
  echo "❌ FAIL-CLOSED ERROR: OFFSITE_BUCKET environment variable is not defined."
  echo "Offsite sync requires a valid S3/Cloudflare R2 destination bucket URI (e.g. s3://seuzella-backups-offsite)."
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ FAIL-CLOSED ERROR: AWS CLI is not installed on this host."
  exit 1
fi

# Ensure backup files exist
ENCRYPTED_FILES=$(ls "${BACKUP_DIR}"/*.enc 2>/dev/null || true)
if [[ -z "${ENCRYPTED_FILES}" ]]; then
  echo "⚠️  No encrypted backup files (*.enc) found in ${BACKUP_DIR}. Skipping sync."
  exit 0
fi

echo "🚀 Syncing encrypted backups from ${BACKUP_DIR} to ${OFFSITE_BUCKET}..."

EXTRA_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL}" ]]; then
  EXTRA_ARGS+=(--endpoint-url "${AWS_ENDPOINT_URL}")
fi

aws s3 sync "${BACKUP_DIR}" "${OFFSITE_BUCKET}" \
  --exclude "*" \
  --include "*.enc" \
  "${EXTRA_ARGS[@]}"

echo "✅ Offsite synchronization completed successfully."
