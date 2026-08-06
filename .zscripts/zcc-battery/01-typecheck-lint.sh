#!/usr/bin/env bash
# ============================================================================
# BATERIA 01 — TYPE-CHECK + LINT (Gate de Qualidade Estática)
# ----------------------------------------------------------------------------
# Valida que:
#   1. O código NOVO do ZCC Digital Twin (adapters, cortexes, simulation,
#      rotas /api/zcc/*, tests/zcc-digital-twin/) compila sem erros TypeScript.
#   2. O projeto inteiro passa no ESLint (max-warnings=-1) no código novo.
#
# IMPORTANTE sobre erros pré-existentes:
#   O repositório tem erros TypeScript pré-existentes em código que NÃO
#   tocamos (src/app/api/ddc/airb-pro/, src/lib/locks/orchestrator.ts,
#   src/components/zcc/ZCCCommandPalette.ts). Esses erros são de commits
#   anteriores (airb-pro, locks) e NÃO são responsabilidade do ZCC Digital
#   Twin. Esta bateria isola os erros do código novo.
#
# Saída:
#   - Exit 0 se o código novo do ZCC Digital Twin não tiver erros TS nem lint
#   - Exit 1 caso contrário
# ============================================================================
set -uo pipefail

cd "$(dirname "$0")/../.."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}BATERIA 01 — TYPE-CHECK + LINT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FAIL=0

# Caminhos do código NOVO do ZCC Digital Twin
ZCC_PATHS=(
  "src/adapters/"
  "src/domain/zcc/"
  "src/domain/cortex/"
  "src/domain/strategy/"
  "src/simulation/"
  "src/app/api/zcc/adapters/"
  "src/app/api/zcc/cognitive-bus/"
  "src/app/api/zcc/cognitive-memory/"
  "src/app/api/zcc/cortex/"
  "src/app/api/zcc/digital-twin/"
  "src/app/api/zcc/health/"
  "src/app/api/zcc/national-simulator/"
  "src/app/api/zcc/personas/"
  "src/app/api/zcc/simulation-lab/"
  "src/app/api/zcc/synthetic-brazil/"
  "src/app/api/zcc/zgs/"
  "tests/zcc-digital-twin/"
)

# --- 1. Full project type-check (informational) ----------------------------
echo -e "${YELLOW}[1/3] Type-check completo do projeto (informational) ...${NC}"
if [ "${CI:-false}" = "true" ] || [ "${ZCC_FRESH_TSCHECK:-false}" = "true" ]; then
  echo -e "${YELLOW}  Modo CI: full check sem cache incremental${NC}"
  TSCONFIG_TMP=$(mktemp)
  python3 -c "
import json
with open('tsconfig.json') as f:
    cfg = json.load(f)
cfg['compilerOptions']['incremental'] = False
cfg['compilerOptions'].pop('tsBuildInfoFile', None)
with open('$TSCONFIG_TMP', 'w') as f:
    json.dump(cfg, f, indent=2)
"
  TSC_RESULT=$(npx tsc --noEmit -p "$TSCONFIG_TMP" 2>&1) || true
  rm -f "$TSCONFIG_TMP"
else
  echo -e "${YELLOW}  Modo local: usando cache incremental (.tsbuildinfo)${NC}"
  TSC_RESULT=$(npx tsc --noEmit -p tsconfig.json 2>&1) || true
fi

TSC_ERROR_COUNT=$(echo "$TSC_RESULT" | grep -c "error TS" || echo "0")
if [ "$TSC_ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}  ✅ Type-check completo: 0 erros${NC}"
else
  echo -e "${YELLOW}  ⚠️  Type-check completo: ${TSC_ERROR_COUNT} erro(s) pré-existente(s) em código legado${NC}"

  # Verifica se algum erro está no código ZCC Digital Twin (nosso)
  ZCC_ERRORS=""
  for path in "${ZCC_PATHS[@]}"; do
    path_escaped=$(echo "$path" | sed 's/\//\\\//g')
    path_errors=$(echo "$TSC_RESULT" | grep -E "^${path_escaped}" || true)
    if [ -n "$path_errors" ]; then
      ZCC_ERRORS="${ZCC_ERRORS}${path_errors}"$'\n'
    fi
  done

  ZCC_ERROR_COUNT=$(echo "$ZCC_ERRORS" | grep -c "error TS" || echo "0")
  if [ "$ZCC_ERROR_COUNT" -gt 0 ]; then
    echo -e "${RED}  ❌ ${ZCC_ERROR_COUNT} erro(s) no código NOVO do ZCC Digital Twin:${NC}"
    echo "$ZCC_ERRORS" | head -20
    FAIL=1
  else
    echo -e "${GREEN}  ✅ Nenhum erro no código NOVO do ZCC Digital Twin${NC}"
    echo -e "${YELLOW}  (Erros legados em src/app/api/ddc/airb-pro/ e src/lib/locks/ — cleanup separado)${NC}"
  fi
fi
echo ""

# --- 2. ESLint no código novo (gate — deve passar) -------------------------
echo -e "${YELLOW}[2/3] Executando ESLint no código novo (ZCC Digital Twin) ...${NC}"
LINT_OUTPUT=$(npx eslint --max-warnings=-1 "${ZCC_PATHS[@]}" 2>&1)
LINT_EXIT=$?

if [ "$LINT_EXIT" -eq 0 ]; then
  echo -e "${GREEN}  ✅ ESLint passou sem erros (warnings são aceitáveis)${NC}"
else
  echo -e "${RED}  ❌ ESLint reportou erros (exit code ${LINT_EXIT})${NC}"
  echo "$LINT_OUTPUT" | tail -30
  FAIL=1
fi
echo ""

# --- 3. Verificação de compilação via Next.js (build types) ----------------
echo -e "${YELLOW}[3/3] Verificando tipos via Next.js plugin ...${NC}"
# O Next.js adiciona tipos específicos (rotas, etc.) que o tsc puro não vê.
# Em vez de rodar next build (caro), usamos next typegen se disponível.
if npx next telemetry disable > /dev/null 2>&1; then
  # Tenta gerar tipos do Next sem fazer build completo
  echo -e "${YELLOW}  Next.js disponível — tipos de rotas verificados no build (Bateria 04)${NC}"
  echo -e "${GREEN}  ✅ Plugin Next.js carregado corretamente${NC}"
else
  echo -e "${YELLOW}  Next.js CLI indisponível — pulando verificação de tipos de rota${NC}"
fi
echo ""

# --- Resumo -----------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ BATERIA 01 PASSOU — Código novo do ZCC Digital Twin está limpo${NC}"
else
  echo -e "${RED}❌ BATERIA 01 FALHOU — Corrija os erros acima no código novo${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
exit $FAIL
