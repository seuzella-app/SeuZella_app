# BASELINE SNAPSHOT REPORT — Seu Zélla

## Baselines oficiais

- Baseline técnico: `a0bb1a85` — snapshot histórico de correção de autenticação/Alexa e gateway legado.
- Baseline documental V1: `4ad6ddd2` — adicionou o Super Documento de Conclusão.
- Baseline documental V2: `3ebb9e33` — adicionou o Documento Master de Conclusão V2.
- HEAD atual da `main` no início da Onda 0: `3ebb9e33`.

## Reconciliação de histórico

Entre `a0bb1a85` e `3ebb9e33`, os commits posteriores presentes na `main` foram documentais.

Há trabalho posterior fora da `main` em branches de hardening. Esse trabalho é tratado como mudança candidata e só entra após PR e validação.

## Escopo financeiro reconciliado

- **Asaas:** gateway primário de produção.
- **Mercado Pago:** gateway secundário/fallback de produção.
- **Mock:** somente desenvolvimento e testes.
- **Stripe:** fora do escopo comercial e técnico. Não deve existir provider, webhook, env var, readiness ou teste de billing Stripe no runtime final.

## Pontos confirmados para Wave 1

- Alexa security gate: implementação existe, mas o endpoint ainda precisa estar totalmente conectado à camada de replay/rate-limit.
- Gateway activation: normalização canônica deve cobrir exclusivamente Asaas/Mercado Pago, com idempotência, tenant resolution interna e transição transacional.
- Cron órfão `caution-auto-return`: funcionalidade removida; a entrada deve ser removida do `vercel.json`.
- Tenant isolation: mecanismo atual é application-level via Prisma extension; não é PostgreSQL RLS real.
- ZCC: login dedicado e allow-list existem; produção precisa de smoke test real.
- GraphRAG: integração e testes de wiring existem; execução real do sidecar continua pendente.
