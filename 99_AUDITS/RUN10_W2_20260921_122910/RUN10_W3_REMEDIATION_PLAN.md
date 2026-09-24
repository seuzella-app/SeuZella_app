# RUN10-W3 — PLANO DE REMEDIAÇÃO (IA/CÉREBRO/ML)

Gerado por RUN10-W2 em 2026-09-21T15:29:11.153Z a partir de RUN10_AI_INVENTORY.json (W1).

## Contexto
- W2 tratou o P1 R10-8 (status: NO_LITERAL_FOUND, literais neutralizados: 0) e aplicou rate-limit (10B: 7 rotas) + timeouts (10C: 0 chamadas) + ai-env (10E).
- Este plano cobre os residuais categorizados que NÃO são autopatcheáveis com segurança.

## Categoria GUARD (30 item(ns))
- [P2] R10-13 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/airb-test/route.ts)
- [P2] R10-16 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/campaigns/[id]/route.ts)
- [P2] R10-17 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/campaigns/route.ts)
- [P2] R10-19 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/cron/booking-daily/route.ts)
- [P2] R10-21 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/cron/cerebro-churn-predict/route.ts)
- [P2] R10-23 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/cron/dlq-drain/route.ts)
- [P2] R10-25 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/cron/locks-maintenance/route.ts)
- [P2] R10-27 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/ai-status/route.ts)
- [P2] R10-28 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/conversations/route.ts)
- [P2] R10-30 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/notifications/route.ts)
- [P2] R10-32 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/onboarding/route.ts)
- [P2] R10-34 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/properties/route.ts)
- [P2] R10-35 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/regional/route.ts)
- [P2] R10-37 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb/scrape/route.ts)
- [P2] R10-38 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/commissions/[id]/route.ts)
- [P2] R10-39 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/expenses/[id]/route.ts)
- [P2] R10-40 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/goals/[id]/route.ts)
- [P2] R10-41 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/goals/route.ts)
- [P2] R10-42 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/operations/[id]/route.ts)
- [P2] R10-43 — rota de IA sem sinal de verificação de sessão/auth (src/app/api/ddc/airb-pro/operations/route.ts)
- ... +10 (ver RESIDUALS.json)
- Remediação: descobrir API de sessão do projeto (RUN7) e aplicar wrapper por rota com rehearsal

## Categoria OBS (5 item(ns))
- [P3] R10-1 — chamadas LLM/embedding presentes no código (inventário para governança de custos) (src/app/api/zcc/pulse/analyze/route.ts (chat.completions.create), src/lib/ai/embedder.ts (.embed(), src/lib/ai/llm-adapters.ts (generateContent), src/lib/cerebro/alert-bus.ts (messages.create), src/lib/zcc/agents/llm-engine.ts (chat.completions.create))
- [P2] R10-3 — campo de score/confiança de ML como Float em model de IA (AgentLog) (AgentLog: costUsd)
- [P2] R10-4 — campo de score/confiança de ML como Float em model de IA (ConversationLog) (ConversationLog: aiConfidence)
- [P2] R10-5 — campo de score/confiança de ML como Float em model de IA (AirBMessage) (AirBMessage: costUsd)
- [P2] R10-6 — campo de score/confiança de ML como Float em model de IA (AirbOperationTask) (AirbOperationTask: cost)
- Remediação: RUN11 cobre métricas/custos; token budget na W3

## Categoria OTHER (2 item(ns))
- [P2] R10-2 — campo de score/confiança de ML como Float em model de IA (AgentConfig) (AgentConfig: confidenceScore)
- [P2] R10-7 — campo de score/confiança de ML como Float em model de IA (CerebroKnowledgeFact) (CerebroKnowledgeFact: confidence)
- Remediação: classificar a partir do título/evidência

## Categoria RATELIMIT (15 item(ns))
- [P2] R10-9 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/agents/route.ts)
- [P2] R10-10 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/airb-pro/comparativo/route.ts)
- [P2] R10-11 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/airb-pro/rentabilidade/route.ts)
- [P2] R10-12 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/airb-pro/yield-suggestion/route.ts)
- [P2] R10-15 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/brain/route.ts)
- [P2] R10-18 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/campaigns/route.ts)
- [P2] R10-20 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/cron/booking-daily/route.ts)
- [P2] R10-22 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/cron/cerebro-churn-predict/route.ts)
- [P2] R10-24 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/cron/dlq-drain/route.ts)
- [P2] R10-26 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/cron/locks-maintenance/route.ts)
- [P2] R10-46 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/ddc/partner-program/claim/route.ts)
- [P2] R10-48 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/ddc/partner-program/waitlist/route.ts)
- [P2] R10-52 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/debug-agent/github/route.ts)
- [P2] R10-54 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/debug-agent/knowledge/route.ts)
- [P2] R10-55 — rota de IA sem sinal de rate limit (risco de custo descontrolado por abuso) (src/app/api/debug-agent/route.ts)
- Remediação: classificar a partir do título/evidência

## Categoria SECRET (1 item(ns))
- [P1] RES-10A-1 — P1 R10-8 (secret-redactor.ts:L279) status: NO_LITERAL_FOUND (src/lib/cerebro/code-reviewer/secret-redactor.ts)
- Remediação: classificar a partir do título/evidência

## Lembretes de ondas anteriores
- RUN9-W3 (PENDENTE): Float money -> Decimal(12,2) em 5 models/6 campos — plano em 99_AUDITS/RUN9_W2_*/RUN9_W3_REMEDIATION_PLAN.md
- RUN11 (próximo): Redis/Queues/Observability — rate-limit de 10B migra store para REDIS_URL opcional.

## Guard-rails do W3
- Nenhuma onda aplica patch cego: rehearsal + verify completa (typecheck/lint/build/testes) + rollback automático.
- Rotas de máquina (cron/internal/webhook/m2m) ficam FORA de rate-limit por IP.
