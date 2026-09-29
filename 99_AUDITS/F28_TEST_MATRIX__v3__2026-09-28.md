# F28 — TEST MATRIX (FASE K artefato)

Suíte completa: 3279 passed / 45 skipped / 0 failed (323 arquivos) · EXIT 0 · sandbox, 28/set

## Novos contratos F28 (63 testes em 5 arquivos + 1 atualizado)

| Domínio | Arquivo | Casos-chave | Status |
|---|---|---|---|
| Comercial anti-297 | tests/commercial/parceiro-pricing-canonical.test.ts (13) | matriz 247/257 · quotes · display · scan de código executável das 4 superfícies · 24 meses · paridade tier(2) · quotas unlimited · LITE 50/500 · bandas webhook 247→parceiro | PASS |
| Entitlements | tests/entitlements/entitlements-engine.test.ts (17) | matrix de quotas (5 planos) · normalizePlan legados/inválido · usage real · usage UNKNOWN · enforcement abaixo/exato/acima · unlimited sem tocar DB · mudança de plano · fail_closed/fail_open · resolveEntitlement fail-closed | PASS |
| Quota notifications | src/__tests__/notifications/plan-limits-checker.test.ts (19) | 80% guests/messages · 100% exceeded · acima · upgrade suggestion · gratuito=LITE · PRO/MAX/PARCEIRO healthy · DB down = 0 notificações + 0 fabricados · partial · tenant fantasma · shape F28 | PASS |
| Multi-instance | tests/realtime/tenant-pubsub-multiinstance.test.ts (5) | A→B delivery · seq GLOBAL igual nas 2 · dedup na publicadora · seq crescente · isolamento tenant-x≠y · fallback memory · tenantId vazio | PASS |
| Replay/Last-Event-ID | tests/realtime/replay-gap.test.ts (9) | contínuo replay exato · caught-up vazio · buffer alheio → gap · empty → gap · oldest>afterSeq+1 → gap · cross-instance resync · NaN/negativo · trimming 100 | PASS |
| Contrato de fonte SSE | tests/realtime/use-tenant-realtime-state.test.ts (21) | + Last-Event-ID resume com gap-aware replay (F28-E) | PASS |

## Regressão F26.5+F27 (intocados, provados pela suíte completa)

- 34 testes da onda de segurança (gateway F03, orchestrator F06, cron F07, CORS F27): PASS dentro da suíte completa
- Billing idempotency: PASS (payload atualizado 297→247 por higiene)
- SAST estático: PASS 3/3
