#!/usr/bin/env bash
# ============================================================================
# BATERIA MASTER — Roda as 5 baterias em sequência
# ----------------------------------------------------------------------------
# Orquestrador que executa todas as 5 baterias na ordem correta:
#   01. Type-check + Lint            (~10s)
#   02. Testes ZCC Digital Twin      (~5s)
#   03. Suíte completa (185 testes)  (~40s)
#   04. Build de produção            (~3min)
#   05. Smoke test integrado         (~30s)
#
# Comportamento:
#   - Se uma bateria falha, as subsequentes ainda rodam (para você ver todos
#     os problemas de uma vez)
#   - Ao final, imprime um dashboard consolidado
#   - Exit 0 somente se TODAS passarem
#
# Uso:
#   ./.zscripts/zcc-battery/run-all.sh
#   ./.zscripts/zcc-battery/run-all.sh --skip-build   # pula bateria 04
#   ./.zscripts/zcc-battery/run-all.sh --only 02      # roda só a bateria 02
# ============================================================================
set -uo pipefail

cd "$(dirname "$0")"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Argumentos
SKIP_BUILD=false
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    *) echo "Arg desconhecido: $1"; exit 1 ;;
  esac
done

# Lista de baterias
BATTERIES=(
  "01-typecheck-lint.sh"
  "02-zcc-digital-twin-tests.sh"
  "03-full-regression-suite.sh"
  "04-production-build.sh"
  "05-integration-smoke.sh"
)

# Se --only, filtra
if [ -n "$ONLY" ]; then
  BATTERIES=("${ONLY}-"*)
  # Resolve para o arquivo correspondente
  BATTERIES=($(ls ${BATTERIES[@]} 2>/dev/null))
  if [ ${#BATTERIES[@]} -eq 0 ]; then
    echo -e "${RED}Bateria ${ONLY} não encontrada${NC}"
    exit 1
  fi
fi

# Se --skip-build, remove a bateria 04
if $SKIP_BUILD; then
  NEW_BATTERIES=()
  for b in "${BATTERIES[@]}"; do
    if [[ "$b" != "04-"* ]]; then
      NEW_BATTERIES+=("$b")
    fi
  done
  BATTERIES=("${NEW_BATTERIES[@]}")
fi

# Estado
declare -A RESULTS
declare -A DURATIONS
TOTAL_START=$(date +%s)

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         ZCC DIGITAL TWIN — BATERIA DE TESTES CI/CD              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${YELLOW}Iniciando em: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${YELLOW}Baterias a executar: ${#BATTERIES[@]}${NC}"
echo ""

# Roda cada bateria
for battery in "${BATTERIES[@]}"; do
  name="${battery%%.*}"
  echo -e "${BOLD}${BLUE}▶ Executando: ${name}${NC}"
  echo -e "${BLUE}  Script: ${battery}${NC}"

  START=$(date +%s)
  if bash "$battery"; then
    RESULTS["$battery"]="PASS"
  else
    RESULTS["$battery"]="FAIL"
  fi
  END=$(date +%s)
  DURATIONS["$battery"]=$((END - START))

  echo ""
done

TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

# Dashboard final
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║                       DASHBOARD FINAL                           ║${NC}"
echo -e "${BOLD}${BLUE}╠══════════════════════════════════════════════════════════════════╣${NC}"
for battery in "${BATTERIES[@]}"; do
  name="${battery%%.*}"
  status="${RESULTS[$battery]}"
  dur="${DURATIONS[$battery]}"
  if [ "$status" = "PASS" ]; then
    marker="${GREEN}✅ PASS${NC}"
  else
    marker="${RED}❌ FAIL${NC}"
  fi
  printf "${BOLD}${BLUE}║${NC} %-45s %b  %4ss ${BOLD}${BLUE}║${NC}\n" "$name" "$marker" "$dur"
done
echo -e "${BOLD}${BLUE}╠══════════════════════════════════════════════════════════════════╣${NC}"
printf "${BOLD}${BLUE}║${NC} ${BOLD}Duração total:${NC} %52s ${BOLD}${BLUE}║${NC}\n" "${TOTAL_DURATION}s"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"

# Veredito final
TOTAL_FAIL=0
for battery in "${BATTERIES[@]}"; do
  if [ "${RESULTS[$battery]}" = "FAIL" ]; then
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
done

echo ""
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo -e "${BOLD}${GREEN}🎉 TODAS AS BATERIAS PASSARAM${NC}"
  echo -e "${GREEN}   ZCC Digital Twin está pronto para deploy${NC}"
  exit 0
else
  echo -e "${BOLD}${RED}🚨 ${TOTAL_FAIL} BATERIA(S) FALHARAM${NC}"
  echo -e "${RED}   Corrija antes de fazer deploy${NC}"
  exit 1
fi
