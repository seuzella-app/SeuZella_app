#!/usr/bin/env bash
# ==============================================================================
# SEU ZÉLLA — OFFSITE BACKUP SYNC SCRIPT (S3/R2 / Cloud Storage)
# Fail-closed & Verifiable: Exits with error if config missing OR if remote
# object verification fails after sync.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
OFFSITE_BUCKET="${OFFSITE_BUCKET:-}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-}"

echo "======================================================================"
echo "☁️  SEU ZÉLLA — OFFSITE BACKUP SYNCHRONIZATION & VERIFICATION"
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

LATEST_LOCAL_FILE=$(ls -t "${BACKUP_DIR}"/*.enc | head -n 1)
LATEST_BASENAME=$(basename "${LATEST_LOCAL_FILE}")
LOCAL_SIZE=$(wc -c < "${LATEST_LOCAL_FILE}")

echo "🚀 Syncing encrypted backups from ${BACKUP_DIR} to ${OFFSITE_BUCKET}..."

EXTRA_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL}" ]]; then
  EXTRA_ARGS+=(--endpoint-url "${AWS_ENDPOINT_URL}")
fi

aws s3 sync "${BACKUP_DIR}" "${OFFSITE_BUCKET}" \
  --exclude "*" \
  --include "*.enc" \
  "${EXTRA_ARGS[@]}"

# Verification Phase: Verify remote object presence and size
echo "🔍 Verifying remote destination object: ${OFFSITE_BUCKET}/${LATEST_BASENAME}..."

REMOTE_INFO=$(aws s3 ls "${OFFSITE_BUCKET}/${LATEST_BASENAME}" "${EXTRA_ARGS[@]}" || true)

if [[ -z "${REMOTE_INFO}" ]]; then
  echo "❌ VERIFICATION FAILED: Uploaded backup ${LATEST_BASENAME} not found in ${OFFSITE_BUCKET}."
  exit 2
fi

REMOTE_SIZE=$(echo "${REMOTE_INFO}" | awk '{print $3}')
echo "📊 Local Size: ${LOCAL_SIZE} bytes | Remote Size: ${REMOTE_SIZE} bytes"

if [[ "${LOCAL_SIZE}" -ne "${REMOTE_SIZE}" ]]; then
  echo "❌ VERIFICATION FAILED: Size mismatch between local (${LOCAL_SIZE}) and remote (${REMOTE_SIZE})."
  exit 3
fi

echo "✅ OFFSITE SYNC & VERIFICATION COMPLETED: Object ${LATEST_BASENAME} verified in ${OFFSITE_BUCKET}."
