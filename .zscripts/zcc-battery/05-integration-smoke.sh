#!/usr/bin/env bash
# ============================================================================
# BATERIA 05 — SMOKE TEST INTEGRADO (Boot Digital Twin + API + Experimento)
# ----------------------------------------------------------------------------
# Bateria final de ponta a ponta. Boa o servidor Next.js em modo produção
# (build standalone) ou dev, e exercita as 11+ rotas do ZCC Digital Twin
# para garantir que toda a stack cognitiva está realmente funcionando em
# runtime — não apenas em testes isolados.
#
# Cobertura:
#   1. POST /api/zcc/digital-twin        → boot do stack cognitivo
#   2. GET  /api/zcc/health              → snapshot completo (ZCB + cortexes)
#   3. GET  /api/zcc/cortex              → 8 cortexes registrados
#   4. GET  /api/zcc/adapters            → registry defaults to digital-twin
#   5. GET  /api/zcc/personas            → 6 personas carregadas
#   6. GET  /api/zcc/synthetic-brazil    → cidades sintéticas disponíveis
#   7. POST /api/zcc/synthetic-brazil/generate → gera slice (cidade)
#   8. GET  /api/zcc/national-simulator  → cidades-âncora
#   9. POST /api/zcc/national-simulator  → roda simulação em uma cidade
#  10. POST /api/zcc/simulation-lab      → roda experimento (verdict)
#  11. GET  /api/zcc/cognitive-bus       → eventos publicados no ZCB
#  12. GET  /api/zcc/cognitive-memory    → knowledge entries
#  13. GET  /api/zcc/zgs/decisions       → decisões estratégicas emitidas
#
# Saída:
#   - Exit 0 se todas as 13 chamadas responderem 2xx
#   - Exit 1 se qualquer endpoint falhar
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/../.."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuração
PORT="${PORT:-3999}"
BASE="http://localhost:${PORT}"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Mata qualquer processo que ainda esteja ouvindo na porta
  fuser -k "${PORT}/tcp" 2>/dev/null || true
}
trap cleanup EXIT

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}BATERIA 05 — SMOKE TEST INTEGRADO (Runtime)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FAIL=0
PASS=0

# Helper: faz request e valida status code
check() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local data="${4:-}"
  local label="$method $path"

  local response
  local status
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}" \
                -H "Content-Type: application/json" \
                -d "$data" 2>&1) || true
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}" 2>&1) || true
  fi
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$status" =~ ^${expected} ]]; then
    echo -e "${GREEN}  ✅ ${label} → ${status}${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}  ❌ ${label} → ${status} (esperado ${expected})${NC}"
    echo -e "${RED}     Body: $(echo "$body" | head -c 200)${NC}"
    FAIL=$((FAIL + 1))
  fi
}

# ----------------------------------------------------------------------------
# 1. Subir o servidor Next.js (dev mode — não requer build prévio)
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[SETUP] Subindo Next.js em :${PORT} (dev mode) ...${NC}"
fuser -k "${PORT}/tcp" 2>/dev/null || true
sleep 1

DATABASE_URL="${DATABASE_URL:-file:./dev.db}" \
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-zcc-test-smoke-secret-key-32chars!!}" \
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${PORT}}" \
PORT="$PORT" \
npx next dev -p "$PORT" > /tmp/zcc-smoke-server.log 2>&1 &
PIDS+=($!)

echo -e "${YELLOW}  Aguardando servidor responder (até 60s) ...${NC}"
for i in $(seq 1 60); do
  if curl -sf "${BASE}/api/zcc/health" > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ Servidor respondeu após ${i}s${NC}"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo -e "${RED}  ❌ Servidor não respondeu em 60s${NC}"
    echo -e "${RED}     Últimas 30 linhas do log:${NC}"
    tail -30 /tmp/zcc-smoke-server.log
    exit 1
  fi
  sleep 1
done
echo ""

# ----------------------------------------------------------------------------
# 2. Exercitar as 13 rotas
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[RUN] Exercitando rotas do ZCC Digital Twin ...${NC}"
echo ""

# 1. Boot do Digital Twin
check POST "/api/zcc/digital-twin" "200" '{"action":"boot"}'
sleep 1

# 2. Health snapshot
check GET "/api/zcc/health" "200"

# 3. Cortexes snapshot
check GET "/api/zcc/cortex" "200"

# 4. Adapter registry
check GET "/api/zcc/adapters" "200"

# 5. Personas
check GET "/api/zcc/personas" "200"

# 6. Synthetic Brazil — lista de cidades
check GET "/api/zcc/synthetic-brazil" "200"

# 7. Synthetic Brazil — gerar slice
check POST "/api/zcc/synthetic-brazil/generate" "200" '{"cityId":"praia-grande-sp","seed":42}'

# 8. National Simulator — cidades disponíveis
check GET "/api/zcc/national-simulator" "200"

# 9. National Simulator — rodar em uma cidade
check POST "/api/zcc/national-simulator" "200" '{"cityId":"gramado-rs","days":7,"seed":42}'

# 10. Simulation Lab — rodar experimento
check POST "/api/zcc/simulation-lab" "200" '{"hypothesis":"ZGS budget reallocation Google→Meta","events":1000,"seed":42}'

# 11. Cognitive Bus — eventos publicados
check GET "/api/zcc/cognitive-bus" "200"

# 12. Cognitive Memory — knowledge entries
check GET "/api/zcc/cognitive-memory" "200"

# 13. ZGS decisions
check GET "/api/zcc/zgs/decisions" "200"

# ----------------------------------------------------------------------------
# 3. Resumo
# ----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Passaram: ${PASS}${NC}"
echo -e "${YELLOW}  Falharam: ${FAIL}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ BATERIA 05 PASSOU — Stack cognitiva operacional em runtime${NC}"
  echo ""
  echo -e "${BLUE}Log completo do servidor: /tmp/zcc-smoke-server.log${NC}"
  exit 0
else
  echo -e "${RED}❌ BATERIA 05 FALHOU — Endpoints com problema${NC}"
  echo ""
  echo -e "${RED}Últimas 50 linhas do log do servidor:${NC}"
  tail -50 /tmp/zcc-smoke-server.log
  exit 1
fi
