# Observabilidade / SRE — Acceptance Contract

## Objetivo
Definir o mínimo operacional M5 para Seu Zélla sem confundir logs de infraestrutura com observabilidade de negócio.

## Sinais obrigatórios
- Runtime errors por route e deployment.
- Latência p50/p95 para APIs críticas.
- Webhook failures por provider (Asaas, Mercado Pago, WhatsApp).
- Queue/DLQ depth e oldest message age.
- Redis transport state.
- Database connectivity and query failures.
- LLM usage/cost by tenant.
- Payment reconciliation failures.

## Severidades
- SEV1: indisponibilidade global, vazamento de dados, pagamento incorreto, falha generalizada de acesso.
- SEV2: degradação importante de uma capacidade crítica.
- SEV3: falha funcional localizada sem impacto crítico.

## Acceptance
- Error tracking receives a synthetic error in non-production.
- Alerts are routed to the operational owner.
- Payment/webhook errors are queryable by provider and tenant.
- DLQ alerts identify queue, count and oldest message.
- No secrets or raw payment credentials are written to logs.
