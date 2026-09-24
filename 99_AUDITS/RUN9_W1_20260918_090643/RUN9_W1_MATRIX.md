# RUN9-W1 — MATRIZ DE EVIDÊNCIAS (Billing / Revenue / ASAAS)

Data: 2026-09-18 12:06:43 | leitura pura, nada modificado

## Totais
- rotas API: 311 | rotas de billing: 30 | webhooks: 9
- arquivos ASAAS: 43 | models de billing: 8
- chaves env ASAAS (nomes): ASAAS_ACCESS_TOKEN, ASAAS_ENVIRONMENT, ASAAS_WEBHOOK_SECRET, ASAAS_API_KEY, ASAAS_ALLOW_LEGACY_TOKEN

## Findings
- [P2] 9C — webhook com assinatura mas sem sinal de idempotência (externalId/eventId/upsert) :: src/app/api/webhooks/booking-com/reviews/route.ts
- [P1] 9C — webhook sem sinal de verificação de assinatura/token :: src/app/api/zcc/airbnb/webhook/route.ts
- [P1] 9D — campo monetário como Float em model de billing (Transaction) :: Transaction: amount
- [P1] 9D — campo monetário como Float em model de billing (Subscription) :: Subscription: amount, lastProrateAmount
- [P1] 9D — campo monetário como Float em model de billing (PaymentTransaction) :: PaymentTransaction: amount
- [P1] 9D — campo monetário como Float em model de billing (AirBSubscription) :: AirBSubscription: amount
- [P1] 9D — campo monetário como Float em model de billing (AirBTransaction) :: AirBTransaction: amount
- [P3] 9D — parseFloat/Number() sobre valores monetários em código de billing (revisar arredondamento em centavos) :: src/app/api/webhooks/payment/route.ts(2), src/lib/payments/mercadopago-service.ts(2), src/app/api/checkout/webhook/route.ts(1), src/app/api/cron/monthly-billing/route.ts(1), src/app/api/cron/payment-overdue/route.ts(1)

## Webhooks (9C)
- src/app/api/checkout/webhook/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/webhook-whatsapp/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/webhooks/asaas/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/webhooks/booking-com/reviews/route.ts | assinatura: OK | idempotência: AUSENTE | $transaction: não | raw body: sim
- src/app/api/webhooks/mercadopago/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/webhooks/payment/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/webhooks/whatsapp/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim
- src/app/api/zcc/airbnb/webhook/route.ts | assinatura: AUSENTE | idempotência: AUSENTE | $transaction: não | raw body: não
- src/app/api/zcc/github/webhook/route.ts | assinatura: OK | idempotência: OK | $transaction: não | raw body: sim

## Models de billing (9D)
- Transaction | **Float money: amount**
- Subscription | **Float money: amount, lastProrateAmount**
- PaymentTransaction | **Float money: amount**
- PushSubscription | money ok
- AirBSubscription | **Float money: amount**
- AirBTransaction | **Float money: amount**
- AmortizationCredit | money ok
- BillingIdempotency | money ok

## Próximo passo
- RUN9-W2: patches 9A-9E sobre estas evidências (mesmo padrão RUN8-W2).
