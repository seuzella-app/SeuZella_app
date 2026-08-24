# BASELINE SNAPSHOT REPORT — Seu Zélla

## Baselines oficiais

- Baseline técnico: `a0bb1a85` — `fix(stripe+alexa): correct WebhookEvent property names + StripeGateway import`.
- Baseline documental V1: `4ad6ddd2` — adicionou o Super Documento de Conclusão.
- Baseline documental V2: `3ebb9e33` — adicionou o Documento Master de Conclusão V2.
- HEAD atual da `main` no início da Onda 0: `3ebb9e33`.

## Reconciliação de histórico

Entre `a0bb1a85` e `3ebb9e33`, os únicos commits posteriores presentes na `main` são documentais:

1. `4ad6ddd2` — V1.
2. `3ebb9e33` — V2.

Não há evidência, no histórico da `main`, de alterações de código produtivo posteriores a `a0bb1a85`.

Há trabalho posterior fora da `main` documentado em histórico/branches de hardening. Esse trabalho não é incorporado à baseline de produção nesta Onda 0; deverá ser reconciliado antes de qualquer merge futuro.

## Conclusão

A baseline técnica permanece `a0bb1a85`. A documentação vigente passa a ser a V2 em `3ebb9e33`. A Onda 1 deverá partir do `main` atual após este commit documental, tratando qualquer branch externa como mudança candidata sujeita a revisão.

## Pontos confirmados para Onda 1

- Alexa security gate: implementação existe, mas o endpoint ainda não chama a camada de replay/rate-limit.
- Stripe: HMAC existe; resolução de tenant no webhook precisa ser normalizada e tornada idempotente/transacional.
- Cron órfão `caution-auto-return`: funcionalidade foi removida do produto; a entrada deve ser removida do `vercel.json`.
- Tenant isolation: mecanismo atual é application-level via Prisma extension; não deve ser descrito como PostgreSQL RLS real.
- ZCC: login dedicado e allow-list existem; produção precisa de smoke test real.
- GraphRAG: integração e testes de wiring existem; execução real do sidecar continua pendente.
