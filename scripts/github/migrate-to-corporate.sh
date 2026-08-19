#!/bin/bash
# ============================================================================
# MIGRAÇÃO DE CONTA CORPORATIVA — SmartHotel_Zehla
# ============================================================================
# Reescreve histórico Git de um repositório antigo (conta pessoal) para
# novo repositório em conta corporativa, atualizando autor/email via .mailmap.
#
# Ferramenta: git-filter-repo (sucessor oficial do git filter-branch)
#   Instalação: pip install git-filter-repo
#               ou apt install git-filter-repo
#
# Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 9)
#
# USO:
#   ./scripts/github/migrate-to-corporate.sh \
#     <repo-clone-url-antigo> \
#     <repo-clone-url-novo> \
#     <mailmap-file>
#
# EXEMPLO:
#   ./scripts/github/migrate-to-corporate.sh \
#     https://github.com/usuario-antigo/SmartHotel_Zehla.git \
#     https://github.com/empresa-corporativa/SmartHotel_Zehla.git \
#     ./scripts/github/mailmap.txt
#
# SAFETY:
#  - Backup automático (mirror clone) antes de tudo
#  - Verificação pós-rewriting (0 commits com email antigo)
#  - Push --mirror para repo NOVO (não sobrescreve antigo)
#  - Não deleta nada automaticamente
# ============================================================================

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()     { echo -e "${GREEN}[OK]${NC} $1"; }
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# ARGUMENTS
# ============================================================

if [ "$#" -ne 3 ]; then
  echo "Uso: $0 <repo-clone-url-antigo> <repo-clone-url-novo> <mailmap-file>"
  echo ""
  echo "Exemplo:"
  echo "  $0 \\"
  echo "    https://github.com/usuario-antigo/SmartHotel_Zehla.git \\"
  echo "    https://github.com/empresa-corporativa/SmartHotel_Zehla.git \\"
  echo "    ./scripts/github/mailmap.txt"
  exit 1
fi

OLD_REMOTE="$1"
NEW_REMOTE="$2"
MAILMAP="$3"

# ============================================================
# DEPENDÊNCIAS
# ============================================================

command -v git-filter-repo >/dev/null 2>&1 || {
  error "git-filter-repo não instalado. Instale com:\n  pip install git-filter-repo\n  # ou\n  apt install git-filter-repo"
}

[ -f "$MAILMAP" ] || error "Arquivo mailmap não encontrado: $MAILMAP"

# Verifica que mailmap não está vazio
[ -s "$MAILMAP" ] || error "Arquivo mailmap está vazio: $MAILMAP"

# ============================================================
# DIRETÓRIOS DE TRABALHO
# ============================================================

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORK_DIR="/tmp/migrate-$TIMESTAMP"
BACKUP_DIR="/tmp/backup-$TIMESTAMP"

echo ""
echo "============================================================"
echo -e "${BLUE}  MIGRAÇÃO DE CONTA CORPORATIVA — SmartHotel_Zehla${NC}"
echo "============================================================"
echo ""
info "Repo antigo: $OLD_REMOTE"
info "Repo novo:   $NEW_REMOTE"
info "Mailmap:     $MAILMAP"
info "Work dir:    $WORK_DIR"
info "Backup dir:  $BACKUP_DIR"
echo ""

read -p "Confirma migração? (digite SIM): " CONFIRM
[ "$CONFIRM" = "SIM" ] || { warn "Migração cancelada pelo usuário."; exit 0; }

# ============================================================
# PASSO 1: BACKUP ABSOLUTO
# ============================================================

echo ""
info "[1/6] Criando backup de segurança em $BACKUP_DIR ..."
git clone --mirror "$OLD_REMOTE" "$BACKUP_DIR"
log "Backup OK ($(du -sh "$BACKUP_DIR" | cut -f1))"

# ============================================================
# PASSO 2: CLONE DE TRABALHO
# ============================================================

info "[2/6] Clonando repositório para reescrita em $WORK_DIR ..."
git clone --mirror "$OLD_REMOTE" "$WORK_DIR"
cd "$WORK_DIR"

# ============================================================
# PASSO 3: COPIA MAILMAP
# ============================================================

info "[3/6] Copiando mailmap para o repositório ..."
cp "$MAILMAP" .mailmap
log "Mailmap copiado"

# Mostra mailmap para conferência
echo ""
info "Conteúdo do mailmap:"
echo "------"
cat .mailmap
echo "------"

# ============================================================
# PASSO 4: APLICA REESCRITA DE HISTÓRICO
# ============================================================

info "[4/6] Aplicando reescrita de histórico com git-filter-repo ..."
echo "  Isso pode demorar vários minutos em repos grandes..."

git filter-repo --mailmap .mailmap --force

log "Reescrita aplicada"

# ============================================================
# PASSO 5: VERIFICAÇÃO
# ============================================================

echo ""
info "[5/6] Verificando reescrita..."
echo ""
echo "=== Commits por autor (após reescrita) ==="
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn | head -20
echo ""

# Verifica se ainda há commits com email não-corporativo
# Ajuste o regex conforme domínios corporativos esperados
ALLOWED_DOMAINS="empresa\\.com|empresa\\.com\\.br|corporativo\\.com"
OLD_EMAILS=$(git log --all --format='%ae' | sort -u | grep -v -E "$ALLOWED_DOMAINS" || true)

if [ -n "$OLD_EMAILS" ]; then
  warn "Alguns commits ainda têm email não-corporativo:"
  echo "$OLD_EMAILS"
  echo ""
  warn "Revise o mailmap e re-execute."
  warn "Backup disponível em: $BACKUP_DIR"
  exit 1
fi

log "Verificação OK — todos os emails são corporativos"

# ============================================================
# PASSO 6: PUSH PARA NOVO REPOSITÓRIO
# ============================================================

info "[6/6] Push para novo repositório corporativo ..."

# Configura novo remote
git remote set-url origin "$NEW_REMOTE"

# Push --mirror envia todos os branches, tags, notes
git push --mirror "$NEW_REMOTE"

log "Push mirror concluído"

# ============================================================
# RESUMO FINAL
# ============================================================

echo ""
echo "============================================================"
echo -e "${GREEN}  MIGRAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "============================================================"
echo ""
info "Backup de segurança: $BACKUP_DIR"
info "Novo repositório: $NEW_REMOTE"
echo ""
info "PRÓXIMOS PASSOS:"
echo "  1. Verifique o novo repositório no GitHub (commits, branches, tags)"
echo "  2. Configure branch protection no novo repo (Settings → Branches)"
echo "  3. Atualize PatVault para apontar para novo repo:"
echo "     ZCC → Settings → GitHub Credentials → Edit"
echo "  4. Configure webhook no novo repo:"
echo "     Settings → Webhooks → Add webhook"
echo "     URL: https://zcc.seuzella.com/api/zcc/github/webhook"
echo "  5. Após confirmar tudo OK, pode arquivar o repo antigo (NÃO delete)"
echo "  6. Mantenha o backup em $BACKUP_DIR por 30 dias antes de deletar"
echo ""
warn "NÃO delete o repositório antigo por 30 dias (retenção de segurança)"
echo ""
