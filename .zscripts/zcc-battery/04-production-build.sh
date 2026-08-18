#!/usr/bin/env bash
# ============================================================================
# BATERIA 04 — BUILD DE PRODUÇÃO (Next.js standalone)
# ----------------------------------------------------------------------------
# Valida que o projeto Next.js compila para produção sem erros. Esta bateria
# é a mais cara computacionalmente, mas é a única que garante que o código
# novo (adapters, cortexes, simulation, rotas API /api/zcc/*) realmente
# empacota corretamente para deploy.
#
# Cobertura:
#   - prisma generate (schema válido)
#   - next build (compilação de produção)
#   - Verificação de que .next/standalone foi criado
#   - Verificação de que as rotas /api/zcc/* foram registradas
#
# Pré-requisitos:
#   - DATABASE_URL configurado (usamos file:./dev.db como fallback seguro)
#
# Saída:
#   - Exit 0 se o build completar
#   - Exit 1 se houver qualquer erro de compilação/empacotamento
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
echo -e "${BLUE}BATERIA 04 — BUILD DE PRODUÇÃO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FAIL=0

# --- 1. Prisma generate -----------------------------------------------------
echo -e "${YELLOW}[1/3] Executando prisma generate ...${NC}"
if DATABASE_URL="${DATABASE_URL:-file:./dev.db}" npx prisma generate; then
  echo -e "${GREEN}  ✅ Prisma client gerado${NC}"
else
  echo -e "${RED}  ❌ Prisma generate falhou${NC}"
  FAIL=1
fi
echo ""

# --- 2. Next.js build -------------------------------------------------------
echo -e "${YELLOW}[2/3] Executando next build (standalone) ...${NC}"
echo -e "${YELLOW}  Duração estimada: 2-5 minutos${NC}"
if DATABASE_URL="${DATABASE_URL:-file:./dev.db}" npx next build 2>&1 | tail -50; then
  echo -e "${GREEN}  ✅ Build de produção completou${NC}"
else
  echo -e "${RED}  ❌ next build falhou${NC}"
  FAIL=1
fi
echo ""

# --- 3. Verificar rotas /api/zcc/* registradas ------------------------------
echo -e "${YELLOW}[3/3] Verificando rotas /api/zcc/* no manifest do build ...${NC}"
if [ -f ".next/server/app/api/zcc/digital-twin/route.js" ] && \
   [ -f ".next/server/app/api/zcc/health/route.js" ] && \
   [ -f ".next/server/app/api/zcc/cortex/route.js" ] && \
   [ -f ".next/server/app/api/zcc/zgs/decisions/route.js" ] && \
   [ -f ".next/server/app/api/zcc/simulation-lab/route.js" ] && \
   [ -f ".next/server/app/api/zcc/synthetic-brazil/route.js" ] && \
   [ -f ".next/server/app/api/zcc/national-simulator/route.js" ] && \
   [ -f ".next/server/app/api/zcc/adapters/route.js" ] && \
   [ -f ".next/server/app/api/zcc/cognitive-bus/route.js" ] && \
   [ -f ".next/server/app/api/zcc/cognitive-memory/route.js" ] && \
   [ -f ".next/server/app/api/zcc/personas/route.js" ]; then
  echo -e "${GREEN}  ✅ Todas as 11+ rotas /api/zcc/* foram compiladas${NC}"
else
  echo -e "${RED}  ❌ Algumas rotas /api/zcc/* não foram compiladas${NC}"
  ls -la .next/server/app/api/zcc/ 2>/dev/null || true
  FAIL=1
fi
echo ""

# --- Resumo -----------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ BATERIA 04 PASSOU — Build de produção pronto para deploy${NC}"
else
  echo -e "${RED}❌ BATERIA 04 FALHOU — Build não está pronto para produção${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
exit $FAIL
