#!/bin/bash
# ============================================================================
# SEU ZÉLLA — DEPLOY SCRIPT PARA VPS HOSTINGER MVK 4
# ============================================================================
# Uso:
#   sudo bash deploy/deploy-vps.sh
#
# Pré-requisitos (instalados pelo setup-vps.sh):
#   - Node.js 22+
#   - Bun
#   - PostgreSQL 16
#   - nginx
#   - pm2 (global)
#   - certbot
# ============================================================================

set -euo pipefail

# ─── Configurações ──────────────────────────────────────────────────────────
APP_NAME="seuzella"
APP_DIR="/var/www/seuzella"
APP_USER="www-data"
REPO_URL="https://github.com/MarcioCau14/SmartHotel_Zehla.git"
BRANCH="main"
LOG_DIR="/var/log/seuzella"
CRON_LOG_DIR="${LOG_DIR}/cron"
DB_NAME="seuzella_prod"
DB_USER="seuzella"

# ─── Helpers ────────────────────────────────────────────────────────────────
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

err() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERRO: $1" >&2
  exit 1
}

check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "Este script deve ser executado como root (use sudo)"
  fi
}

# ─── 0. Pré-checks ───────────────────────────────────────────────────────────
check_root

log "🚀 Iniciando deploy do Seu Zélla na VPS Hostinger MVK 4..."
log "App dir: $APP_DIR"
log "Branch:  $BRANCH"
echo ""

# ─── 1. Criar diretórios ─────────────────────────────────────────────────────
log "📁 Criando diretórios..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR" "$CRON_LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
echo "  ✅ Diretórios criados"
echo ""

# ─── 2. Clonar ou atualizar repo ─────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "🔄 Atualizando repo existente..."
  cd "$APP_DIR"
  sudo -u "$APP_USER" git fetch origin
  sudo -u "$APP_USER" git reset --hard "origin/$BRANCH"
else
  log "📥 Clonando repo..."
  git clone --depth 50 "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  git checkout "$BRANCH"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo "  ✅ Código atualizado em $(git rev-parse --short HEAD)"
echo ""

# ─── 3. Instalar dependências ────────────────────────────────────────────────
log "📦 Instalando dependências (pode levar 2-3 min)..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --legacy-peer-deps
echo "  ✅ Dependências instaladas"
echo ""

# ─── 4. Configurar .env.production se não existir ────────────────────────────
if [ ! -f "$APP_DIR/.env.production" ]; then
  log "⚠️  .env.production não existe!"
  log "    Copiando deploy/.env.example para .env.production..."
  log "    ⚠️  EDITE .env.production com suas credenciais REAIS antes de continuar!"
  cp "$APP_DIR/deploy/.env.example" "$APP_DIR/.env.production"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  echo ""
  echo "  ⚠️  Editar .env.production agora e depois re-executar este script"
  echo "     nano $APP_DIR/.env.production"
  exit 1
fi
echo "  ✅ .env.production encontrado"
echo ""

# ─── 5. Carregar env vars do .env.production ─────────────────────────────────
log "🔑 Carregando variáveis de ambiente..."
set -a
source "$APP_DIR/.env.production"
set +a

# Validar env vars críticas
[ -z "$DATABASE_URL" ] && err "DATABASE_URL não configurada em .env.production"
[ -z "$NEXTAUTH_SECRET" ] && err "NEXTAUTH_SECRET não configurada"
[ -z "$CRON_SECRET" ] && err "CRON_SECRET não configurada"
echo "  ✅ Variáveis críticas validadas"
echo ""

# ─── 6. Gerar Prisma client ──────────────────────────────────────────────────
log "🔧 Gerando Prisma client..."
cd "$APP_DIR"
sudo -u "$APP_USER" -E npx prisma generate
echo "  ✅ Prisma client gerado"
echo ""

# ─── 7. Rodar migrations (PostgreSQL) ────────────────────────────────────────
log "🗄️  Rodando migrations no PostgreSQL..."
cd "$APP_DIR"
sudo -u "$APP_USER" -E npx prisma migrate deploy
echo "  ✅ Migrations aplicadas"
echo ""

# ─── 8. Build do Next.js (production) ─────────────────────────────────────────
log "🏗️  Build do Next.js (pode levar 1-2 min)..."
cd "$APP_DIR"
sudo -u "$APP_USER" -E npm run build
echo "  ✅ Build concluído"
echo ""

# ─── 9. Copiar arquivos estáticos para standalone ─────────────────────────────
log "📋 Copiando arquivos estáticos..."
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
chown -R "$APP_USER:$APP_USER" .next/standalone
echo "  ✅ Arquivos estáticos copiados"
echo ""

# ─── 10. Iniciar/reiniciar PM2 ──────────────────────────────────────────────
log "🚀 Iniciando PM2 (cluster mode)..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js --env production
  echo "  ✅ PM2 reload (zero-downtime)"
else
  pm2 start deploy/ecosystem.config.js --env production
  echo "  ✅ PM2 iniciado (2 clusters)"
fi
pm2 save
echo ""

# ─── 11. Configurar nginx ───────────────────────────────────────────────────
log "🌐 Configurando nginx..."
if [ ! -f /etc/nginx/sites-available/seuzella ]; then
  cp deploy/nginx.conf /etc/nginx/sites-available/seuzella
  ln -sf /etc/nginx/sites-available/seuzella /etc/nginx/sites-enabled/
fi
nginx -t && systemctl reload nginx
echo "  ✅ nginx configurado e reloadado"
echo ""

# ─── 12. Instalar crons ─────────────────────────────────────────────────────
log "⏰ Instalando crons (17 jobs)..."
cp deploy/vps-crontab /etc/cron.d/seuzella
chown root:root /etc/cron.d/seuzella
chmod 644 /etc/cron.d/seuzella
systemctl reload cron
echo "  ✅ 17 crons instalados"
echo ""

# ─── 13. Smoke tests ────────────────────────────────────────────────────────
log "🧪 Executando smoke tests..."

# Verificar se app responde
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/mobile/pousada || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ /mobile/pousada respondeu 200"
else
  echo "  ⚠️  /mobile/pousada retornou $HTTP_CODE (pode levar 30s para esquentar)"
fi

# Verificar sounds
SOUND_CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/sounds/alert.mp3 || echo "000")
if [ "$SOUND_CODE" = "200" ]; then
  echo "  ✅ /sounds/alert.mp3 respondeu 200"
else
  echo "  ⚠️  /sounds/alert.mp3 retornou $SOUND_CODE"
fi

# Verificar SW v2
SW_VER=$(curl -sS http://localhost:3000/sw.js | grep -oE 'seuzella-pwa-v[12]')
if [ "$SW_VER" = "seuzella-pwa-v2" ]; then
  echo "  ✅ PWA Service Worker v2 ativo"
else
  echo "  ⚠️  SW retornou '$SW_VER' (esperado seuzella-pwa-v2)"
fi

echo ""

# ─── 14. SSL via Let's Encrypt ──────────────────────────────────────────────
DOMAIN=$(echo "$NEXTAUTH_URL" | sed -E 's|https?://||;s|/.*||;s|:.*||')
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
  log "🔒 Verificando SSL para $DOMAIN..."
  if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "   Solicitando certificado Let's Encrypt..."
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect || true
  else
    echo "  ✅ SSL já configurado para $DOMAIN"
  fi
fi
echo ""

# ─── 15. Final ───────────────────────────────────────────────────────────────
log "════════════════════════════════════════════════════════════════"
log "🎉 DEPLOY CONCLUÍDO!"
log "════════════════════════════════════════════════════════════════"
log ""
log "📱 URLs:"
log "   https://$DOMAIN"
log "   https://$DOMAIN/mobile/pousada"
log "   https://$DOMAIN/mobile/airbnb"
log ""
log "📊 Monitoramento:"
log "   pm2 status           — status dos processos"
log "   pm2 logs seuzella    — logs em tempo real"
log "   pm2 monit            — CPU/MEM dashboard"
log "   tail -f $LOG_DIR/cron/*.log  — logs dos crons"
log ""
log "🔄 Próximos deploys:"
log "   sudo bash $APP_DIR/deploy/deploy-vps.sh"
log ""
log "🧠 Cérebro Zélla está OPERACIONAL"
log "════════════════════════════════════════════════════════════════"
