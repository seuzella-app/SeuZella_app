# Webhook Signature Bypass Validation
#
# Objetivo: Validar que TODOS os webhooks rejeitam requests sem assinatura HMAC válida.
#
# Testes:
#   1. POST /api/webhooks/asaas sem header → 401
#   2. POST /api/webhooks/asaas com assinatura inválida → 401
#   3. POST /api/webhooks/mercadopago sem header → 401
#   4. POST /api/webhooks/mercadopago com assinatura inválida → 401
#   5. POST /api/webhooks/stripe sem header → 401
#   6. POST /api/webhooks/stripe com timestamp antigo (replay) → 401
#   7. POST /api/webhooks/whatsapp sem header → 401
