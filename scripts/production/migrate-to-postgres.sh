#!/usr/bin/env bash
# ============================================================================
# MIGRAÇÃO POSTGRESQL — SQLite → PostgreSQL (Hostinger VPS MVK4)
# ============================================================================
# Rodar este script na VPS Hostinger após:
#   1. Instalar PostgreSQL 16
#   2. Criar database "zehla_prod" e usuário "zehla_app"
#   3. Configurar pg_hba.conf para aceitar conexões locais
#
# Uso:
#   DATABASE_URL="postgresql://zehla_app:SENHA@localhost:5432/zehla_prod" \
#   bash /home/z/zella-mobile/scripts/production/migrate-to-postgres.sh
# ============================================================================

set -euo pipefail

echo "🚀 Zélla — Migração SQLite → PostgreSQL"
echo "========================================"

# Verifica DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL não configurada"
  echo "   export DATABASE_URL='postgresql://zehla_app:SENHA@localhost:5432/zehla_prod'"
  exit 1
fi

# Verifica se é PostgreSQL
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
  echo "❌ DATABASE_URL precisa ser PostgreSQL (não SQLite)"
  exit 1
fi

echo "📡 DATABASE_URL: ${DATABASE_URL%@*}@***"
echo ""

# Backup do SQLite atual (se existir)
if [ -f "/home/z/zella-mobile/prisma/dev.db" ]; then
  BACKUP_PATH="/home/z/zella-mobile/backups/dev-db-$(date +%Y%m%d-%H%M%S).db"
  mkdir -p /home/z/zella-mobile/backups
  cp /home/z/zella-mobile/prisma/dev.db "$BACKUP_PATH"
  echo "💾 Backup SQLite criado: $BACKUP_PATH"
fi

# 1. Gerar cliente Prisma
echo ""
echo "1️⃣  Gerando cliente Prisma..."
cd /home/z/zella-mobile
npx prisma generate

# 2. Criar schema no PostgreSQL (sem dados)
echo ""
echo "2️⃣  Criando schema no PostgreSQL..."
npx prisma db push --accept-data-loss

# 3. Rodar migrations pendentes
echo ""
echo "3️⃣  Rodando migrations pendentes..."
npx prisma migrate deploy

# 4. Verificar
echo ""
echo "4️⃣  Verificando..."
npx prisma db execute --stdin <<'EOF'
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
EOF

echo ""
echo "✅ Migração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Configurar pgBackRest para backup automático diário"
echo "   2. Configurar PgBouncer para connection pooling"
echo "   3. Atualizar DATABASE_URL na Vercel"
echo "   4. Rodar seed (npx prisma db seed) — opcional para dados demo"
