# F28 — RESIDUAL CLOSURE · AUDITORIA FINAL DE RESÍDUOS (FASE I)

Data: 2026-09-28 · Base: 95b2491b + mudanças F28 (working tree, sem commit)

## 1. Varredura pós-implementação — "297" em src/

| Ocorrência | Classificação | Ação |
|---|---|---|
| `src/lib/payments/pricing.ts:27` | **Documentação canônica** (comentário: "R$297 NÃO é preço válido") | Mantida — é a própria regra |
| `src/lib/zcc/agents/real.ts:62` (mrr PRO 297) | Mock interno de painel ZCC, taxonomia reduzida (não é PARCEIRO) | Registrada — legado não-comercial, limpeza futura opcional |
| `src/app/api/zcc/metrics/route.ts:34` (starter/pro/business) | Taxonomia legada migrada por `migratePlanLegacy`; mock de métricas (não é PARCEIRO) | Registrada — idem |
| `BrazilianGeography.ts:68` / `MapsMock.ts:31` (−22.7297) | Coordenadas geográficas (falso positivo) | Nenhuma |

**Prova automatizada:** `tests/commercial/parceiro-pricing-canonical.test.ts` escaneia o código EXECUTÁVEL (comentários excluídos) das 4 superfícies comerciais ativas — PASS.

## 2. Varredura pós-implementação — Math.random em src/lib

| Ocorrência | Classificação |
|---|---|
| `lib/ml/graph-rag.ts` (IDs de nós) | Não-billing, não-segurança — mantida |
| `lib/scraping/PropertyScrapingEngine.ts` (dados sintéticos) | Gerador de amostras — mantida |
| `lib/upsell/upsell-engine.ts` (mock local) | Mock declarado — mantida |
| `lib/notifications/plan-limits-checker.ts` | **REMOVIDO (F28-D)** — 0 ocorrências agora |
| `lib/entitlements/index.ts` | **0 ocorrências** — usage UNKNOWN quando DB falha |

## 3. Estado por domínio

### COMERCIAL (F28-A) — GREEN
- `PRICING_MATRIX.parceiro = { pix: 247, cartao: 247, boleto: 257 }` (boleto = pix+10, regra da casa)
- Landing `PricingSection` (pousada + airbnb): 247; economia "R$150 vs PRO" corrigida (397−247)
- `/parceiro`: 3 ocorrências 297→247; tabela e economias agora internamente consistentes
- Webhook `AMOUNT_TO_TIER`: 247 → `parceiro` (antes iria para `lite`); 297 legado → `parceiro` (sem efeito comercial)
- `plan-features.ts` e `partner-service.ts`: já corretos (247/24 meses/paridade) — intocados

### ENTITLEMENTS (F28-B) — GREEN
- Novo: `src/lib/entitlements/index.ts` — PLAN→ENTITLEMENT→QUOTA→USAGE→ENFORCEMENT
- Compõe (não duplica): plan-features (taxonomia), plan-resolver (fail-closed gratuito)

### QUOTA/USAGE (F28-C/D) — GREEN
- Catálogo único de quotas no entitlements; checker vira consumidor (notificação apenas)
- Math.random REMOVIDO; DB indisponível → `status: unavailable/partial`, `available: false`, ZERO notificações
- **BUG PRÉ-EXISTENTE DESCOBERTO E CORRIGIDO**: tipos `plan.*` não existiam no catálogo → `notify()` rejeitava todas as alertas de limite como `invalid_input` (usuários nunca receberam). 4 entradas adicionadas ao catálogo.

### REALTIME (F28-E) — GREEN
- `seq` global via Redis INCR (comparável entre instâncias); fallback in-memory para dev
- Dedup por watermark (corrige dupla entrega pré-existente na instância publicadora)
- Artefato `mode:` label removido; comentários mentirosos corrigidos
- Replay: `TenantReplayBuffer` extraído (100/tenant) + gap detection → resync por snapshot (nunca replay parcial silencioso)
- Cliente: reconexão manual agora envia `?afterSeq=<lastSeq>` (promessa antiga cumprida)
- Readiness: `productionWarnings: REALTIME_MEMORY_TRANSPORT` quando produção sem Redis (não silencioso; REDIS_URL NÃO virou required)

## 4. Riscos residuais registrados (para F30+)

1. Mocks internos com preços legados (real.ts, metrics route) — cosmetic, fora do comercial
2. LITE-cartão(247) × PARCEIRO(247) colisão no fallback por amount — resolvida a favor de PARCEIRO; metadata.planType sempre prevalece
3. Replay buffer é por instância (100 eventos) — gaps inter-instância agora DETECTADOS e resincronizados por snapshot
4. `REDIS_URL` continua opcional — produção single-instance roda com warning explícito no /api/readiness
5. `next build` completo não executável no sandbox (OOM 4GB) — tsc completo EXIT=0 + compile ✓; build FULL é etapa obrigatória do dono no iMac
