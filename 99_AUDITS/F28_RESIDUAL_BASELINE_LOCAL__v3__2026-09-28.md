# F28 — RESIDUAL CLOSURE · FASE 0: BASELINE LOCAL (sandbox)

Data: 2026-09-28 · Executante: GLM (agente principal) · Ambiente: sandbox de trabalho (100% local)

## 1. Confirmações de estado (antes de qualquer edição)

| Item | Valor |
|------|-------|
| Origem | `https://github.com/seuzella-app/SeuZella_app.git` (clone leitura-only) |
| HEAD | `95b2491b2d01d2a058b82b84555ee25d74d18569` (baseline certificada) |
| Histórico presente | `4824123` → `32b6cc0` (F26.5+F27) → `95b2491b` (auditorias) |
| Working tree | limpo no clone; **nenhum commit/push será feito nesta execução** |
| Regra | 100% local; commit só após aprovação do dono no iMac |

## 2. Mapa de arquivos por domínio

### 2.1 Comercial PARCEIRO (FASE A)
- `src/lib/payments/pricing.ts` — **FONTE DE checkout**. Contradição interna: comentário linha 24 "PARCEIRO: R$247 flat" vs matriz linha 39 `parceiro: { pix: 297, cartao: 297, boleto: 307 }`.
- `src/components/landing/PricingSection.tsx` — card PARCEIRO variante pousada com 297 (linhas 93–95, 100, 111, 128); variante airbnb já correta (247).
- `src/app/parceiro/page.tsx` — 3 ocorrências 297 (linhas 119, 120, 289) conviveram com 247 (215, 419, 467) e economia "R$150" (linha 291 — só fecha com 247).
- `src/app/api/webhooks/payment/route.ts` — `AMOUNT_TO_TIER`: banda `197–247 → lite` e `247.01–396.99 → parceiro`. Com 247 canônico, fallback rotularia PARCEIRO como LITE.
- Checkout create/upgrade/downgrade consomem `getPrice()` → corrigir a matriz corrige o checkout.
- `plan-features.ts` — ÍNTEGRO: `PLAN_DISPLAY.parceiro.price = 247`, `TIER_LEVEL.parceiro = 2` (paridade PRO), value prop 24 meses. **Não alterar.**
- `partner-service.ts` — `monthlyPrice: 247.0` (x2). Íntegro.
- `LOTE7_PARTNER_ZELLA_IMPLEMENTATION_PLAN.md` — regra canônica documentada: R$247/mês, contrato 24 meses, paridade PRO, 100 vagas.

### 2.2 Entitlement (FASE B)
- `plan-features.ts` — taxonomia, TIER_LEVEL/hasAccess, DDC_TABS, PLAN_DISPLAY.
- `plan-resolver.ts` — `getEffectivePlan()` fail-closed para `gratuito` em erro; migra legado.
- **Inexistente**: camada única server-side entitlement/quota/usage/enforcement.

### 2.3 Quotas/Usage (FASE C/D)
- `src/lib/notifications/plan-limits-checker.ts` — hoje ÚNICA autoridade (50/500 hardcoded) + **fallback Math.random que fabrica usage** (linhas 64–77: `35 + rand*20`, `350 + rand*200`).
- Consumidores: `src/app/api/cron/plan-limits-check/route.ts` (L45), `fire.test.ts` (L597–613), `plan-limits-checker.test.ts`.

### 2.4 Realtime multi-instance (FASE E)
- `src/lib/realtime/tenant-pubsub.ts` — re-export (compat).
- `src/lib/realtime/redis-pubsub.ts` — Redis pub/sub + fallback in-memory. **Artefato de reconciliação**: label `mode:` órfão + comentário quebrado (L121–124). `seq` in-process (comentário admite que deveria ser INCR).
- `src/app/api/ddc/realtime/tenant-state/route.ts` — SSE com replay buffer in-memory (100/tenant), Last-Event-ID só por HEADER, heartbeat 30s, rate-limit, CORS F27. Comentário "MULTI-INSTANCE LIMITATION" desatualizado (diz in-memory).
- `src/components/ddc/use-tenant-realtime-state.ts` — guarda `lastSeq` mas **nunca envia na reconexão manual** (comentário promete o contrário).
- `src/lib/queue/bullmq-queue.ts` — `getRedisConnection()` retorna null sem `REDIS_URL`/`REDIS_CONNECTION_STRING`.
- `src/lib/infra/health.ts` — mecanismo `registerCheck` existe mas **nenhum check registrado**; readiness só reporta envs.

## 3. Problemas confirmados (escopo definitivo)

1. **A**: 297 ativo em pricing.ts (checkout real), PricingSection (pousada) e /parceiro (3 pontos); banda de tier do webhook incompatível com 247.
2. **B**: ausência de entitlement server-side unificado (plan→entitlement→quota→usage→enforcement).
3. **C**: quotas LITE hardcoded no checker de notificação (autoridade dupla).
4. **D**: usage fabricado com Math.random quando DB falha (risco de notificação/cobrança sobre dado falso).
5. **E**: seq não global entre instâncias; reconexão manual não envia Last-Event-ID; gap de replay silencioso; artefato `mode:`; comentários mentirosos; readiness cego para transporte.

## 4. Falsos positivos descartados (NÃO alterar)

- `src/lib/zcc/agents/real.ts:62` (mrr PRO 297) — mock interno de painel ZCC, taxonomia reduzida; não é PARCEIRO.
- `src/app/api/zcc/metrics/route.ts:34` (starter/pro/business) — taxonomia legada inexistente no catálogo (migrada por `migratePlanLegacy`); mock de métricas; não é PARCEIRO.
- `BrazilianGeography.ts` / `MapsMock.ts` (lat −22.7297) — coordenadas geográficas.
- `cerebro-*.tsx` (247/1247) — métricas fictícias de painéis demo.
- `LinkInBioDemo.tsx:202` ("R$150 de desconto vs. PRO") — consistente com 397−247=150. Correto.
- UPSELL (mensal/temporal) — resolvido pelo dono; fora do escopo por ordem.
- live-feed — já possui tenant + rate limit + filtro por banco; fora do escopo por ordem.
- `Math.random` em scrapers/simuladores/upsell mock/firetests — não é usage de billing.

## 5. Regras inquebráveis desta execução

- PARCEIRO = R$247/mês · congelado 24 meses · paridade PRO. R$297 não é preço válido.
- Sem replace cego de "297": cada ocorrência classificada (Seção 4).
- Sem commit · sem push · sem PR · sem deploy. Patch/ZIP ao final.
- F26.5/F27 (F03/F06/F07/CSPRNG/CORS) intocados salvo regressão comprovada por teste.
