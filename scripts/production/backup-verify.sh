#!/usr/bin/env bash
set -Eeuo pipefail

# Verify an existing PostgreSQL dump without mutating the source database.
# Usage: DATABASE_URL='postgresql://...' ./scripts/production/backup-verify.sh /path/to/dump.sql

DUMP_FILE="${1:-}"
[[ -n "$DUMP_FILE" ]] || { echo 'BACKUP_VERIFY=FAIL: dump path required' >&2; exit 2; }
[[ -f "$DUMP_FILE" ]] || { echo 'BACKUP_VERIFY=FAIL: dump not found' >&2; exit 2; }

command -v pg_restore >/dev/null 2>&1 || { echo 'BACKUP_VERIFY=FAIL: pg_restore not found' >&2; exit 1; }

if [[ "$DUMP_FILE" == *.tar || "$DUMP_FILE" == *.dump || "$DUMP_FILE" == *.backup ]]; then
  pg_restore --list "$DUMP_FILE" >/dev/null || { echo 'BACKUP_VERIFY=FAIL: archive unreadable' >&2; exit 1; }
elif [[ "$DUMP_FILE" == *.sql ]]; then
  grep -qE '^-- PostgreSQL database dump' "$DUMP_FILE" || { echo 'BACKUP_VERIFY=FAIL: SQL signature missing' >&2; exit 1; }
else
  echo 'BACKUP_VERIFY=FAIL: unsupported dump format' >&2
  exit 2
fi

if command -v sha256sum >/dev/null 2>&1; then
  checksum="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
else
  checksum="$(shasum -a 256 "$DUMP_FILE" | awk '{print $1}')"
fi
printf 'BACKUP_VERIFY=PASS\n'
printf 'DUMP_SIZE_BYTES=%s\n' "$(wc -c < "$DUMP_FILE" | tr -d ' ')"
printf 'SHA256=%s\n' "$checksum"
printf '%s\n' 'RESTORE_EXECUTED=false'
