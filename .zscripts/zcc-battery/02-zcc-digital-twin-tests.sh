#!/usr/bin/env bash
# ============================================================================
# BATERIA 02 — TESTES UNITÁRIOS DO ZCC DIGITAL TWIN (18 testes isolados)
# ----------------------------------------------------------------------------
# Roda exclusivamente os 18 testes da suíte ZCC Digital Twin (em
# tests/zcc-digital-twin/). São os testes que validam diretamente tudo que
# construímos:
#
# Cobertura (digital-twin.test.ts — 8 testes):
#   - ZCB roteia eventos por tipo
#   - Growth Cortex ingere CAC por canal
#   - Knowledge publication com versionamento
#   - Ciclo completo de Learning Pipeline (8 estágios)
#   - Behavioral Engine: impulsive converte mais que skeptical
#   - Simulation Lab emite verdict (approved/rejected/inconclusive)
#
# Cobertura (adapter-swap.test.ts — 10 testes):
#   - Registry defaults to digital-twin
#   - Env var ZELLA_ADAPTER_* sobrescreve por adapter
#   - Global production mode via ZELLA_ADAPTER_GLOBAL=production
#   - Mock contract compliance (CTR/CPC/CPA dentro de faixa estatística)
#   - Mock reproducibility (mesma seed → mesmo resultado)
#
# Saída:
#   - Exit 0 se os 18 testes passarem
#   - Exit 1 se qualquer teste falhar
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/../.."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}BATERIA 02 — TESTES UNITÁRIOS DO ZCC DIGITAL TWIN${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}Executando vitest run tests/zcc-digital-twin/${NC}"
echo -e "${YELLOW}  Esperado: 2 arquivos, 18 testes, 0 falhas${NC}"
echo ""

if npx vitest run tests/zcc-digital-twin/ --reporter=verbose; then
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ BATERIA 02 PASSOU — 18 testes do ZCC Digital Twin OK${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 0
else
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ BATERIA 02 FALHOU — Testes do ZCC Digital Twin com falha${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi
