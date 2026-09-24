# RUN9-W2 V2 — RELATORIO DE FECHAMENTO RUN9 (patches 9C + 9F + residuais)

Data: 2026-09-18 17:11:48
HEAD: 819bb5671fc4ea82fb92a3af2f73b4f2599ea230 (branch feat/meta-zella-foundation) | tags RUN7+RUN8: presentes

## PATCH
- 9C guard airbnb: APPLIED (src/app/api/zcc/airbnb/webhook/route.ts @POST/request)
- 9F margem run4-wave4a: APPLIED (tests/security/run4-wave4a-checkout-adversarial.test.ts: Date.now() + 1_800_001 -> Date.now() + 7_200_001)
- arquivos tocados: 2
- backup: /Users/marciocau/SeuZella_project/99_AUDITS/RUN9_W2_20260918_170648/backup/

## NOTA 9F (causa raiz do RED da V1)
- O teste run4-wave4a item 7 gerava Date.now() + 1_800_001 (30min+1ms) e verificava
  contra Date.now() interno: se >=1ms passa entre generate e verify, o offset cai
  para 1_800_000 (dentro da tolerância) e o verify retorna true (esperava false).
- CÓDIGO DE PRODUÇÃO CORRETO — o bug era a margem de 1ms do teste. V2 usa 7_200_001 (2h).

## RESIDUAIS (documentados em RESIDUALS.json)
- RES-9C-1: guard airbnb — PATCHED
- RES-9C-2: idempotência booking-com/reviews — onda dedicada
- RES-9D-1: Float money 5 models/6 campos — RUN9_W3_REMEDIATION_PLAN.md

## VERIFY
- vitest run9w2 : PASS (5s)
- vitest full   : PASS (47s)
- typecheck     : PASS (15s)
- lint          : PASS (70s)
- build         : PASS (161s)

## DECISION: RUN9-W2 V2 GREEN_WITH_RESIDUALS
- residuais documentados (9C-2 idempotência booking-com, 9D Float->Decimal staging no plano RUN9-W3)

## NOTA OPERACIONAL (importante)
- O guard fail-closed usa header 'x-airbnb-webhook-token' vs env AIRBNB_WEBHOOK_SECRET.
- ATÉ configurar AIRBNB_WEBHOOK_SECRET no ambiente, o webhook responde 401 para TODAS as chamadas (fail-closed, padrão RES-01).
- Configure a mesma chave no emissor do webhook (header x-airbnb-webhook-token).
