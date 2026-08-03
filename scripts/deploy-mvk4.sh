#!/usr/bin/env bash

# ==============================================================================
# SEU ZÉLLA — ZERO-DOWNTIME CD DEPLOYMENT SCRIPT (VPS HOSTINGER MVK4)
# ==============================================================================

set -e # Interrompe a execução em caso de erro não tratado

APP_DIR="${APP_DIR:-/var/www/seuzella}"
APP_NAME="seuzella-production"
HEALTH_URL="http://localhost:3000/api/health"
MAX_RETRIES=10
RETRY_INTERVAL=3

echo "🚀 [1/6] Iniciando processo de deploy na VPS MVK4..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
fi

# 1. Salva o commit atual para caso precise de rollback
PREV_COMMIT=$(git rev-parse HEAD)
echo "📌 Commit atual de segurança: $PREV_COMMIT"

# 2. Atualiza o código fonte
echo "📥 [2/6] Atualizando repositório a partir da branch 'main'..."
git fetch origin main
git reset --hard origin/main

# 3. Instala dependências (incluindo devDeps para build TypeScript) e Gera Prisma Client
echo "📦 [3/6] Instalando dependências e gerando Prisma Client..."
npm ci --legacy-peer-deps
npx prisma generate

# 4. Aplica migrações pendentes no banco
echo "🛢️ [4/6] Executando migrações de banco de dados (Prisma Migrate)..."
npx prisma migrate deploy || npx prisma db push --accept-data-loss

# 5. Build de Produção Next.js
echo "🏗️ [5/6] Gerando build de produção Next.js..."
npm run build

# 6. Zero-Downtime Reload via PM2
echo "🔄 [6/6] Executando Zero-Downtime Reload no PM2..."
if pm2 describe $APP_NAME > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi

# ==============================================================================
# HEALTH CHECK & ROLLBACK LOGIC
# ==============================================================================
echo "🔍 Validando saúde da aplicação em $HEALTH_URL..."

HEALTH_PASSED=false
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo "✅ Health Check APROVADO! (HTTP 200) na tentativa $i/$MAX_RETRIES."
        HEALTH_PASSED=true
        break
    fi
    
    echo "⏳ Aguardando subida da aplicação... Tentativa $i/$MAX_RETRIES (HTTP: $HTTP_STATUS)"
    sleep $RETRY_INTERVAL
done

if [ "$HEALTH_PASSED" = false ]; then
    echo "❌ CRÍTICO: Health Check FALHOU após $MAX_RETRIES tentativas!"
    echo "⚠️ Iniciando ROLLBACK AUTOMÁTICO para o commit $PREV_COMMIT..."
    
    git reset --hard $PREV_COMMIT
    npm ci --legacy-peer-deps
    npx prisma generate
    npm run build
    pm2 reload ecosystem.config.js --env production
    
    echo "🚨 Rollback concluído. O sistema foi restaurado à versão estável anterior."
    exit 1
fi

echo "🎉 DEPLOY CONCLUÍDO COM 100% DE SUCESSO E ZERO DOWNTIME!"
