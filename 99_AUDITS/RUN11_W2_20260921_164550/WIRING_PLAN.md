# RUN11-W2 — PLANO DE FIAÇÃO (gerado do inventário REAL do W1)

Inventário: 99_AUDITS/RUN11_W1_20260921_163930/RUN11_INFRA_INVENTORY.json
Escaneados: 1082 arquivos

## 11A — Redis (separar production/mock/unused/dead)
- arquivos com referência redis: 9 -> ["src/app/api/readiness/route.ts","src/app/api/zcc/infrastructure/route.ts","src/app/api/zcc/vps-preflight/route.ts","src/lib/cerebro/rate-limit.ts","src/lib/observability/sre-service.ts","src/lib/queue/bullmq-queue.ts","src/lib/queue/production-guard.ts","src/lib/realtime/redis-pubsub.ts","src/scripts/production-check.ts"]
- REDIS_URL nas envs do código: SIM
- Driver: LocalCache ativo; RedisCache só entra com REDIS_URL + pacote presente (importOptional).

## 11B — Rate limiting (fail-closed)
- envs de rate limit detectadas: ["AI_RATE_LIMIT_MAX","RATE_LIMIT_MAX","RATE_LIMIT_PER_HOUR","RATE_LIMIT_PER_MIN","RATE_LIMIT_UNAVAILABLE","RATE_LIMIT_WINDOW_MS"]
- RateLimiter (closed por padrão) disponível para fiação em W3 nas rotas que o inventário apontar.

## 11C — Queues
- arquivos de fila/workers: 23 -> ["src/app/api/cron/dlq-drain/route.ts","src/app/api/ddc/live-feed/route.ts","src/app/api/ddc/realtime/tenant-state/route.ts","src/app/api/health/route.ts","src/app/api/hunt-stream/route.ts","src/app/api/readiness/route.ts","src/app/api/webhook-whatsapp/route.ts","src/app/api/zcc/cerebro/stream/route.ts","src/app/api/zcc/infrastructure/route.ts","src/app/api/zcc/metrics/route.ts"]
- LocalQueue (retry/backoff/DLQ/idempotência/stats) disponível; driver distribuído só se inventário justificar.

## 11D — Audit trail
- arquivos logger: 33 -> ["src/app/api/cron/backup-restore-drill/route.ts","src/app/api/cron/sre-alerts/route.ts","src/app/api/hunt/route.ts","src/app/api/monitoring/route.ts","src/app/api/zcc/backup-drill/route.ts","src/app/api/zcc/pulse/capture/route.ts","src/lib/ai/backend-tool-authorizer.ts","src/lib/ai/dspy/dspy-signatures.ts","src/lib/ai/tf-client.ts","src/lib/cerebro/night-audit-service.ts"]
- audit() com redação por chave/valor disponível; fiação W3 preserva correlationId.

## 11E — Health/Readiness
- rotas health: ["src/app/api/health/route.ts"]
- cron/internal routes: ["src/app/api/auth/m2m/token/route.ts","src/app/api/cron/achievements-check/route.ts","src/app/api/cron/backup-restore-drill/route.ts","src/app/api/cron/booking-daily/route.ts","src/app/api/cron/budget-reset/route.ts","src/app/api/cron/cerebro-analyze/route.ts","src/app/api/cron/cerebro-budget-forecast/route.ts","src/app/api/cron/cerebro-churn-predict/route.ts","src/app/api/cron/cerebro-cleanup/route.ts","src/app/api/cron/cerebro-distill/route.ts","src/app/api/cron/cerebro-learning/route.ts","src/app/api/cron/cerebro-night-audit/route.ts","src/app/api/cron/cerebro-night-pentest/route.ts","src/app/api/cron/cerebro-night-pulse/route.ts","src/app/api/cron/cerebro-orchestrator/route.ts","src/app/api/cron/cerebro-refactor-check/route.ts","src/app/api/cron/cerebro-watchdog/route.ts","src/app/api/cron/dlq-drain/route.ts","src/app/api/cron/housekeeping-dispatch/route.ts","src/app/api/cron/ical-sync/route.ts","src/app/api/cron/learning-cycle/route.ts","src/app/api/cron/lembrete-checkin/route.ts","src/app/api/cron/linkinbio-expiry-check/route.ts","src/app/api/cron/locks-maintenance/route.ts","src/app/api/cron/metrics-snapshot/route.ts","src/app/api/cron/monthly-billing/route.ts","src/app/api/cron/nps-checkout/route.ts","src/app/api/cron/ota-token-expiry/route.ts","src/app/api/cron/payment-confirmation/route.ts","src/app/api/cron/payment-overdue/route.ts","src/app/api/cron/plan-expiry/route.ts","src/app/api/cron/plan-limits-check/route.ts","src/app/api/cron/security-scan/route.ts","src/app/api/cron/sre-alerts/route.ts","src/app/api/cron/weekly-report/route.ts","src/app/api/internal/flush-buffer/route.ts"]
- readinessPayload() (envs só como configured:boolean) para substituir dumps em W3.

## REGRA DA FIAÇÃO (W3)
Nenhum arquivo de produção foi tocado nesta onda. Cada edição W3 precisa do
arquivo real listado AQUI como evidência (nada de patch cego — lição RUN10).
