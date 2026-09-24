# RUN10-W1 — MATRIZ DE EVIDÊNCIAS (IA / Cérebro / Machine Learning)

Data: 2026-09-18 20:11:52 | leitura pura, nada modificado

## Totais
- rotas API: 311 | rotas de IA: 54 | arquivos com SDK de IA: 6 | call sites LLM/embedding: 5
- models de IA/memória: 24 | jobs/cron de IA: 1 | chaves env de IA (nomes): 4

## Findings
- [P3] 10A — chamadas LLM/embedding presentes no código (inventário para governança de custos) :: src/app/api/zcc/pulse/analyze/route.ts (chat.completions.create), src/lib/ai/embedder.ts (.embed(), src/lib/ai/llm-adapters.ts (generateContent), src/lib/cerebro/alert-bus.ts (messages.create), src/lib/zcc/agents/llm-engine.ts (chat.completions.create)
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (AgentConfig) :: AgentConfig: confidenceScore
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (AgentLog) :: AgentLog: costUsd
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (ConversationLog) :: ConversationLog: aiConfidence
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (AirBMessage) :: AirBMessage: costUsd
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (AirbOperationTask) :: AirbOperationTask: cost
- [P2] 10B — campo de score/confiança de ML como Float em model de IA (CerebroKnowledgeFact) :: CerebroKnowledgeFact: confidence
- [P1] 10C — possível chave de API de IA hardcoded em código (rodar rotação imediata se confirmado; valor NÃO impresso por segurança) :: src/lib/cerebro/code-reviewer/secret-redactor.ts:L279
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/agents/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/airb-pro/comparativo/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/airb-pro/rentabilidade/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/airb-pro/yield-suggestion/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/airb-test/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/airb-test/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/brain/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/campaigns/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/campaigns/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/campaigns/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/cron/booking-daily/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/cron/booking-daily/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/cron/cerebro-churn-predict/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/cron/cerebro-churn-predict/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/cron/dlq-drain/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/cron/dlq-drain/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/cron/locks-maintenance/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/cron/locks-maintenance/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/ai-status/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/conversations/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/airb/conversations/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/notifications/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/airb/notifications/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/onboarding/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/airb/onboarding/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/properties/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/regional/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/airb/regional/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb/scrape/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/commissions/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/expenses/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/goals/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/goals/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/operations/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/operations/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/airb-pro/reports/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/partner-program/claim/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/partner-program/claim/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/partner-program/waitlist/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/ddc/partner-program/waitlist/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/training/[id]/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/ddc/training/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/debug-agent/github/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/debug-agent/github/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/debug-agent/knowledge/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/debug-agent/knowledge/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/debug-agent/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/knowledge/generate-embeddings/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/landing/chat/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/landing/chat/route.ts
- [P2] 10D — rota de IA sem sinal de verificação de sessão/auth :: src/app/api/zcc/agents/[id]/run/route.ts
- [P2] 10D — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) :: src/app/api/zcc/agents/[id]/run/route.ts

## Superfície de IA (10A)
- src/app/api/agent-logs/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/agents/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: sinal OK
- src/app/api/airb-pro/comparativo/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/airb-pro/rentabilidade/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/airb-pro/yield-suggestion/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/airb-test/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/brain/health/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/brain/intents/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/brain/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/campaigns/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/campaigns/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/cron/booking-daily/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/cron/cerebro-churn-predict/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: sinal OK
- src/app/api/cron/dlq-drain/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/cron/locks-maintenance/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/ai-status/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/conversations/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/notifications/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/onboarding/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/properties/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/regional/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb/scrape/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/commissions/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/commissions/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/expenses/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/expenses/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/goals/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/goals/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/operations/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/operations/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/airb-pro/reports/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/partner-program/claim/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/partner-program/waitlist/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/revenue-details/route.ts | auth: sinal OK | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/training/[id]/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/ddc/training/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/debug-agent/github/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/debug-agent/knowledge/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/debug-agent/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/knowledge/generate-embeddings/route.ts | auth: AUSENTE | rate limit: sinal OK | bound de tokens/timeout: AUSENTE
- src/app/api/landing/chat/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/agents/[id]/run/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/agents/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/airbnb/oauth/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/airbnb/webhook/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/brain/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/campaigns/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/cerebro/llmops/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/cerebro/ml-stats/route.ts | auth: sinal OK | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/cognitive-memory/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zcc/leads/brain-analyze/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: sinal OK
- src/app/api/zcc/pulse/analyze/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zelador-suporte/chat/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: AUSENTE
- src/app/api/zella/simulate/route.ts | auth: AUSENTE | rate limit: AUSENTE | bound de tokens/timeout: sinal OK

## SDKs importados (10A)
- src/app/api/zcc/pulse/analyze/route.ts -> z-ai-web-dev-sdk
- src/lib/ai/zaos-neuro-router.ts -> z-ai-web-dev-sdk
- src/lib/cerebro/best-practices.ts -> @upstash/ratelimit
- src/lib/cerebro/refactor-suggester.ts -> @upstash/ratelimit
- src/lib/queue/redis-queue-service.ts -> @upstash/redis
- src/lib/zcc/agents/llm-engine.ts -> z-ai-web-dev-sdk

## Models de IA/memória (10B)
- AgentConfig | **Float ML: confidenceScore**
- AgentLog | **Float ML: costUsd**
- AIActivityLog
- ConversationLog | **Float ML: aiConfidence**
- ConversationMessage
- KnowledgeEntry
- AirBProperty
- AirBConversation
- AirBMessage | **Float ML: costUsd**
- AirBRegionalKnowledge
- AirBScrapingJob
- AirBSubscription
- AirBTransaction
- AirbnbWebhookEvent
- AirbnbOAuthToken
- KnowledgeChunk
- BrainHealthLog
- AirbExpense
- AirbOperationTask | **Float ML: cost**
- AirbGoal
- AirbCommission
- AirbTrialSignup
- AirbReport
- CerebroKnowledgeFact | **Float ML: confidence**

## Segredos (10C) — valores NUNCA impressos
- src/lib/cerebro/code-reviewer/secret-redactor.ts | hardcoded: SIM (L279) | use client + env IA: não | NEXT_PUBLIC IA: não

## Jobs/cron de IA (10E)
- src/lib/queue/redis-queue-service.ts | $transaction: não | idempotência: AUSENTE

## Próximo passo
- RUN10-W2: patches 10A-10E sobre estas evidências (mesmo padrão RUN8-W2/RUN9-W2).
