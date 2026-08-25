# Payment Webhook Idempotency Validation
#
# Objetivo: Validar que webhooks duplicados NÃO criam transações duplicadas
# e que webhooks com paymentId de outro tenant são rejeitados.
#
# Testes:
#   1. Primeiro webhook → 200 (cria transação)
#   2. Webhook duplicado (mesmo paymentId) → 200 com duplicate=true
#   3. Webhook com paymentId de outro tenant → 409 (PAYMENT_TENANT_MISMATCH)
#
# Este script assina o payload com HMAC-SHA256 (Asaas format) e envia
# para o endpoint /api/webhooks/asaas.
