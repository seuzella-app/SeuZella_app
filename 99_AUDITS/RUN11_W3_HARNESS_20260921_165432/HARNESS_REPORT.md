# SEUZELLA — RUN11-W3 HARNESS REPORT

Gerado em: `2026-09-21T16:54:41.444636`
Projeto: `/Users/marciocau/SeuZella_project`
W2 layer presente: `{'cache.ts': True, 'queue.ts': True, 'rate-limit.ts': True, 'audit.ts': True, 'health.ts': True, 'optional-require.ts': True}`

---

## 1. Sumário executivo

| Métrica | Valor |
|---|---|
| Rotas REST inventariadas | 320 |
| Handlers REST totais | 376 |
| Routers tRPC inventariados | 0 |
| Propostas de fiação geradas | 133 |
| Invariantes AST: GREEN | 4 |
| Invariantes AST: YELLOW | 3 |
| Invariantes AST: RED | 1 |
| Veredito invariantes | **RED** |

Inventário W1 real usado: `/Users/marciocau/SeuZella_project/99_AUDITS/RUN11_W1_20260921_123423/RUN11_INFRA_INVENTORY.json`

---

## 2. Plano de fiação proposto (por módulo W2)

Cada proposta é uma **sugestão** baseada em heurística de path. O patch W3 real deve validar cada proposta contra o inventário W1 real e a semântica do handler.

### 2.1 rate-limit (65 propostas)

| Rota | Confiança | Racional |
|---|---|---|
| `src/app/api/airb-pro/comparativo/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/airb-pro/rentabilidade/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/airb-pro/yield-suggestion/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/airb-test/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/auth/[...nextauth]/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/auth/forgot-password/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/auth/m2m/token/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/auth/magic-link/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/auth/register/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/auth/reset-password/route.ts` | high | rota de autenticação — proteção contra abuso de credenciais |
| `src/app/api/brain/health/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/brain/intents/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/brain/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/checkout/cancel/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/create/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/downgrade/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/pix-status/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/success/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/upgrade/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/webhook/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/checkout/webhook/route.ts` | high | webhook — proteção contra replay/flood |
| `src/app/api/cron/payment-confirmation/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/cron/payment-overdue/route.ts` | high | rota financeira — proteção contra repetição |
| `src/app/api/ddc/ai-status/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/conversations/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/notifications/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/onboarding/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/properties/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/regional/route.ts` | high | rota de IA — custo por chamada |
| `src/app/api/ddc/airb/scrape/route.ts` | high | rota de IA — custo por chamada |
... e mais 35 propostas (ver WIRING_PLAN.json)

### 2.2 audit (36 propostas)

| Rota | Confiança | Racional |
|---|---|---|
| `src/app/api/admin/faturamento-zehla/route.ts` | medium | mutação de identidade/RBAC |
| `src/app/api/admin/upsell-analytics/route.ts` | medium | mutação de identidade/RBAC |
| `src/app/api/checkout/cancel/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/create/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/downgrade/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/pix-status/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/success/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/upgrade/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/webhook/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/checkout/webhook/route.ts` | high | entrada externa — trilha obrigatória |
| `src/app/api/cron/booking-daily/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/cron/payment-confirmation/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/cron/payment-overdue/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/dashboard/bookings/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/ddc/billing/invoices/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/ddc/booking-sync/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/ddc/bookings/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/ddc/realtime/tenant-state/route.ts` | medium | mutação de identidade/RBAC |
| `src/app/api/ddc/upsell/payment-method/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/tenants/route.ts` | medium | mutação de identidade/RBAC |
| `src/app/api/v1/reservations/[id]/payment/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/v1/reservations/[id]/payment/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/v1/reservations/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/webhook-whatsapp/route.ts` | high | entrada externa — trilha obrigatória |
| `src/app/api/webhooks/asaas/route.ts` | high | mutação financeira — trilha obrigatória |
| `src/app/api/webhooks/asaas/route.ts` | high | entrada externa — trilha obrigatória |
| `src/app/api/webhooks/booking-com/reviews/route.ts` | high | entrada externa — trilha obrigatória |
| `src/app/api/webhooks/booking-com/reviews/route.ts` | medium | mutação de reserva — auditoria |
| `src/app/api/webhooks/mercadopago/route.ts` | high | entrada externa — trilha obrigatória |
| `src/app/api/webhooks/payment/route.ts` | high | mutação financeira — trilha obrigatória |
... e mais 6 propostas (ver WIRING_PLAN.json)

### 2.3 cache (18 propostas)

| Rota | Confiança | Racional |
|---|---|---|
| `src/app/api/cron/metrics-snapshot/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/dashboard/bookings/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/dashboard/overview/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/dashboard/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/ddc/airb-pro/reports/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/ddc/linkinbio/stats/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/ddc/metrics/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/ddc/upsell/metrics/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/feedback/stats/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/v1/metrics/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/code-reviewer/stats/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/dashboard-stats/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/metrics/financial/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/metrics/geographic/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/metrics/periods/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/metrics/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/stats/route.ts` | medium | agregação de leitura — cache curto |
| `src/app/api/zcc/ze-code/stats/route.ts` | medium | agregação de leitura — cache curto |

### 2.4 queue (14 propostas)

| Rota | Confiança | Racional |
|---|---|---|
| `src/app/api/checkout/webhook/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/ddc/billing/invoices/route.ts` | medium | cobrança — fila de jobs |
| `src/app/api/ddc/conversations/[id]/messages/route.ts` | medium | envio — fila com retry/backoff |
| `src/app/api/ddc/upsell/charge/route.ts` | medium | cobrança — fila de jobs |
| `src/app/api/webhook-whatsapp/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/asaas/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/booking-com/reviews/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/mercadopago/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/payment/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/whatsapp/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/webhooks/whatsapp/route.ts` | medium | envio — fila com retry/backoff |
| `src/app/api/zcc/airbnb/webhook/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/zcc/github/webhook/route.ts` | high | webhook — processar async para resposta rápida |
| `src/app/api/zcc/whatsapp/simulate/route.ts` | medium | envio — fila com retry/backoff |

### 2.5 health (0 propostas)

_Nenhuma proposta automática. Decisão manual no patch W3._

---

## 3. Invariantes AST

| Invariante | Status | Evidência |
|---|---|---|
| `I1_NO_STATIC_IOREDIS_IN_INFRA` | **GREEN** | 0 imports estaticos de ioredis em src/lib/infra/* |
| `I2_NO_REDIS_URL_LITERAL_IN_INFRA_CODE` | **GREEN** | 0 literais redis:// em src/lib/infra/* |
| `I3_NO_VENDOR_KEY_LITERALS_IN_INFRA` | **GREEN** | 0 literais vendor em src/lib/infra/* |
| `I4_AUDIT_HAS_REDACTION_PATTERNS` | **YELLOW** | audit.ts parcial: keyRe=true valuePatterns=true sk=false jwt=false |
| `I5_HEALTH_ENV_CONFIGURED_BOOLEAN_ONLY` | **GREEN** | health.ts so reporta configured:boolean com allowlist |
| `I6_NO_REDIS_URL_HARDCODED_IN_CODEBASE` | **YELLOW** | 1 literais em temp_openwa/src/core/plugins/plugin-loader.service.spec.ts |
| `I7_NO_DB_PUSH_ACCEPT_DATA_LOSS` | **RED** | 6 scripts: .zscripts/zcc-battery/03-full-regression-suite.sh, graft/.cache/extract.496c9d83e6eb3668.json, scripts/deploy-mvk4.sh, src/lib/cerebro/vulnerability-scanner.ts, tests/cerebro-ml-anti-hacker.test.ts |
| `I8_NO_CONSOLE_LOG_IN_PROD_CODE` | **YELLOW** | 48 ocorrências em 15 arquivos (top: src/app/api/cron/budget-reset/route.ts, src/app/api/cron/lembrete-checkin/route.ts, src/app/api/cron/metrics-snapshot/route.ts) |

---

## 4. Próximos passos

1. **Paste-back deste report** para o agente auditar (arquivo: `99_AUDITS/RUN11_W3_HARNESS_<TS>/HARNESS_REPORT.md`).
2. Se o inventário W1 real estiver presente, o agente cruza `WIRING_PLAN.json` × `RUN11_INFRA_INVENTORY.json` para gerar o patch W3 definitivo.
3. Se W1 estiver ausente, o agente produz o patch W3 com base na heurística deste report + leitura cirúrgica de cada rota proposta.
4. Após o patch W3 ser aplicado e verde, fecha-se RUN11 com a tag `SEUZELLA_RUN11_MASTER_CLOSURE_01`.

---

## 5. Artefatos gerados

- `ROUTE_INVENTORY.json` — enumeração completa de rotas e routers.
- `WIRING_PLAN.json` — propostas de fiação por módulo W2.
- `AST_INVARIANTS.json` — veredito de segurança estrutural.
- `HARNESS_REPORT.md` — este documento.

_Harness read-only: nenhum arquivo de produção foi modificado._
