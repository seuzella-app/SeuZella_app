# Alexa JWT Bypass Validation
#
# Objetivo: Validar que o endpoint /api/alexa/smart-home rejeita tokens inválidos.
#
# Testes:
#   1. Request sem Bearer token → 401
#   2. Token com algoritmo "none" → 401
#   3. Token sem jti (JWT ID) → 401
#   4. Token sem iat (issued at) → 401
#   5. Token com iat >5min atrás (replay) → 401
#   6. Token com jti já usado (replay) → 401
#   7. Token sem tenantId → 401
#   8. Token sem scope smart_home:locks → 401
