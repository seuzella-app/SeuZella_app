# F28 — IMPLEMENTATION REPORT (FASE K artefato)

Data: 2026-09-28 · Base 95b2491b · 100% LOCAL (sem commit/push)

## Arquivos alterados (código)

| # | Arquivo | Δ | Motivo |
|---|---------|---|--------|
| 1 | `src/lib/payments/pricing.ts` | M | F28-A: parceiro 297→247 (pix/cartão) 307→257 (boleto, regra da casa) + regra canônica em comentário |
| 2 | `src/components/landing/PricingSection.tsx` | M | F28-A: card PARCEIRO pousada 297→247 + desc/feature + economia R$150 |
| 3 | `src/app/parceiro/page.tsx` | M | F28-A: 3 ocorrências 297→247 (timeline, badge fundador) |
| 4 | `src/app/api/webhooks/payment/route.ts` | M | F28-A: banda 247→parceiro (antes lite); resolvePlanTier/AMOUNT_TO_TIER exportados p/ contrato |
| 5 | `src/lib/notifications/catalog.ts` | M | F28-C: 4 tipos plan.* adicionados (BUG: alertas nunca eram entregues) |
| 6 | `src/lib/notifications/plan-limits-checker.ts` | M | F28-C/D: consome quotas do entitlements; usage UNKNOWN (Math.random removido); não notifica sem dado |
| 7 | `src/lib/entitlements/index.ts` | **N** | F28-B: motor PLAN→ENTITLEMENT→QUOTA→USAGE→ENFORCEMENT (checkQuota, getMonthlyUsage, resolveEntitlement, normalizePlan) |
| 8 | `src/lib/realtime/redis-pubsub.ts` | M | F28-E: seq global (INCR), dedup watermark, artefato `mode:` removido |
| 9 | `src/lib/realtime/replay.ts` | **N** | F28-E: TenantReplayBuffer (100/tenant) + gap-aware planReplay |
| 10 | `src/app/api/ddc/realtime/tenant-state/route.ts` | M | F28-E: afterSeq via query, gap→snapshot resync, fetchSnapshot extraído, comentários corrigidos |
| 11 | `src/components/ddc/use-tenant-realtime-state.ts` | M | F28-E: lastSeqRef + `?afterSeq=` na reconexão manual |
| 12 | `src/app/api/readiness/route.ts` | M | F28-E: productionWarnings REALTIME_MEMORY_TRANSPORT |

## Arquivos de teste

| # | Arquivo | Δ | Conteúdo |
|---|---------|---|----------|
| 13 | `tests/commercial/parceiro-pricing-canonical.test.ts` | **N** | Contrato anti-297, 247/24meses, paridade PRO, bandas do webhook, quotas |
| 14 | `tests/entitlements/entitlements-engine.test.ts` | **N** | Matrix de quotas, normalização, enforcement (abaixo/exato/acima), DB falha, fail_closed/fail_open |
| 15 | `src/__tests__/notifications/plan-limits-checker.test.ts` | M | Reescrito: thresholds reais via DB mock, unavailable/partial, anti-fabricação |
| 16 | `tests/realtime/tenant-pubsub-multiinstance.test.ts` | **N** | 2 instâncias simuladas com Redis fake: cross-instance, seq global, dedup, isolamento |
| 17 | `tests/realtime/replay-gap.test.ts` | **N** | Planner puro: replay contínuo, gap, trimming, cross-instance resync |
| 18 | `tests/realtime/use-tenant-realtime-state.test.ts` | M | Contrato de fonte atualizado ao design F28-E |
| 19 | `tests/security/billing-idempotency.test.ts` | M | payload amount 297→247 (higiene canônica) |

## Resultados (sandbox)

- `tsc --noEmit`: **EXIT 0**
- `npm run lint`: **EXIT 0** (0 errors)
- `npm test` (COMPLETA): **EXIT 0 — 3279 passed / 45 skipped / 0 failed** (323 arquivos)
- `test:sast`: **PASS 3/3**
- `npm run build`: compile ✓ + tsc ✓ — fase final OOM no sandbox (4GB, HUB residente); **build FULL é etapa obrigatória do dono no iMac**

## Intocados por design (F28-F)

F03/F06/F07/CSPRNG/CORS (F26.5+F27) · UPSELL · live-feed isolation · billing idempotency · plan-features.ts (fonte de taxonomia) · plan-resolver.ts
