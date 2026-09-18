#!/bin/bash
# ==============================================================================
# SEU ZELLA — Script de Deploy VPS (Hostinger)
# ==============================================================================
# Uso:  chmod +x deploy-vps.sh && ./deploy-vps.sh
# Pré:  Docker + Docker Compose instalados na VPS
#
# NOTA (RUN 5 — Migration Gate): script LEGADO de bring-up Docker (bootstrap).
# Fluxo OFICIAL de produção: deploy/deploy-vps.sh (migrate deploy) e
# scripts/deploy-mvk4.sh (migrate deploy fail-closed). A inicialização de banco
# abaixo é BOOTSTRAP-ONLY: deve rodar apenas contra banco VAZIO. O passo db
# push é fail-closed (sem --accept-data-loss): em banco não-vazio com drift ele
# FALHA e o script aborta — nunca destrói dados silenciosamente.
# ==============================================================================

set -euo pipefail

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║  SEU ZELLA — Deploy VPS Hostinger               ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Verificações ───────────────────────────────────────────────────────────────
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ $1 não encontrado. Instale antes de prosseguir.${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓${RESET} $1 encontrado"
}

echo -e "${BOLD}Verificando pré-requisitos...${RESET}"
check_command docker
check_command docker compose

# ── Verificar .env ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠ Arquivo .env não encontrado.${RESET}"
  echo -e "  Copiando .env.example para .env..."
  cp .env.example .env
  echo -e "${RED}✗ EDITE o arquivo .env com seus valores reais antes de continuar!${RESET}"
  echo -e "  nano .env"
  exit 1
fi

# ── Verificar variáveis obrigatórias ──────────────────────────────────────────
echo ""
echo -e "${BOLD}Verificando variáveis de ambiente...${RESET}"

REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
MISSING=0

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=\"\"" .env 2>/dev/null || ! grep -q "^${var}=" .env 2>/dev/null; then
    echo -e "  ${RED}✗${RESET} ${var} não configurada"
    MISSING=1
  else
    echo -e "  ${GREEN}✓${RESET} ${var} configurada"
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo -e "\n${RED}✗ Variáveis obrigatórias faltando. Edite .env e rode novamente.${RESET}"
  exit 1
fi

# ── Build ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══ Build do Container Docker ═══${RESET}\n"

docker compose build --no-cache app

echo ""
echo -e "${GREEN}✓ Build concluído${RESET}"

# ── Inicializar banco ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══ Inicializando Banco de Dados ═══${RESET}\n"

# Subir temporariamente para rodar prisma db push
docker compose up -d app
sleep 5

# Rodar prisma db push dentro do container (RUN 5: fail-closed, bootstrap-only)
# Em banco VAZIO: cria o schema — comportamento idêntico ao anterior.
# Em banco NÃO-vazio (rerun com drift): o Prisma FALHA em vez de destruir dados
# (--accept-data-loss REMOVIDO; stderr NÃO é mais silenciado) e o script
# aborta antes de qualquer operação potencialmente destrutiva.
docker compose exec app npx prisma db push || {
  echo -e "${RED}❌ CRÍTICO: prisma db push FALHOU — bootstrap ABORTADO (fail-closed, RUN 5).${RESET}"
  echo -e "${RED}   Causas prováveis: banco não-vazio com drift de schema, ou erro real de conexão.${RESET}"
  echo -e "${RED}   NUNCA contorne com --accept-data-loss: isso pode destruir dados em produção.${RESET}"
  echo -e "${RED}   Fluxo oficial para banco já inicializado: scripts/deploy-mvk4.sh (migrate deploy).${RESET}"
  exit 1
}

# Rodar seed se existir
docker compose exec app npx prisma db seed 2>/dev/null || {
  echo -e "${YELLOW}⚠ Seed falhou ou não configurado — pulando${RESET}"
}

echo -e "${GREEN}✓ Banco inicializado${RESET}"

# ── Inicializar Modelos do Ollama AI ─────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══ Verificando Modelos de IA (Ollama) ═══${RESET}\n"

docker compose up -d ollama
sleep 3

echo -e "${BOLD}Garantindo modelos de IA de alta capacidade (KVM 4+)...${RESET}"
docker compose exec ollama ollama pull qwen2.5-coder:14b 2>/dev/null || {
  echo -e "${YELLOW}⚠ Pull do qwen2.5-coder:14b em andamento ou modelo padrão ativado${RESET}"
}
docker compose exec ollama ollama pull deepseek-r1:14b 2>/dev/null || {
  echo -e "${YELLOW}⚠ Pull do deepseek-r1:14b em andamento ou modelo de raciocínio ativado${RESET}"
}

echo -e "${GREEN}✓ Motor Ollama AI configurado${RESET}"

# ── Restart limpo ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══ Reiniciando Container ═══${RESET}\n"

docker compose restart app

# ── Verificar saúde ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Verificando saúde do container...${RESET}"

for i in {1..10}; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Aplicação saudável (tentativa ${i})${RESET}"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo -e "${RED}✗ Aplicação não respondeu após 10 tentativas${RESET}"
    echo -e "  Verifique: docker compose logs app"
    exit 1
  fi
  echo -e "  Tentativa ${i}/10 — aguardando..."
  sleep 3
done

# ── Relatório ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  DEPLOY CONCLUÍDO COM SUCESSO${RESET}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Container:  ${GREEN}seuzella-app${RESET}"
echo -e "  Porta:      ${GREEN}3000${RESET} (localhost only — Nginx proxy)"
echo -e "  Health:     ${GREEN}http://localhost:3000/api/health${RESET}"
echo ""
echo -e "  ${BOLD}Próximos passos:${RESET}"
echo -e "  1. Configure o Nginx:  cp nginx/seuzella.conf /etc/nginx/sites-available/"
echo -e "  2. Ative o site:       ln -s /etc/nginx/sites-available/seuzella.conf /etc/nginx/sites-enabled/"
echo -e "  3. Teste config:       nginx -t"
echo -e "  4. Reload Nginx:       systemctl reload nginx"
echo -e "  5. Certificado SSL:    certbot --nginx -d seuzella.com -d www.seuzella.com"
echo -e "  6. Teste estresse:     node stress-test-seuzella.js --url https://seuzella.com"
echo ""
