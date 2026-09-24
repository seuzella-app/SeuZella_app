# JEV_RECON — Seu Zélla (JEV MASTER, seção 1 — recon obrigatório)

Gerado em: 2026-09-22T18:42:42.676Z | Branch: feat/meta-zella-foundation | HEAD: ffa3902b54a50b0adfd0d286ddef8281f5e80327
Status da árvore: {"modified":0,"untracked":14,"staged":0,"total":14,"nonAudit":0} (99_AUDITS/ tolerado)

## B) Infraestrutura de IA (map da diretiva)

| # | Alvo | Encontrado | Primário (REAL_CODE) | Refs | Classes (R/D/T/M) |
|---|------|-----------|----------------------|------|-------------------|
| 1 | 1) canonical AI entrypoint | SIM | src/adapters/interfaces/IPaymentGatewayAdapter.ts | 71 | R=16 D=25 T=30 M=0 |
| 2 | 2) ZaosNeuroRouter | SIM | src/lib/ai/zaos-neuro-router.ts | 32 | R=19 D=8 T=5 M=0 |
| 3 | 3) llm-adapters | SIM | src/lib/ai/llm-adapters.ts | 20 | R=13 D=6 T=1 M=0 |
| 4 | 4) llm-router | SIM | src/lib/ai/llm-router.ts | 17 | R=12 D=4 T=1 M=0 |
| 5 | 5) provider registry | SIM | docs/WAVE_2_PROGRESS.md (DOC_ONLY) | 1 | R=0 D=1 T=0 M=0 |
| 6 | 6) ProviderCapabilityProfile | SIM | src/domain/decision/models/ProviderCapabilityProfile.ts | 11 | R=4 D=4 T=3 M=0 |
| 7 | 7) budget guard | SIM | src/lib/ai/budget-guard.ts | 57 | R=29 D=16 T=12 M=0 |
| 8 | 8) tenant budget guard | SIM | src/lib/ai/budget-guard.ts | 3 | R=2 D=1 T=0 M=0 |
| 9 | 9) circuit breaker | SIM | src/lib/ai/circuit-breaker.ts | 25 | R=13 D=8 T=4 M=0 |
| 10 | 10) cognitive router | SIM | src/lib/ai/cognitive-router.ts | 14 | R=7 D=6 T=1 M=0 |
| 11 | 11) intent router | SIM | src/lib/ai/intent-router.ts | 12 | R=7 D=4 T=1 M=0 |
| 12 | 12) Cérebro | SIM | src/app/api/brain/health/route.ts | 454 | R=204 D=179 T=71 M=0 |
| 13 | 13) learning engine | SIM | src/lib/cerebro/learning-engine.ts | 19 | R=7 D=4 T=8 M=0 |
| 14 | 14) telemetry | SIM | src/app/api/telemetry/ingest/route.ts | 89 | R=42 D=24 T=23 M=0 |
| 15 | extra) ProviderRegistration | SIM | src/lib/ai/zaos-neuro-router.ts | 2 | R=1 D=1 T=0 M=0 |
| 16 | extra) DEFAULT_PROVIDERS | SIM | src/lib/ai/zaos-neuro-router.ts | 1 | R=1 D=0 T=0 M=0 |
| 17 | extra) ProviderAdapter | NÃO | — | 0 | R=0 D=0 T=0 M=0 |

### Detalhe por alvo (até 12 arquivos cada)

**1) canonical AI entrypoint** — encontrado (71 arquivos)
- [REAL_CODE] src/adapters/interfaces/IPaymentGatewayAdapter.ts (linhas 2)
- [REAL_CODE] src/app/api/checkout/create/route.ts (linhas 43,55)
- [REAL_CODE] src/app/api/ddc/mobile/state/route.ts (linhas 12)
- [REAL_CODE] src/app/manifest.ts (linhas 4)
- [REAL_CODE] src/app/mobile/page.tsx (linhas 4)
- [REAL_CODE] src/components/mobile/MobileDDCDataBoundary.tsx (linhas 7)
- [REAL_CODE] src/components/mobile/useDDCMobileOperationalSummary.ts (linhas 9)
- [REAL_CODE] src/domain/zcc/LearningPipeline.ts (linhas 4)
- [REAL_CODE] src/domain/zcc/types.ts (linhas 12)
- [REAL_CODE] src/lib/billing/money.ts (linhas 2)
- [REAL_CODE] src/lib/billing/upsell-calculator.ts (linhas 2)
- [REAL_CODE] src/lib/observability/trace-context.ts (linhas 2,10,42,85)

**2) ZaosNeuroRouter** — encontrado (32 arquivos)
- [REAL_CODE] src/app/api/brain/route.ts (linhas 47)
- [REAL_CODE] src/app/api/ddc/gerente-ia/route.ts (linhas 11,207)
- [REAL_CODE] src/app/api/zcc/brain/route.ts (linhas 81)
- [REAL_CODE] src/app/api/zcc/cerebro/ml-stats/route.ts (linhas 16)
- [REAL_CODE] src/domain/decision/services/ZaosNeuroRouter.ts (linhas 15)
- [REAL_CODE] src/lib/ai/brain-persistence.ts (linhas 8,64,109)
- [REAL_CODE] src/lib/ai/budget-guard.ts (linhas 4)
- [REAL_CODE] src/lib/ai/circuit-breaker.ts (linhas 2)
- [REAL_CODE] src/lib/ai/cognitive-router.ts (linhas 7)
- [REAL_CODE] src/lib/ai/context-discretizer.ts (linhas 2,38)
- [REAL_CODE] src/lib/ai/headroom-client.ts (linhas 2)
- [REAL_CODE] src/lib/ai/semantic-cache.ts (linhas 2)

**3) llm-adapters** — encontrado (20 arquivos)
- [REAL_CODE] src/app/api/zcc/cerebro/prompt-ide/route.ts (linhas 11)
- [REAL_CODE] src/lib/ai/llm-adapters.ts (linhas 49,55,107,157,224)
- [REAL_CODE] src/lib/ai/prompt-caching.ts (linhas 38)
- [REAL_CODE] src/lib/ai/tool-calling.ts (linhas 32)
- [REAL_CODE] src/lib/ai/zaos-neuro-router.ts (linhas 44)
- [REAL_CODE] src/lib/cerebro/cerebro-learning-service.ts (linhas 40)
- [REAL_CODE] src/lib/cerebro/code-reviewer/reviewer-service.ts (linhas 5,44)
- [REAL_CODE] src/lib/cerebro/glm-service.ts (linhas 43)
- [REAL_CODE] src/lib/cerebro/night-audit-service.ts (linhas 43)
- [REAL_CODE] src/lib/cerebro/night-pulse-service.ts (linhas 34)
- [REAL_CODE] src/lib/cerebro/refactor-suggester.ts (linhas 37)
- [REAL_CODE] src/lib/cerebro/workflow-engine.ts (linhas 28)

**4) llm-router** — encontrado (17 arquivos)
- [REAL_CODE] src/app/api/zcc/leads/brain-analyze/route.ts (linhas 2,51)
- [REAL_CODE] src/lib/ai/llm-router.ts (linhas 93,243)
- [REAL_CODE] src/lib/airb/ai-responder.ts (linhas 10)
- [REAL_CODE] src/lib/brain/agent-orchestrator.ts (linhas 10,139)
- [REAL_CODE] src/lib/brain/intent-classifier.ts (linhas 1,27)
- [REAL_CODE] src/lib/brain/receipt-extractor.ts (linhas 1,20)
- [REAL_CODE] src/lib/brain/whatsapp-persona-learner.ts (linhas 2,49)
- [REAL_CODE] src/lib/cerebro/zelador-suporte-brain.ts (linhas 1,123)
- [REAL_CODE] src/lib/cerebro/zella-sales-brain.ts (linhas 1,115)
- [REAL_CODE] src/lib/llm/llm-fallback-chain.ts (linhas 6,10,21,22,24)
- [REAL_CODE] src/lib/llm/llm-router.ts
- [REAL_CODE] src/lib/llm/prompt-guard.ts (linhas 24)

**5) provider registry** — encontrado (1 arquivos)
- [DOC_ONLY] docs/WAVE_2_PROGRESS.md (linhas 52)

**6) ProviderCapabilityProfile** — encontrado (11 arquivos)
- [REAL_CODE] src/domain/decision/models/ProviderCapabilityProfile.ts (linhas 11,30,31)
- [REAL_CODE] src/domain/decision/services/AdaptiveStickiness.ts (linhas 2,19)
- [REAL_CODE] src/domain/decision/services/ParetoMultiObjectiveSelector.ts (linhas 1,47,49)
- [REAL_CODE] src/domain/decision/services/ZaosNeuroRouter.ts (linhas 8,20,135)
- [DOC_ONLY] graft/src/domain/decision/models/ProviderCapabilityProfile.md (linhas 1,4,6)
- [DOC_ONLY] graft/src/domain/decision/services/AdaptiveStickiness.md (linhas 6)
- [DOC_ONLY] graft/src/domain/decision/services/ParetoMultiObjectiveSelector.md (linhas 5)
- [DOC_ONLY] graft/src/domain/decision/services/ZaosNeuroRouter.md (linhas 4)
- [TEST_ONLY] src/__tests__/decision/ConvergenceProof.test.ts (linhas 3,22,35)
- [TEST_ONLY] src/__tests__/decision/DomainModels.test.ts (linhas 2,11,22)
- [TEST_ONLY] src/__tests__/decision/RouterPipeline.test.ts (linhas 8,19,59,76,93)

**7) budget guard** — encontrado (57 arquivos)
- [REAL_CODE] src/app/api/cron/budget-reset/route.ts (linhas 17)
- [REAL_CODE] src/app/api/router/budget/route.ts (linhas 7,24,29,86,91)
- [REAL_CODE] src/app/api/zcc/brain/route.ts (linhas 10,15,121)
- [REAL_CODE] src/app/api/zcc/burn-rate/route.ts (linhas 10,150,257,258,268)
- [REAL_CODE] src/app/api/zcc/cerebro/ml-stats/route.ts (linhas 25,50)
- [REAL_CODE] src/app/api/zcc/cerebro/runbook/route.ts (linhas 108)
- [REAL_CODE] src/app/api/zcc/cerebro/status/route.ts (linhas 14,36,185,295,539)
- [REAL_CODE] src/app/api/zcc/finance/expenses/route.ts (linhas 32)
- [REAL_CODE] src/app/api/zcc/metrics/periods/route.ts (linhas 482)
- [REAL_CODE] src/app/legal/termos-uso/page.tsx (linhas 162)
- [REAL_CODE] src/components/zcc/panels/burn-rate-panel.tsx (linhas 28,30,60,80,205)
- [REAL_CODE] src/components/zcc/panels/cerebro-panel.tsx (linhas 56,78,190,212,872)

**8) tenant budget guard** — encontrado (3 arquivos)
- [REAL_CODE] src/lib/ai/budget-guard.ts (linhas 268,332)
- [REAL_CODE] src/lib/ai/zaos-neuro-router.ts (linhas 26,597,598,1490,1491)
- [DOC_ONLY] graft/src/lib/ai/budget-guard.md (linhas 21)

**9) circuit breaker** — encontrado (25 arquivos)
- [REAL_CODE] src/app/api/brain/route.ts (linhas 47)
- [REAL_CODE] src/app/api/zcc/brain/route.ts (linhas 96)
- [REAL_CODE] src/app/api/zcc/cerebro/status/route.ts (linhas 16)
- [REAL_CODE] src/components/zcc/panels/cerebro-panel.tsx (linhas 58)
- [REAL_CODE] src/domain/decision/adapters/InMemoryRouterStateAdapter.ts (linhas 43,47)
- [REAL_CODE] src/domain/decision/models/CircuitBreakerState.ts (linhas 7,14,21,31,42)
- [REAL_CODE] src/domain/decision/ports/IRouterStatePort.ts (linhas 23,33)
- [REAL_CODE] src/domain/decision/services/ZaosNeuroRouter.ts (linhas 5,6,26,43,46)
- [REAL_CODE] src/lib/ai/brain-persistence.ts (linhas 73,79,112,122,123)
- [REAL_CODE] src/lib/ai/circuit-breaker.ts (linhas 22,31,40,46,53)
- [REAL_CODE] src/lib/ai/zaos-neuro-router.ts (linhas 25,183,516,610,623)
- [REAL_CODE] src/lib/security/resource-guard.ts (linhas 1,7,18,19,31)

**10) cognitive router** — encontrado (14 arquivos)
- [REAL_CODE] src/app/api/brain/route.ts (linhas 6)
- [REAL_CODE] src/components/zcc/panels/cerebro-test-panel.tsx (linhas 634)
- [REAL_CODE] src/lib/ai/cognitive-router.ts (linhas 130,182,211,220,323)
- [REAL_CODE] src/lib/cerebro/best-practices.ts (linhas 435)
- [REAL_CODE] src/lib/semantica/client.ts (linhas 608)
- [REAL_CODE] src/lib/semantica/types.ts (linhas 7)
- [REAL_CODE] src/lib/whatsapp-ai-responder.ts (linhas 3,432)
- [DOC_ONLY] CLAUDE.md (linhas 37,50,81,86,159)
- [DOC_ONLY] docs/META_ZELLA_ARCHITECTURE.md (linhas 27)
- [DOC_ONLY] docs/semantica-integration-ADR.md (linhas 26,41,50,88)
- [DOC_ONLY] docs/ZELLA_BRAIN_META_PIPELINE.md (linhas 19,31)
- [DOC_ONLY] DOCUMENTO_MASTER_PRE_PRODUCAO.md (linhas 1007)

**11) intent router** — encontrado (12 arquivos)
- [REAL_CODE] src/app/api/brain/route.ts (linhas 4)
- [REAL_CODE] src/lib/ai/cognitive-router.ts (linhas 12)
- [REAL_CODE] src/lib/ai/intent-router.ts (linhas 303)
- [REAL_CODE] src/lib/ai/tool-discovery.ts (linhas 7,12,84)
- [REAL_CODE] src/lib/cerebro/best-practices.ts (linhas 434)
- [REAL_CODE] src/lib/strategies/ZellaAirBStrategy.ts (linhas 169,199,226,371,377)
- [REAL_CODE] src/lib/whatsapp-ai-responder.ts (linhas 4)
- [DOC_ONLY] CLAUDE.md (linhas 164)
- [DOC_ONLY] docs/META_ZELLA_ARCHITECTURE.md (linhas 26)
- [DOC_ONLY] docs/ZELLA_BRAIN_META_PIPELINE.md (linhas 18)
- [DOC_ONLY] graft/src/lib/ai/intent-router.md (linhas 1)
- [TEST_ONLY] tests/ml-architecture-validation.test.ts (linhas 82,83)

**12) Cérebro** — encontrado (454 arquivos)
- [REAL_CODE] src/app/api/airb-pro/yield-suggestion/route.ts (linhas 16)
- [REAL_CODE] src/app/api/airb-test/route.ts (linhas 1)
- [REAL_CODE] src/app/api/auth/m2m/token/route.ts (linhas 25,28)
- [REAL_CODE] src/app/api/brain/health/route.ts
- [REAL_CODE] src/app/api/brain/intents/route.ts
- [REAL_CODE] src/app/api/brain/route.ts
- [REAL_CODE] src/app/api/cron/cerebro-analyze/route.ts (linhas 2,8,9,20,24)
- [REAL_CODE] src/app/api/cron/cerebro-budget-forecast/route.ts (linhas 2,6,21,22,23)
- [REAL_CODE] src/app/api/cron/cerebro-churn-predict/route.ts (linhas 2,11,15,16,17)
- [REAL_CODE] src/app/api/cron/cerebro-cleanup/route.ts (linhas 2,6,7,8,21)
- [REAL_CODE] src/app/api/cron/cerebro-distill/route.ts (linhas 2,13,17,18,19)
- [REAL_CODE] src/app/api/cron/cerebro-learning/route.ts (linhas 2,13,15,20,26)

**13) learning engine** — encontrado (19 arquivos)
- [REAL_CODE] src/app/api/cron/learning-cycle/route.ts (linhas 13)
- [REAL_CODE] src/app/api/ddc/cerebro/feedback/route.ts (linhas 11)
- [REAL_CODE] src/app/api/ddc/cerebro/learning/route.ts (linhas 22)
- [REAL_CODE] src/app/api/zcc/cerebro/status/route.ts (linhas 17,200,560,742)
- [REAL_CODE] src/components/zcc/panels/cerebro-panel.tsx (linhas 59,193,875,984)
- [REAL_CODE] src/components/zcc/panels/cerebro-test-panel.tsx (linhas 604,627)
- [REAL_CODE] src/lib/cerebro/learning-engine.ts (linhas 144,153,234,282,298)
- [DOC_ONLY] deploy/JORNADA-COMPLETA-CLIENTE.md (linhas 104,105)
- [DOC_ONLY] deploy/ROADMAP-ZELLA-LLM-32B.md (linhas 76)
- [TEST_ONLY] graft/src/__tests__/cerebro/learning-engine.test.md (linhas 1)
- [DOC_ONLY] graft/src/lib/cerebro/learning-engine.md (linhas 1)
- [DOC_ONLY] MEMORY_ARCHITECTURE_DECISION.md (linhas 120,425,603)

**14) telemetry** — encontrado (89 arquivos)
- [REAL_CODE] src/app/api/bim-vision/route.ts (linhas 74,80)
- [REAL_CODE] src/app/api/cron/cerebro-cleanup/route.ts (linhas 8)
- [REAL_CODE] src/app/api/cron/learning-cycle/route.ts (linhas 8)
- [REAL_CODE] src/app/api/ddc/cerebro/learning/route.ts (linhas 4,35,46,47,48)
- [REAL_CODE] src/app/api/ddc/conversations/[id]/route.ts (linhas 8)
- [REAL_CODE] src/app/api/pinns-clifford/route.ts (linhas 75,81)
- [REAL_CODE] src/app/api/telemetry/ingest/route.ts (linhas 2,4,9,10,12)
- [REAL_CODE] src/app/api/telemetry/landing/route.ts (linhas 2,46,47)
- [REAL_CODE] src/app/api/telemetry/query/route.ts (linhas 2,4,17,18,82)
- [REAL_CODE] src/app/api/webgl-bridge/route.ts (linhas 72,78)
- [REAL_CODE] src/app/api/webhooks/payment/route.ts (linhas 412)
- [REAL_CODE] src/app/api/zcc/burn-rate/route.ts (linhas 70)

**extra) ProviderRegistration** — encontrado (2 arquivos)
- [REAL_CODE] src/lib/ai/zaos-neuro-router.ts (linhas 156,182,194,503,1039)
- [DOC_ONLY] graft/src/lib/ai/zaos-neuro-router.md (linhas 9,15,25,49)

**extra) DEFAULT_PROVIDERS** — encontrado (1 arquivos)
- [REAL_CODE] src/lib/ai/zaos-neuro-router.ts (linhas 194,387,389,512)

**extra) ProviderAdapter** — NÃO encontrado em src/tests/docs

## C) Busca de providers/termos da diretiva

| Termo | Código (REAL+MOCK) | Docs | Testes |
|-------|-------------------|------|--------|
| GLM | 8 | 8 | 8 |
| Kimi | 7 | 1 | 0 |
| OpenRouter | 8 | 4 | 2 |
| Ollama | 8 | 5 | 3 |
| Anthropic | 8 | 7 | 8 |
| OpenAI | 8 | 8 | 8 |
| Zhipu | 8 | 3 | 1 |
| Moonshot | 8 | 1 | 1 |
| ProviderAdapter | 0 | 0 | 0 |
| ProviderRegistration | 1 | 1 | 0 |
| modelId | 0 | 0 | 0 |
| providerId | 8 | 3 | 5 |

Arquivos por termo (REAL_CODE, até 8):
- **GLM**: src/app/api/cron/cerebro-analyze/route.ts, src/app/api/cron/cerebro-budget-forecast/route.ts, src/app/api/cron/cerebro-learning/route.ts, src/app/api/cron/cerebro-night-audit/route.ts, src/app/api/cron/cerebro-refactor-check/route.ts, src/app/api/cron/security-scan/route.ts, src/app/api/zcc/brain/route.ts, src/app/api/zcc/burn-rate/route.ts
- **Kimi**: src/components/zcc/panels/live-agents-panel.tsx, src/lib/ai/cost-knowledge.ts, src/lib/ai/llm-adapters.ts, src/lib/ai/llm-router.ts, src/lib/ai/tool-calling.ts, src/lib/ai/zaos-neuro-router.ts, src/lib/env.ts
- **OpenRouter**: src/app/api/zcc/brain/route.ts, src/lib/ai/cost-knowledge.ts, src/lib/ai/llm-adapters.ts, src/lib/ai/llm-router.ts, src/lib/ai/llm-timeout.ts, src/lib/ai/tool-calling.ts, src/lib/ai/zaos-neuro-router.ts, src/lib/env.ts
- **Ollama**: src/components/zcc/panels/live-agents-panel.tsx, src/lib/ai/budget-guard.ts, src/lib/ai/cost-knowledge.ts, src/lib/ai/llm-router.ts, src/lib/ai/zaos-neuro-router.ts, src/lib/env.ts, src/lib/zcc/types.ts, src/types/index.ts
- **Anthropic**: src/app/api/config/keys/route.ts, src/app/api/cron/security-scan/route.ts, src/app/api/zcc/brain/route.ts, src/app/api/zcc/finance/expenses/route.ts, src/components/zcc/panels/expenses-breakdown.tsx, src/components/zcc/panels/financeiro-panel.tsx, src/lib/ai/llm-adapters.ts, src/lib/ai/llm-router.ts
- **OpenAI**: src/app/api/config/keys/route.ts, src/app/api/cron/budget-reset/route.ts, src/app/api/cron/security-scan/route.ts, src/app/api/zcc/brain/route.ts, src/app/api/zcc/cerebro/prompt-ide/route.ts, src/app/api/zcc/cerebro/status/route.ts, src/components/landing/IntegrationsSection.tsx, src/components/zcc/panels/live-agents-panel.tsx
- **Zhipu**: src/app/api/zcc/cerebro/prompt-ide/route.ts, src/app/api/zcc/cerebro/runbook/route.ts, src/components/zcc/panels/live-agents-panel.tsx, src/lib/ai/batch-queue.ts, src/lib/ai/cost-knowledge.ts, src/lib/ai/llm-adapters.ts, src/lib/ai/llm-router.ts, src/lib/ai/tool-calling.ts
- **Moonshot**: src/components/zcc/panels/live-agents-panel.tsx, src/lib/ai/batch-queue.ts, src/lib/ai/cost-knowledge.ts, src/lib/ai/llm-adapters.ts, src/lib/ai/llm-router.ts, src/lib/ai/tool-calling.ts, src/lib/ai/zaos-neuro-router.ts, src/lib/env.ts
- **ProviderRegistration**: src/lib/ai/zaos-neuro-router.ts
- **providerId**: src/app/api/brain/route.ts, src/app/api/router/providers/route.ts, src/app/api/webhooks/whatsapp/route.ts, src/app/api/zcc/semantica/decisions/route.ts, src/app/api/zcc/semantica/export/route.ts, src/components/zcc/panels/semantica-panel.tsx, src/lib/ai/cognitive-router.ts, src/lib/ai/cost-knowledge.ts

## D) Convenção de env de IA (SÓ NOMES — valores nunca lidos)

Chaves relacionadas a IA (84): AIRBNB_WEBHOOK_SECRET, AI_RATE_LIMIT_MAX, ALEXA_JWT_SECRET, ANTHROPIC_API_KEY, ASAAS_ACCESS_TOKEN, ASAAS_ALLOW_LEGACY_TOKEN, ASAAS_API_KEY, ASAAS_WEBHOOK_SECRET, AUGUST_API_KEY, BOOKING_COM_WEBHOOK_SECRET, CACHE_SIGNING_SECRET, CALENDAR_SYNC_SECRET, CEREBRO_DAILY_BUDGET_USD, CEREBRO_MONTHLY_BUDGET_USD, CLAUDE_MODEL, CRON_SECRET, DATABASE_BACKUP_PROVIDER, DATABASE_PROVIDER, DEEPINFRA_API_KEY, DEEPSEEK_API_KEY, ENCRYPTION_SECRET, FISCAL_PROVIDER, GEMINI_API_KEY, GITHUB_APP_WEBHOOK_SECRET, GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, GLM_5_2_API_KEY, GLM_BASE_URL, GLM_MODEL, GLM_PULSE_MODEL, GOOGLE_CLIENT_SECRET, GOOGLE_MAPS_API_KEY, GROQ_API_KEY, ICAL_SYNC_PROVIDER, IGLOOHOME_CLIENT_SECRET, INTERNAL_ENDPOINT_TOKEN, INTERNAL_SECRET, KIMI_K2_6_API_KEY, MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, META_ACCESS_TOKEN, META_APP_SECRET, META_BUDGET_ENFORCEMENT_DISABLED, META_BUDGET_GRATUITO_USD, META_BUDGET_LITE_USD, META_BUDGET_MAX_USD, META_BUDGET_PARCEIRO_USD, META_BUDGET_PRO_USD, META_CAPI_ACCESS_TOKEN, MISTRAL_API_KEY, MOONSHOT_API_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, NEXTAUTH_SECRET, NUKI_CLIENT_SECRET, OLLAMA_URL, OPENAI_API_KEY, OPENROUTER_API_KEY, PAYMENT_WEBHOOK_SECRET, QSTASH_TOKEN, QWEN_API_KEY, REDIS_TOKEN, RESEND_API_KEY, SECRET, SECRET_NAME, SEMANTICA_API_KEY, STRIPE_WEBHOOK_SECRET, TF_API_KEY, TTLOCK_CLIENT_SECRET, TUYA_CLIENT_SECRET, TWILIO_AUTH_TOKEN, UPSTASH_REDIS_REST_TOKEN, WEBHOOK_ALLOW_NO_SECRET, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PROVIDER, WHATSAPP_TOKEN, ZAI_API_KEY, ZCC_ADMIN_TOKEN, ZCC_GODMODE_TOKEN, ZCC_LLM_PROVIDER, ZEHLA_LOOP_API_KEY, ZELLA_NUCLEAR_TOKEN, ZHIPU_API_KEY
Total de chaves process.env em src/tests: 281

## E) Testes existentes

Total de arquivos de teste: 586
Suítes de segurança (tests/security/): graft/tests/security/admin-surface-regression.test.md, graft/tests/security/agent-tool-policy.test.md, graft/tests/security/api-routes-sast.test.md, graft/tests/security/asaas-legacy-auth-regression.test.md, graft/tests/security/asaas-webhook-body-limit.test.md, graft/tests/security/asaas-webhook-hmac.test.md, graft/tests/security/auth-session-revocation-lote3.test.md, graft/tests/security/backup-vps-certification.test.md, graft/tests/security/behavioral-certification.test.md, graft/tests/security/billing-idempotency.test.md, graft/tests/security/browser-isolation.test.md, graft/tests/security/bulk-whatsapp-tenant-isolation.test.md, graft/tests/security/certification-hardening.test.md, graft/tests/security/checkout-webhook-mpay011.test.md, graft/tests/security/checkout-webhook-regression.test.md, graft/tests/security/codex-security-integration.test.md, graft/tests/security/cron-auth-unified.regression.test.md, graft/tests/security/cron-auth.test.md, graft/tests/security/cron-billing-idempotency.test.md, graft/tests/security/cron-error-regression.test.md, graft/tests/security/diagnostic-surface-regression.test.md, graft/tests/security/endpoint-protection-audit.test.md, graft/tests/security/export-surface-regression.test.md, graft/tests/security/health-check-regression.test.md, graft/tests/security/health-provider-regression.test.md, graft/tests/security/idor-c1-endpoints.test.md, graft/tests/security/idor-checkout-paths.test.md, graft/tests/security/internal-surface-regression.test.md, graft/tests/security/landing-telemetry-regression.test.md, graft/tests/security/lgpd-guest-tenant-binding.test.md, graft/tests/security/locks-hardening.test.md, graft/tests/security/lote4-tenant-idor-exhaustive.test.md, graft/tests/security/lote5-reservation-concurrency.test.md, graft/tests/security/lote6-special-dates-upsell-hitl.test.md, graft/tests/security/lote7-partner-zella-suite.test.md, graft/tests/security/m2m-argon2.test.md, graft/tests/security/magic-auth-regression.test.md, graft/tests/security/mercadopago-service-regression.test.md, graft/tests/security/notification-error-leak.test.md, graft/tests/security/observability-infrastructure.test.md, graft/tests/security/payment-env-regression.test.md, graft/tests/security/payment-scope-and-webhooks.test.md, graft/tests/security/payment-scope-no-stripe.test.md, graft/tests/security/production-auth-canary.test.md, graft/tests/security/production-surface-regression.test.md, graft/tests/security/readiness-regression.test.md, graft/tests/security/reconciliation-lote3r-adversarial.test.md, graft/tests/security/redactor.test.md, graft/tests/security/refund-cancellation-lifecycle.test.md, graft/tests/security/reservation-payment-contract.test.md, graft/tests/security/rls-canaries.test.md, graft/tests/security/secret-exposure-regression.test.md, graft/tests/security/security-center-certification.test.md, graft/tests/security/security-scan-service.test.md, graft/tests/security/security-typesafety-audit.test.md, graft/tests/security/ssrf.test.md, graft/tests/security/telemetry-body-regression.test.md, graft/tests/security/telemetry-ingest-regression.test.md, graft/tests/security/telemetry-query-regression.test.md, graft/tests/security/tenant-idor-routes.test.md, graft/tests/security/tenant-isolation-adversarial.test.md, graft/tests/security/tenant-isolation-matrix.test.md, graft/tests/security/tenant-isolation-regression.test.md, graft/tests/security/unsafe-execution-regression.test.md, graft/tests/security/virgin-zella-fire-test-contract.test.md, graft/tests/security/waf-regression.test.md, graft/tests/security/wave1-security-p0.test.md, graft/tests/security/webhook-verify-regression.test.md, graft/tests/security/zcc-auth-policy.test.md, graft/tests/security/zcc-metrics-regression.test.md, graft/tests/security/zero-trust-hardening.test.md, tests/security/admin-surface-regression.test.ts, tests/security/agent-tool-policy.test.ts, tests/security/api-routes-sast.test.ts, tests/security/asaas-legacy-auth-regression.test.ts, tests/security/asaas-webhook-body-limit.test.ts, tests/security/asaas-webhook-hmac.test.ts, tests/security/auth-session-revocation-lote3.test.ts, tests/security/backup-vps-certification.test.ts, tests/security/behavioral-certification.test.ts, tests/security/billing-idempotency.test.ts, tests/security/browser-isolation.test.ts, tests/security/bulk-whatsapp-tenant-isolation.test.ts, tests/security/certification-hardening.test.ts, tests/security/checkout-webhook-mpay011.test.ts, tests/security/checkout-webhook-regression.test.ts, tests/security/codex-security-integration.test.ts, tests/security/cron-auth-unified.regression.test.ts, tests/security/cron-auth.test.ts, tests/security/cron-billing-idempotency.test.ts, tests/security/cron-error-regression.test.ts, tests/security/ddc-demo-honesty.test.ts, tests/security/ddc-revenue-honesty.test.ts, tests/security/diagnostic-surface-regression.test.ts, tests/security/endpoint-protection-audit.test.ts, tests/security/export-surface-regression.test.ts, tests/security/frontend-revenue-honesty.test.ts, tests/security/handover-suppression-regression.test.ts, tests/security/health-check-regression.test.ts, tests/security/health-provider-regression.test.ts, tests/security/idor-c1-endpoints.test.ts, tests/security/idor-checkout-paths.test.ts, tests/security/internal-surface-regression.test.ts, tests/security/landing-telemetry-regression.test.ts, tests/security/lgpd-guest-tenant-binding.test.ts, tests/security/lgpd-log-redaction.test.ts, tests/security/locks-hardening.test.ts, tests/security/lote4-tenant-idor-exhaustive.test.ts, tests/security/lote5-reservation-concurrency.test.ts, tests/security/lote6-special-dates-upsell-hitl.test.ts, tests/security/lote7-partner-zella-suite.test.ts, tests/security/m2m-argon2.test.ts, tests/security/magic-auth-regression.test.ts, tests/security/mercadopago-service-regression.test.ts, tests/security/notification-error-leak.test.ts, tests/security/observability-infrastructure.test.ts, tests/security/payment-env-regression.test.ts, tests/security/payment-scope-and-webhooks.test.ts, tests/security/payment-scope-no-stripe.test.ts, tests/security/production-auth-canary.test.ts, tests/security/production-surface-regression.test.ts, tests/security/r3-f03-checkout-idempotency.test.ts, tests/security/readiness-regression.test.ts, tests/security/reconciliation-lote3r-adversarial.test.ts, tests/security/redactor.test.ts, tests/security/refund-cancellation-lifecycle.test.ts, tests/security/reservation-payment-contract.test.ts, tests/security/revenue-status-integrity.test.ts, tests/security/rls-canaries.test.ts, tests/security/run10-w1-invariants.test.ts, tests/security/run10-w2-invariants.test.ts, tests/security/run11-w1-invariants.test.ts, tests/security/run11-w2-audit.test.ts, tests/security/run11-w2-cache.test.ts, tests/security/run11-w2-health.test.ts, tests/security/run11-w2-invariants.test.ts, tests/security/run11-w2-queue.test.ts, tests/security/run11-w2-ratelimit.test.ts, tests/security/run11-w3-wiring.test.ts, tests/security/run12-hygiene.test.ts, tests/security/run13-wiring-lote1.test.ts, tests/security/run14-wiring-lote23.test.ts, tests/security/run18-mopup.test.ts, tests/security/run19-hygiene.test.ts, tests/security/run4-wave4a-checkout-adversarial.test.ts, tests/security/run4-wave4b-pat-vault.test.ts, tests/security/run4-wave4c-guest-concierge.test.ts, tests/security/run4-wave4f-tenant-authority-idor.test.ts, tests/security/run6-guest-registration-fnrh.test.ts, tests/security/run6-hardening.test.ts, tests/security/run6-platform-plane.test.ts, tests/security/run6-tenant-isolation.test.ts, tests/security/run6b-lgpd-isolation.test.ts, tests/security/run6b-m2m-roles.test.ts, tests/security/run6b-push-primitive.test.ts, tests/security/run6b-unknown-zero.test.ts, tests/security/run7-baseline-invariants.test.ts, tests/security/run7-w2-middleware-invariants.test.ts, tests/security/run8-w1-invariants.test.ts, tests/security/run8-w2-invariants.test.ts, tests/security/run9-w1-invariants.test.ts, tests/security/run9-w2-invariants.test.ts, tests/security/secret-exposure-regression.test.ts, tests/security/security-center-certification.test.ts, tests/security/security-scan-service.test.ts, tests/security/security-typesafety-audit.test.ts, tests/security/ssrf.test.ts, tests/security/telemetry-body-regression.test.ts, tests/security/telemetry-ingest-regression.test.ts, tests/security/telemetry-query-regression.test.ts, tests/security/tenant-idor-routes.test.ts, tests/security/tenant-isolation-adversarial.test.ts, tests/security/tenant-isolation-matrix.test.ts, tests/security/tenant-isolation-regression.test.ts, tests/security/unsafe-execution-regression.test.ts, tests/security/virgin-zella-fire-test-contract.test.ts, tests/security/waf-regression.test.ts, tests/security/wave-r2-database-hardening.test.ts, tests/security/wave-r2-monetary-inventory.test.ts, tests/security/wave1-security-p0.test.ts, tests/security/wave12-f05-payment-webhook-resilience.test.ts, tests/security/wave12-f06-financial-ledger-upsell.test.ts, tests/security/wave12-f07-payment-concurrency-stress.test.ts, tests/security/wave12-f08-sre-observability.test.ts, tests/security/wave12-fronts-hardening.test.ts, tests/security/wave13-f01-rule-a.test.ts, tests/security/wave13-f02-rls-context.test.ts, tests/security/wave13-f03-zero-trust-ownership.test.ts, tests/security/wave13-f04-reservation-boundary.test.ts, tests/security/wave13-f05-f08-production-hardening.test.ts, tests/security/webhook-verify-regression.test.ts, tests/security/zcc-auth-policy.test.ts, tests/security/zcc-metrics-regression.test.ts, tests/security/zero-trust-hardening.test.ts
Testes relacionados a IA/roteamento: 193 — graft/src/__tests__/cerebro/contextual-bandits.test.md, graft/src/__tests__/cerebro/learning-engine.test.md, graft/src/__tests__/cerebro/orchestrator-real-tests.test.md, graft/src/__tests__/decision/DomainModels.test.md, graft/src/__tests__/decision/RouterPipeline.test.md, graft/tests/ai-prompt-eval-lgpd.test.md, graft/tests/airb-pro.test.md, graft/tests/brain/graph-rag-skills-finance.test.md, graft/tests/cerebro-ml-anti-hacker.test.md, graft/tests/cerebro-ml-auto-adjustment.test.md

## F) JEV — checagem de zero-integração

JEV_STATUS: **ZERO_INTEGRATION**
Refs: código=0 | docs=0 | testes=0
SDKs de IA declarados no package.json: NENHUM (JEV_SDK=NAO_DECLARADO confirmado)

## G) Foto da arquitetura

- src/lib/ai: 39 arquivos — backend-tool-authorizer.ts, batch-queue.ts, brain-persistence.ts, budget-guard.ts, circuit-breaker.ts, cognitive-router.ts, context-discretizer.ts, cost-knowledge.ts, cost-logger.ts, dspy/dspy-assertions.ts, dspy/dspy-evaluator.ts, dspy/dspy-signatures.ts, embedder.ts, headroom-client.ts, humanized-dialogue.ts, intent-router.ts, legacy-semantic-cache.ts, llm-adapters.ts, llm-router.ts, llm-timeout.ts, pii-guard.ts, prompt-caching.ts, redis-cache.ts, semantic-cache.ts, semantic-rag.ts, skills/skill-orchestrator.ts, special-dates/hitl-service.ts, tf-client.ts, tier-distributor.ts, tool-calling.ts, tool-discovery.ts, tool-output-cap.ts, tool-policy.ts, tool-registry.ts, tools/dynamic-yield-engine.ts, tools/yield-profit-tracker.ts, vector-embedder.ts, whatsapp-guardrails.ts, zaos-neuro-router.ts
- src/lib/infra: 11 arquivos — audit.ts, cache.ts, health.ts, internal-secret.ts, logger.ts, optional-require.ts, queue.ts, rate-limit.ts, ssrf-guard.ts, wiring-registry.ts, wiring.ts
- Rotas de API (src/app/api/**/route.ts): 320
- middleware: presente
- tsconfig alias "@/*": presente
- Arquivos de código varridos: 3022

## Notas de escopo

- READ-ONLY: nenhum arquivo do projeto foi criado/modificado nesta onda.
- Nenhum valor de variável de ambiente foi lido (apenas NOMES de chaves).
- DEAD CODE: marcado como UNREFERENCED_CANDIDATE (⚠) apenas quando nenhum import localiza o módulo — a prova de morte exige grafo completo (onda futura).
- Classificação segue a diretiva: REAL CODE / DOC ONLY / TEST ONLY / MOCK (DEAD CODE como candidato).
- Nada aqui afirma integração JEV existente; a diretiva manda tratar como ZERO INTEGRAÇÃO até prova em contrário.
