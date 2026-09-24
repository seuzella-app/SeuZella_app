# RUN11-W1 — MATRIZ DE EVIDÊNCIAS (REDIS / QUEUES / OBSERVABILITY)

Data: 2026-09-21T15:34:23.818Z | arquivos escaneados: 1082

| Dimensão | Arquivos/Itens | Exemplos |
|---|---|---|
| Redis (import/URL) | 9 | src/app/api/readiness/route.ts, src/app/api/zcc/infrastructure/route.ts, src/app/api/zcc/vps-preflight/route.ts |
| Filas/workers | 23 | src/app/api/cron/dlq-drain/route.ts, src/app/api/ddc/live-feed/route.ts, src/app/api/ddc/realtime/tenant-state/route.ts |
| Logger/metrics | 33 | src/app/api/cron/backup-restore-drill/route.ts, src/app/api/cron/sre-alerts/route.ts, src/app/api/hunt/route.ts |
| OpenTelemetry/tracing | 251 | src/__tests__/cerebro/contextual-bandits.test.ts, src/__tests__/decision/RouterPipeline.test.ts, src/__tests__/e2e-pipeline.test.ts |
| AbortSignal (timeouts) | 29 | src/app/api/checkout/pix-status/route.ts, src/components/mobile/useDDCMobileLiveState.ts, src/components/secretaria/hunter-console.tsx |
| Rotas cron/internal | 36 | src/app/api/auth/m2m/token/route.ts, src/app/api/cron/achievements-check/route.ts, src/app/api/cron/backup-restore-drill/route.ts |
| Rotas health | 1 | src/app/api/health/route.ts |
| Chaves env de infra | 17 | AI_RATE_LIMIT_MAX, LOG_LEVEL, QUEUE_BRIDGE, QUEUE_NAMES, QUEUE_NOT_CONFIGURED_FOR_PRODUCTION, QUEUE_PAYLOAD_TOO_LARGE, QUEUE_PREFIX, QUEUE_TENANT_CONTEXT_MISMATCH |
