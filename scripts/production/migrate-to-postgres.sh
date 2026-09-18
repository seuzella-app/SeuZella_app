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
#
# ----------------------------------------------------------------------------
# CLASSIFICAÇÃO (RUN 5 — Migration Gate): A — BOOTSTRAP ÚNICO (one-time).
# Converte uma instalação SQLite para PostgreSQL na VPS. NÃO é o mecanismo de
# evolução de schema em produção — esse papel é de `prisma migrate deploy`
# (scripts/deploy-mvk4.sh / deploy/deploy-vps.sh), hoje BLOCKED por ausência
# de migration baseline (127 modelos no schema × ~27 CREATE TABLEs nas
# migrations; migration 20260521175644 em dialeto SQLite: DATETIME).
# Pré-condições: PostgreSQL 16 instalado; banco alvo VAZIO (guard abaixo);
# backup do SQLite (automático abaixo). Reversibilidade: o arquivo SQLite
# original permanece intacto (apenas copiado). Risco de divergência
# schema×migrations: permanente até a criação da baseline; após o bootstrap
# NÃO rode este script novamente (o guard falha antes de qualquer operação).
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

# ── GUARD (RUN 5 — Migration Gate): bootstrap apenas em banco VAZIO ─────────
# Fail-closed: se o banco não estiver vazio, NENHUMA operação de schema é
# executada (nem db push, nem migrate deploy). Sem --accept-data-loss, sem
# fallback, sem alteração automática destrutiva.
echo "🔒 Verificando estado do banco alvo (guard fail-closed)..."
npx prisma db execute --stdin <<'EOF'
DO $$
DECLARE t INT; m TEXT;
BEGIN
  SELECT count(*) INTO t FROM information_schema.tables WHERE table_schema = 'public';
  SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN 'AUSENTE' ELSE 'PRESENTE' END INTO m;
  IF t > 0 AND m = 'AUSENTE' THEN
    RAISE EXCEPTION 'RUN5-GUARD: banco NAO-vazio (% tabelas) e sem _prisma_migrations — bootstrap recusado, estado preservado. NUNCA use --accept-data-loss para contornar.', t;
  END IF;
  IF t > 0 AND m = 'PRESENTE' THEN
    RAISE EXCEPTION 'RUN5-GUARD: banco ja possui historico de migrations (% tabelas) — este script e bootstrap one-time. Fluxo oficial: scripts/deploy-mvk4.sh (migrate deploy).', t;
  END IF;
END $$;
EOF
echo "✅ Banco vazio — bootstrap autorizado"

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

# 2. Criar schema no PostgreSQL (sem dados) — FAIL-CLOSED (RUN 4 Wave 4D)
#    Sem --accept-data-loss: em DB vazio o comportamento é idêntico; em rerun
#    contra DB não-vazio, o Prisma FALHA em vez de destruir dados silenciosamente.
echo ""
echo "2️⃣  Criando schema no PostgreSQL..."
npx prisma db push

# 3. Rodar migrations pendentes — PULADO (RUN 5 — Migration Gate: BLOCKED)
#    NÃO executar `prisma migrate deploy` aqui: o db push do passo 2 criou o
#    schema completo (127 modelos) SEM registrar _prisma_migrations. O deploy
#    tentaria aplicar as 23 migrations desde o início e FALHARIA na migration
#    20260521175644_add_funnel_models (dialeto SQLite — tipo DATETIME não
#    existe no PostgreSQL — e CREATE TABLE de tabelas já existentes).
#    UNBLOCK (no iMac, com histórico versionado completo):
#      npx prisma migrate diff --from-empty --to-schema-datamodel \
#        prisma/schema.prisma --script > \
#        prisma/migrations/00000000000000_baseline/migration.sql
#      # validar em PG limpo: migrate deploy == schema esperado (sem drift)
#      # em banco já inicializado por push: npx prisma migrate resolve --applied \
#      #   00000000000000_baseline  (somente após auditoria de drift)
echo ""
echo "3️⃣  [PULADO] prisma migrate deploy — estratégia BLOCKED (baseline ausente)"
echo "    Motivo e unblock: ver bloco de comentário acima e RUN5_MIGRATION_GATE_REPORT.md"

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
echo ""
echo "⚠️  ATENÇÃO (RUN 5 — Migration Gate): o schema foi criado via db push e NÃO há"
echo "   registro em _prisma_migrations. A evolução futura de schema via migrate"
echo "   deploy permanece BLOCKED até a criação da migration baseline."
echo "   NÃO rode este script novamente neste banco (guard falhará, por design)."
