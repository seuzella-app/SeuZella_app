#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo "  🚀 SMART HOTEL ZÉLLA — VPS PRODUCTION PROVISIONING"
echo "========================================================"

echo "===> 1. Atualizando pacotes do sistema..."
apt-get update && apt-get upgrade -y
apt-get install -y curl ufw fail2ban unattended-upgrades ca-certificates gnupg lsb-release

echo "===> 2. Criando usuário de execução segura (não-root)..."
if ! id "zehla" &>/dev/null; then
    adduser --disabled-password --gecos "" zehla
    usermod -aG sudo zehla
fi

echo "===> 3. Hardening de Firewall (UFW)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Seguro'
ufw allow 80/tcp comment 'HTTP LetEncrypt'
ufw allow 443/tcp comment 'HTTPS TLS'
ufw --force enable

echo "===> 4. Configurando Docker seguro..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker zehla

echo "===> 5. Criando diretórios operacionais..."
mkdir -p /opt/zehla /opt/backups /opt/secrets
chown -R zehla:zehla /opt/zehla /opt/backups /opt/secrets
chmod 700 /opt/secrets

echo "========================================================"
echo "  ✅ Instalação e Hardening concluídos com sucesso!"
echo "========================================================"
