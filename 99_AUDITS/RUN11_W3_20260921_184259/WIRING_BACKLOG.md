# RUN11-W3 — BACKLOG DE FIAÇÃO (cruzamento plano × estado real)

Plano base: `/Users/marciocau/SeuZella_project/99_AUDITS/RUN11_W3_HARNESS_20260921_165432/WIRING_PLAN.json`
Propostas únicas: **122** (de 133 brutas, dedup por módulo+rota)

| Status | Qtde | Significado |
|---|---|---|
| WIRED | 3 | arquivo consome a camada W2 relevante (fiado nesta onda) |
| ALREADY_PROTECTED | 41 | proteção legada equivalente presente (rate-limit/shield/audit/queue/cache) |
| BACKLOG | 78 | alvo legítimo para RUN12/HYGIENE — validar semântica antes de fiar |

## audit — WIRED 1 / ALREADY_PROTECTED 2 / BACKLOG 28

| Status | Confiança | Rota | Racional |
|---|---|---|---|
| ALREADY_PROTECTED | high | `src/app/api/checkout/upgrade/route.ts` | mutação financeira — trilha obrigatória |
| ALREADY_PROTECTED | high | `src/app/api/webhooks/booking-com/reviews/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | medium | `src/app/api/admin/faturamento-zehla/route.ts` | mutação de identidade/RBAC |
| BACKLOG | medium | `src/app/api/admin/upsell-analytics/route.ts` | mutação de identidade/RBAC |
| BACKLOG | high | `src/app/api/checkout/cancel/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/checkout/create/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/checkout/downgrade/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/checkout/pix-status/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/checkout/success/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | medium | `src/app/api/cron/booking-daily/route.ts` | mutação de reserva — auditoria |
| BACKLOG | high | `src/app/api/cron/payment-confirmation/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/cron/payment-overdue/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | medium | `src/app/api/dashboard/bookings/route.ts` | mutação de reserva — auditoria |
| BACKLOG | high | `src/app/api/ddc/billing/invoices/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | medium | `src/app/api/ddc/booking-sync/route.ts` | mutação de reserva — auditoria |
| BACKLOG | medium | `src/app/api/ddc/bookings/route.ts` | mutação de reserva — auditoria |
| BACKLOG | medium | `src/app/api/ddc/realtime/tenant-state/route.ts` | mutação de identidade/RBAC |
| BACKLOG | high | `src/app/api/ddc/upsell/payment-method/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | medium | `src/app/api/tenants/route.ts` | mutação de identidade/RBAC |
| BACKLOG | high | `src/app/api/v1/reservations/[id]/payment/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | medium | `src/app/api/v1/reservations/route.ts` | mutação de reserva — auditoria |
| BACKLOG | high | `src/app/api/webhook-whatsapp/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | high | `src/app/api/webhooks/asaas/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/webhooks/mercadopago/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | high | `src/app/api/webhooks/payment/route.ts` | mutação financeira — trilha obrigatória |
| BACKLOG | high | `src/app/api/webhooks/whatsapp/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | high | `src/app/api/zcc/airbnb/webhook/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | high | `src/app/api/zcc/github/webhook/route.ts` | entrada externa — trilha obrigatória |
| BACKLOG | medium | `src/app/api/zcc/tenants/[id]/status/route.ts` | mutação de identidade/RBAC |
| BACKLOG | medium | `src/app/api/zcc/tenants/route.ts` | mutação de identidade/RBAC |
| WIRED | high | `src/app/api/checkout/webhook/route.ts` | mutação financeira — trilha obrigatória |

## rate-limit — WIRED 2 / ALREADY_PROTECTED 35 / BACKLOG 23

| Status | Confiança | Rota | Racional |
|---|---|---|---|
| ALREADY_PROTECTED | high | `src/app/api/airb-test/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/auth/forgot-password/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| ALREADY_PROTECTED | high | `src/app/api/auth/m2m/token/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| ALREADY_PROTECTED | high | `src/app/api/auth/magic-link/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| ALREADY_PROTECTED | high | `src/app/api/auth/register/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| ALREADY_PROTECTED | high | `src/app/api/auth/reset-password/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| ALREADY_PROTECTED | high | `src/app/api/brain/health/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/brain/intents/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/checkout/cancel/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/checkout/create/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/checkout/downgrade/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/checkout/pix-status/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/checkout/upgrade/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/ddc/ai-status/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/commissions/[id]/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/commissions/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/expenses/[id]/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/expenses/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/goals/[id]/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/goals/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/operations/[id]/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/operations/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb-pro/reports/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb/conversations/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb/notifications/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb/onboarding/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/ddc/airb/regional/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | medium | `src/app/api/ddc/meta-connect/route.ts` | envio de mensagem — quota externa |
| ALREADY_PROTECTED | high | `src/app/api/knowledge/generate-embeddings/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/landing/chat/route.ts` | rota de IA — custo por chamada |
| ALREADY_PROTECTED | high | `src/app/api/v1/reservations/[id]/payment/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/webhook-whatsapp/route.ts` | webhook — proteção contra replay/flood |
| ALREADY_PROTECTED | high | `src/app/api/webhooks/asaas/route.ts` | rota financeira — proteção contra repetição |
| ALREADY_PROTECTED | high | `src/app/api/webhooks/mercadopago/route.ts` | webhook — proteção contra replay/flood |
| ALREADY_PROTECTED | high | `src/app/api/webhooks/whatsapp/route.ts` | webhook — proteção contra replay/flood |
| BACKLOG | high | `src/app/api/airb-pro/comparativo/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/airb-pro/rentabilidade/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/airb-pro/yield-suggestion/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/auth/[...nextauth]/route.ts` | rota de autenticação — proteção contra abuso de credenciais |
| BACKLOG | high | `src/app/api/checkout/success/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | high | `src/app/api/cron/payment-confirmation/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | high | `src/app/api/cron/payment-overdue/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | high | `src/app/api/ddc/airb/properties/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/ddc/airb/scrape/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/ddc/billing/invoices/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | high | `src/app/api/ddc/upsell/payment-method/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | medium | `src/app/api/meta-costs/route.ts` | envio de mensagem — quota externa |
| BACKLOG | high | `src/app/api/webhooks/booking-com/reviews/route.ts` | webhook — proteção contra replay/flood |
| BACKLOG | high | `src/app/api/webhooks/payment/route.ts` | rota financeira — proteção contra repetição |
| BACKLOG | high | `src/app/api/zcc/airbnb/oauth/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/zcc/airbnb/webhook/route.ts` | webhook — proteção contra replay/flood |
| BACKLOG | high | `src/app/api/zcc/brain/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/zcc/cerebro/llmops/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/zcc/github/webhook/route.ts` | webhook — proteção contra replay/flood |
| BACKLOG | high | `src/app/api/zcc/leads/brain-analyze/route.ts` | rota de IA — custo por chamada |
| BACKLOG | high | `src/app/api/zcc/synthetic-brazil/generate/route.ts` | rota de IA — custo por chamada |
| BACKLOG | medium | `src/app/api/zcc/whatsapp/simulate/route.ts` | envio de mensagem — quota externa |
| BACKLOG | high | `src/app/api/zelador-suporte/chat/route.ts` | rota de IA — custo por chamada |
| WIRED | high | `src/app/api/brain/route.ts` | rota de IA — custo por chamada |
| WIRED | high | `src/app/api/checkout/webhook/route.ts` | rota financeira — proteção contra repetição |

## queue — WIRED 0 / ALREADY_PROTECTED 1 / BACKLOG 12

| Status | Confiança | Rota | Racional |
|---|---|---|---|
| ALREADY_PROTECTED | high | `src/app/api/webhook-whatsapp/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/checkout/webhook/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | medium | `src/app/api/ddc/billing/invoices/route.ts` | cobrança — fila de jobs |
| BACKLOG | medium | `src/app/api/ddc/conversations/[id]/messages/route.ts` | envio — fila com retry/backoff |
| BACKLOG | medium | `src/app/api/ddc/upsell/charge/route.ts` | cobrança — fila de jobs |
| BACKLOG | high | `src/app/api/webhooks/asaas/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/webhooks/booking-com/reviews/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/webhooks/mercadopago/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/webhooks/payment/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/webhooks/whatsapp/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/zcc/airbnb/webhook/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | high | `src/app/api/zcc/github/webhook/route.ts` | webhook — processar async para resposta rápida |
| BACKLOG | medium | `src/app/api/zcc/whatsapp/simulate/route.ts` | envio — fila com retry/backoff |

## cache — WIRED 0 / ALREADY_PROTECTED 3 / BACKLOG 15

| Status | Confiança | Rota | Racional |
|---|---|---|---|
| ALREADY_PROTECTED | medium | `src/app/api/ddc/airb-pro/reports/route.ts` | agregação de leitura — cache curto |
| ALREADY_PROTECTED | medium | `src/app/api/zcc/metrics/periods/route.ts` | agregação de leitura — cache curto |
| ALREADY_PROTECTED | medium | `src/app/api/zcc/metrics/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/cron/metrics-snapshot/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/dashboard/bookings/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/dashboard/overview/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/dashboard/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/ddc/linkinbio/stats/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/ddc/metrics/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/ddc/upsell/metrics/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/feedback/stats/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/v1/metrics/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/code-reviewer/stats/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/dashboard-stats/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/metrics/financial/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/metrics/geographic/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/stats/route.ts` | agregação de leitura — cache curto |
| BACKLOG | medium | `src/app/api/zcc/ze-code/stats/route.ts` | agregação de leitura — cache curto |

---

**Regra das próximas ondas:** cada item BACKLOG só vira fiação com o conteúdo
real do arquivo em evidência (paste-back — lição RUN10; nada de patch cego).
