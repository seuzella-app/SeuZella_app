#!/bin/bash
# ============================================================================
# SEU ZÉLLA — VPS SETUP SCRIPT (executar 1 vez na VPS Hostinger MVK 4)
# ============================================================================
# Instala TUDO que o Seu Zélla precisa para rodar:
#   - Node.js 22
#   - Bun
#   - PostgreSQL 16
#   - nginx
#   - PM2
#   - certbot (Let's Encrypt)
#   - ufw firewall
#   - fail2ban (proteção SSH)
#
# Uso:
#   ssh root@IP_DA_VPS
#   curl -fsSL https://raw.githubusercontent.com/MarcioCau14/SmartHotel_Zehla/main/deploy/setup-vps.sh | bash
#
# OU após clonar o repo:
#   sudo bash deploy/setup-vps.sh
# ============================================================================

set -euo pipefail

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Check root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: Execute como root (use sudo)"
  exit 1
fi

log "🚀 Iniciando setup da VPS Hostinger MVK 4 para Seu Zélla..."
echo ""

# ─── 1. Atualizar sistema ───────────────────────────────────────────────────
log "1/10 — Atualizando sistema..."
apt update -y
apt upgrade -y
DEBIAN_FRONTEND=noninteractive apt install -y \
  curl wget git build-essential \
  nginx ufw fail2ban \
  postgresql postgresql-contrib \
  software-properties-common \
  htop vim unzip \
  certbot python3-certbot-nginx
echo "  ✅ Sistema atualizado e pacotes base instalados"
echo ""

# ─── 2. Configurar firewall (UFW) ──────────────────────────────────────────
log "2/10 — Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  ✅ Firewall ativo (SSH 22, HTTP 80, HTTPS 443)"
echo ""

# ─── 3. Instalar Node.js 22 ─────────────────────────────────────────────────
log "3/10 — Instalando Node.js 22..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != "v22"* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi
echo "  ✅ Node.js $(node -v) instalado"
echo ""

# ─── 4. Instalar Bun ────────────────────────────────────────────────────────
log "4/10 — Instalando Bun..."
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
  echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
  export PATH="$HOME/.bun/bin:$PATH"
fi
BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
echo "  ✅ Bun ${BUN_VERSION} instalado"
echo ""

# ─── 5. Instalar PM2 ────────────────────────────────────────────────────────
log "5/10 — Instalando PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi
echo "  ✅ PM2 $(pm2 --version) instalado"
echo ""

# ─── 6. Configurar PostgreSQL ───────────────────────────────────────────────
log "6/10 — Configurando PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Gerar senha aleatória para o DB user
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# Criar usuário e database
sudo -u postgres psql << EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'seuzella') THEN
    CREATE USER seuzella WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;

SELECT 'CREATE DATABASE seuzella_prod OWNER seuzella'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'seuzella_prod')\gexec

GRANT ALL PRIVILEGES ON DATABASE seuzella_prod TO seuzella;
ALTER USER seuzella WITH SUPERUSER;
EOF

# Salvar senha em arquivo seguro para consulta posterior
echo "DATABASE_URL=postgresql://seuzella:${DB_PASSWORD}@localhost:5432/seuzella_prod?schema=public" > /root/seuzella-db-credentials.txt
chmod 600 /root/seuzella-db-credentials.txt
echo "  ✅ PostgreSQL configurado"
echo "  📋 Credenciais salvas em /root/seuzella-db-credentials.txt (root-only)"
echo "  🔑 DATABASE_URL: postgresql://seuzella:****@localhost:5432/seuzella_prod?schema=public"
echo ""

# ─── 7. Criar usuário deploy ───────────────────────────────────────────────
log "7/10 — Criando usuário deploy..."
if ! id "deploy" &>/dev/null; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
fi
mkdir -p /var/www/seuzella /var/log/seuzella/cron
chown -R deploy:deploy /var/www/seuzella /var/log/seuzella
echo "  ✅ Usuário deploy criado"
echo ""

# ─── 8. Configurar fail2ban (proteção SSH contra brute-force) ───────────────
log "8/10 — Configurando fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable fail2ban
systemctl restart fail2ban
echo "  ✅ fail2ban ativo (5 tentativas SSH = ban 1h)"
echo ""

# ─── 9. Otimizar sistema para produção ─────────────────────────────────────
log "9/10 — Otimizando sistema..."

# Aumentar limite de file descriptors
if ! grep -q "seuzella soft nofile" /etc/security/limits.conf; then
  echo "* soft nofile 65535" >> /etc/security/limits.conf
  echo "* hard nofile 65535" >> /etc/security/limits.conf
fi

# Configurar swappiness (reduzir uso de swap)
echo 10 > /proc/sys/vm/swappiness

# Habilitar IPv4 forwarding (necessário para Docker, etc)
if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi

# Timezone para São Paulo
timedatectl set-timezone America/Sao_Paulo

echo "  ✅ Limites de file descriptors: 65535"
echo "  ✅ Swappiness: 10"
echo "  ✅ Timezone: America/Sao_Paulo"
echo ""

# ─── 10. Resumo final ────────────────────────────────────────────────────────
log "10/10 — Resumo final..."
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "🎉 SETUP DA VPS HOSTINGER MVK 4 CONCLUÍDO!"
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "📦 Instalado:"
echo "   ✅ Node.js $(node -v)"
echo "   ✅ Bun $(bun --version)"
echo "   ✅ PM2 $(pm2 --version)"
echo "   ✅ PostgreSQL $(psql --version | awk '{print $3}')"
echo "   ✅ nginx $(nginx -v 2>&1 | cut -d/ -f2)"
echo "   ✅ certbot (Let's Encrypt)"
echo "   ✅ UFW firewall ativo"
echo "   ✅ fail2ban (proteção SSH)"
echo ""
echo "🗄️  Banco de dados:"
echo "   User: seuzella"
echo "   Database: seuzella_prod"
echo "   Credenciais: /root/seuzella-db-credentials.txt"
echo ""
echo "👤 Usuário para deploy:"
echo "   deploy (com sudo)"
echo ""
echo "📁 Diretórios criados:"
echo "   /var/www/seuzella (app)"
echo "   /var/log/seuzella/cron/ (logs dos crons)"
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "🚀 PRÓXIMOS PASSOS:"
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "1. Configurar DNS do domínio para apontar para esta VPS"
echo ""
echo "2. Clonar repo:"
echo "   sudo -u deploy git clone https://github.com/MarcioCau14/SmartHotel_Zehla.git /var/www/seuzella"
echo ""
echo "3. Configurar .env.production:"
echo "   cd /var/www/seuzella"
echo "   sudo -u deploy cp deploy/.env.example .env.production"
echo "   sudo -u deploy nano .env.production"
echo "   (PEGAR A DATABASE_URL DE /root/seuzella-db-credentials.txt)"
echo ""
echo "4. Rodar deploy script:"
echo "   sudo bash deploy/deploy-vps.sh"
echo ""
echo "══════════════════════════════════════════════════════════════════════"
