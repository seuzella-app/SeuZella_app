# Seu Zélla — Fase 3 Redis/Upstash baseline

## Implementado

- Contrato único em `src/lib/infra/redis-config.ts`.
- Rate limit canônico e de segurança reconhecem somente o par completo `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- REST/Upstash não é confundido com a URL nativa usada por BullMQ/ioredis.
- Preflight `npm run production:redis-config` não imprime segredos.
- Pares incompletos falham com `FAIL_INVALID_PARTIAL_UPSTASH_PAIR`.
- Ausência de provedor em produção resulta em `BLOCKED_EXTERNAL_INFRA`, sem falso PASS.
- Testes offline cobrem ausência, parcialidade e configuração completa.

## Não afirmado

Esta baseline não certifica conectividade real, latência, rate limit distribuído entre instâncias, BullMQ, DLQ ou SSE multi-instância. Esses gates exigem credenciais e infraestrutura reais.

## Variáveis futuras

### Rate limit serverless

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### BullMQ/SSE nativos

- `REDIS_URL` ou `REDIS_CONNECTION_STRING`

A URL nativa é um contrato diferente das credenciais REST. Nunca preencher uma com o valor da outra.
