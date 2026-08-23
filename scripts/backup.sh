#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ENC_KEY_FILE="/opt/secrets/backup.key"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Iniciando rotina de backup criptografado..."

# 1. Dump do PostgreSQL
docker compose -f /opt/zehla/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${DB_USER:-zehla}" "${DB_NAME:-zehla_production}" | gzip > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

# 2. Criptografia AES-256-CBC
if [ -f "${ENC_KEY_FILE}" ]; then
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz" \
    -out "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz.enc" \
    -pass file:"${ENC_KEY_FILE}"

  rm "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
  echo "[$(date)] Backup concluído com sucesso: db_${TIMESTAMP}.sql.gz.enc"
else
  echo "[$(date)] ATENÇÃO: Arquivo de chave ${ENC_KEY_FILE} não encontrado. Mantendo arquivo comprimido .sql.gz."
fi

# 3. Limpeza de backups antigos (>30 dias)
find "${BACKUP_DIR}" -type f -name "*.enc" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

echo "[$(date)] Rotina de backup finalizada."
