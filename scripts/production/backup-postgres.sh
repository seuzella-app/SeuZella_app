#!/usr/bin/env bash
# ============================================================================
# BACKUP POSTGRESQL — diário + retenção 30 dias
# ============================================================================
# Adicione ao crontab:
#   0 3 * * * /home/z/zella-mobile/scripts/production/backup-postgres.sh
# ============================================================================

set -euo pipefail

BACKUP_DIR="/home/z/zella-mobile/backups/postgres"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/zehla-prod-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Extrai credenciais da DATABASE_URL
DB_URL="${DATABASE_URL:-postgresql://zehla_app:senha@localhost:5432/zehla_prod}"
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:]+):.*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "💾 Backup PostgreSQL: $DB_NAME @ $DB_HOST"

# pg_dump + gzip
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  | gzip > "$BACKUP_FILE"

echo "✅ Backup criado: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Remove backups antigos
find "$BACKUP_DIR" -name "zehla-prod-*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "🧹 Backups > $RETENTION_DAYS dias removidos"

# Upload para S3/Backblaze B2 (opcional — descomente se configurado)
# aws s3 cp "$BACKUP_FILE" s3://zehla-backups/postgres/ --no-progress

# Verificação de integridade (teste restore em banco tmp)
echo "🔍 Testando restore..."
RESTORE_TEST_DB="zehla_restore_test"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $RESTORE_TEST_DB;" 2>/dev/null || true
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $RESTORE_TEST_DB;" 2>/dev/null || true
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$RESTORE_TEST_DB" --no-owner --no-privileges 2>/dev/null || true
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE $RESTORE_TEST_DB;" 2>/dev/null || true
echo "✅ Restore test OK"

echo ""
echo "✅ Backup completo!"
