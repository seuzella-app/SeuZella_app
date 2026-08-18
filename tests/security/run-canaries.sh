#!/usr/bin/env bash
# ============================================================
# V11-P0 Canary Runner
# ============================================================
# Roda os testes canários de isolamento multi-tenant + RLS
# pós-deploy da migration V11-P0.
#
# Uso:
#   ./run_canaries.sh                # ambiente dev (SQLite)
#   ./run_canaries.sh --prod         # ambiente prod (PostgreSQL)
#   ./run_canaries.sh --ci           # CI mode (exit code matters)
# ============================================================

set -euo pipefail

REPO_ROOT="/home/z/my-project/zella"
CANARIES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/rls_canaries.test.ts"
TARGET_TEST="${REPO_ROOT}/tests/security/rls-canaries.test.ts"

MODE="${1:-dev}"

cd "${REPO_ROOT}"

echo "==> [1/4] Verifica pré-requisitos"

if [[ ! -f "${CANARIES_FILE}" ]]; then
  echo "ERRO: ${CANARIES_FILE} não encontrado"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "ERRO: npx não encontrado"
  exit 1
fi

# Verifica que a migration V11-P0 foi aplicada
echo "==> [2/4] Verifica que migration V11-P0 foi aplicada"

if ! npx prisma migrate status 2>&1 | grep -q "v11_p0"; then
  echo "ERRO: Migration V11-P0 não encontrada no histórico."
  echo "      Aplique primeiro: ./01_migration/apply_migration.sh"
  exit 1
fi

# Copia o arquivo de canário para o local canônico de testes
echo "==> [3/4] Instala canário em tests/security/"

mkdir -p "${REPO_ROOT}/tests/security"
cp "${CANARIES_FILE}" "${TARGET_TEST}"

# Determina provider
PROVIDER="sqlite"
if [[ "${MODE}" == "--prod" ]]; then
  PROVIDER="postgres"
  export DATABASE_PROVIDER="postgres"
  echo "    Modo: PostgreSQL prod (RLS tests ativos)"
elif [[ "${MODE}" == "--ci" ]]; then
  export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
  PROVIDER="${DATABASE_PROVIDER}"
  echo "    Modo: CI (provider=${PROVIDER})"
else
  export DATABASE_PROVIDER="sqlite"
  echo "    Modo: dev SQLite (RLS tests serão skipped)"
fi

# Executa
echo "==> [4/4] Executa canários"

set +e
if [[ "${MODE}" == "--ci" ]]; then
  npx vitest run tests/security/rls-canaries.test.ts --reporter=verbose
  EXIT_CODE=$?
else
  npx vitest run tests/security/rls-canaries.test.ts --reporter=verbose
  EXIT_CODE=$?
fi
set -e

# Reporta
echo ""
echo "==============================="
if [[ ${EXIT_CODE} -eq 0 ]]; then
  echo "✅ Canários V11-P0: PASS"
  echo ""
  echo "Validado:"
  echo "  - PolicyAudit multi-tenant isolation"
  echo "  - CompiledPrompt multi-tenant isolation"
  echo "  - Schema invariants (10 campos CompiledPrompt, 14 PolicyAudit)"
  echo "  - CHECK constraints (severity, entry_point)"
  if [[ "${PROVIDER}" == "postgres" ]]; then
    echo "  - PostgreSQL RLS ativa em policy_audit"
    echo "  - SET app.current_tenant_id isola queries"
  else
    echo "  - (RLS tests skipped — provider=sqlite)"
  fi
else
  echo "❌ Canários V11-P0: FAIL"
  echo ""
  echo "Ação recomendada:"
  echo "  1. Verifique que a migration foi aplicada corretamente"
  echo "  2. Verifique que o Prisma Client foi regenerado (npx prisma generate)"
  echo "  3. Em Postgres, verifique que RLS está ativa (\\d+ policy_audit)"
  echo "  4. Em caso de vazamento cross-tenant, NÃO FAÇA deploy — bloqueie release"
fi
echo "==============================="

exit ${EXIT_CODE}
