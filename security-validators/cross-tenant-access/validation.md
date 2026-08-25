# Cross-Tenant Access Validation
#
# Objetivo: Validar que um tenant autenticado NÃO consegue acessar dados de outro tenant.
#
# Este script é executado pelo codex-security como custom validation.
# Ele inicia o servidor Next.js, cria 2 tenants de teste, e exercita
# cross-tenant access via HTTP real.
#
# Evidência coletada:
#   - anonymous: 401
#   - tenant_A own locks: 200 (apenas locks de A)
#   - tenant_A accessing tenant_B lock: 403/404
#   - tenant_B own locks: 200 (apenas locks de B)
#   - tenant_A creating booking with tenant_B guestId: 400

## Setup
1. Servidor Next.js rodando em http://127.0.0.1:3000
2. 2 tenants seedados: tenant_a@seuzella.com / tenant_b@seuzella.com
3. Cada tenant tem 1 lock device + 1 guest + 1 booking
4. Env vars: E2E_TENANT_A_PASSWORD, E2E_TENANT_B_PASSWORD, TENANT_B_LOCK_ID

## Comando
python3 security-validators/cross-tenant-access/validate.py --output ../security-reports/cross-tenant/evidence.json
