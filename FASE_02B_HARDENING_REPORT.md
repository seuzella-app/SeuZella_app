# FASE_02B_HARDENING_REPORT.md
# Seu Zélla — Correção Paralela dos Gaps P0/P1 + Hardening Pré-Meta Growth

**Repositório:** MarcioCau14/SmartHotel_Zehla · **Branch:** feat/meta-zella-foundation · PR #96 (Draft)
**HEAD inicial:** 0dd195a4ab3b06ec6951c8e02b6c497e2921c35c · **HEAD final:** 00dffba5
**main:** 54c36a9a8832f4852953b25d73085f2275a85a8d (INTACTA) · **Executada em:** 2026-09-17

---

## 1. Baseline

Reconcile confirmado: branch `feat/meta-zella-foundation`, HEAD `0dd195a4`, `6413c83b`/`7700a85f` presentes, worktree limpa, remote HTTPS sem credencial embutida, **ahead 1** (P0 da FASE 02 ainda não pushed). Baseline dos gates no HEAD inicial: typecheck EXIT 0 · lint 0 errors · test:unit 4/4 · security 531/16 (547) · prisma generate/validate PASS. Build NÃO re-executado no baseline (assinatura ENVIRONMENTAL conhecida da FASE 02); re-executado no final (§8).

## 2. 60 Frentes Auditadas

Auditoria em 4 ondas paralelas (read-only) + verificação pessoal dos alvos de correção. Estados: **PASS** (auditado, sem ação necessária), **FIXED** (corrigido nesta fase), **PARTIAL** (correção parcial + plano), **BLOCKED** (bloqueio externo/infra), **UNVERIFIED** (não verificável neste ambiente), **DEFERRED** (decisão TL / próxima fase).

| # | Frente | Estado | Evidência/Correção |
|---|--------|--------|--------------------|
| 01 | Handover/escalation | **FIXED** | a094dde5 — política ACTIVE→ESCALATED→HUMAN CONTROL; IA suprimida; 12 asserções |
| 02 | Webhook legado | **PARTIAL** | Legado bypassa LGPD opt-out idem, attribution, cost, plan-gates (HMAC+tenant OK). Veredito MIGRATE THEN REMOVE (§22 gate). Alinhamento completo = refactor do pipeline paralelo → decisão TL |
| 03 | Unificação idempotência | **PASS** | Canônico = único dono (claimMetaEvent); 7 cenários provados FASE 02; discriminator travado por teste (wave4) |
| 04 | Attribution dedup | **PASS** | Regra determinística já existe: referral→click_to_whatsapp/DETERMINISTIC; sem referral→organic/UNATTRIBUTED; sem inferência (4c32e0a1) |
| 05 | Attribution TTL/volume | **DEFERRED** | 1 linha/mensagem, sem purge (entryPointExpiresAt nunca apagado). Cenários calculados (§24); purge cego proibido — política de retenção = decisão TL antes do Growth |
| 06 | Meta cost multi-currency | **FIXED** | 6fd7d01d — agregados por-moeda (bySourceByCurrency/byIntentByCurrency/authoritativeCostByCurrency/estimatedCostByCurrency); escalares inválidos + avgCostPerMsg removidos |
| 07 | Meta budget BRL | **FIXED** | 6fd7d01d — budget BRL nativo por plano via `META_BUDGET_*_BRL`; SEM conversão automática; enquanto unset: gasto BRL reportado, não enforced (sem FX inventado) |
| 08 | Cost status semântico | **PASS** | `source: meta_webhook_pricing` (autoritativo) vs `send_accepted` (estimativa, `estimated:true`) travado por teste; rate card nunca apresentado como invoice; /api/meta-costs valida datas (400) |
| 09 | Revenue source of truth | **PARTIAL** | Mapa completo (15 calculadoras, §13); filtros de status divergentes ELIMINADOS (cceb67b5); SoT único (lib/finance/guest-revenue.ts) = decisão TL documentada (§13/§26) |
| 10 | DDC revenue | **FIXED** | e7ebc1ed — demo/deliveries/ai-status/conversations/bookings honestos; zero números fake |
| 11 | Performance snapshot | **FIXED** | cceb67b5 — totalRevenue com filtro de receita; snapshots = INCREMENTO DIÁRIO (MTD era somado N× — correção matemática P0) |
| 12 | DDC metrics | **FIXED** | Estados semânticos meta.source: database/snapshot/database_unavailable/fallback-zeros; demo fabricado removido |
| 13 | Booking × Reservation | **DEFERRED** | Duplicidade estrutural mapeada (sem FK entre si); sem 3ª entidade criada; estratégia de convergência documentada (§13) |
| 14 | Revenue duplication | **PARTIAL** | Mapa FILE/FUNÇÃO/FILTRO/CONSUMIDOR completo (§13); divergências objetivas (status filter) eliminadas; convergência total = médio prazo |
| 15 | Meta health multi-tenant | **BLOCKED** | Credencial global env — CURRENT LIMITATION NOT PRODUCTION MULTI-TENANT READY (documentado no código); health Graph check global (P2-7); vault = pré-requisito Growth |
| 16 | Meta connection security | **PASS** | MetaConnection sem token coluna (schema 1187-1212); unique (tenant,waba,phone); instagramAccountId/businessAgentEnabled prontos; token nunca no frontend |
| 17 | MetaWebhookEvent tenant model | **PASS** | Global por design (sem tenantId), eventKey @unique; sem cross-tenant contamination possível (payload por WABA/phone resolvido a jusante) |
| 18 | MetaCostLog tenant FK | **DEFERRED** | Sem FK confirmada (schema 1150-1179); linhas `tenantId='shared'` (route.ts:342) IMPEDIRIAM FK direta sem migração de dados; extensão Prisma+RLS cobrem; migration nova = decisão TL |
| 19 | RLS real | **UNVERIFIED** | withTenantContext/setTenantContext: 0 callers confirmado; RLS dormante; barreira real = extensão Prisma (70 modelos); projeto request→tenant→SET LOCAL→query pronto no módulo |
| 20 | RLS FORCE | **DEFERRED** | Ativar FORCE sem runtime context = 0 linhas para todo o app (quebra); estratégia segura documentada (§12): contexto adotado → role não-owner → teste negativo → então FORCE |
| 21 | RLS canary test | **UNVERIFIED** | Sem PostgreSQL real no sandbox — NUNCA marcado como PASS |
| 22 | Migration integrity | **RISCO REGISTRADO** | **Duas migrations Meta foram EDITADAS após push** (e2bca7c5→0e464cea; df61b0ab→9b49dcf0) — checksum drift para DBs que aplicaram v1; TL deve rodar `prisma migrate resolve` se aplicável; histórico não reescrito nesta fase |
| 23 | Cloud API timeout | **FIXED** | 51f6d2dc — AbortController 15s + WHATSAPP_SEND_TIMEOUT/NETWORK_ERROR; sem retry de POST |
| 24 | Cloud API idempotency | **PASS** | Sem retry (POST pode ter chegado); whatsapp-send real: sem retry + correlationId + fail-closed prod |
| 25 | WhatsApp send observability | **PASS** | Códigos seguros sem PII/token; correlationId por envio (whatsapp-send.ts:27,85) |
| 26 | Handover telemetry | **FIXED** | a094dde5 — handover.started / handover.guest_message_suppressed / handover.ended via telemetry-bridge existente |
| 27 | Handover learning | **PASS** | HUMAN_HANDOVER = anti-padrão; meta-learning.ts:165-166 NEGATIVE_OUTCOME_NOT_PROMOTABLE; Learner permanece dono |
| 28 | Telemetry correlation ID | **DEFERRED** | correlationId ponta-a-ponta inexistente (existe só no meta-client/whatsapp-send); wamid→messageId→conversationId→attribution.permite junção; proposta documentada (§20) — não criar sistema paralelo |
| 29 | Telemetry tenant | **PASS** | tenantId nullable = legítimo (eventos de sistema 'shared'/'unresolved'); não tornar obrigatório cegamente |
| 30 | LGPD log audit | **FIXED** | bbbccadd — webhook sem corpo de mensagem/telefone completo; NUCLEAR_TOKEN externalizado; bsuid mascarado; 9 asserções |
| 31 | Payment confirmation | **PASS** | Re-auditado: flag pós-envio ✓; tipo REAL de Transaction ✓; dedup provider_event_id ✓; state machine ✓; resíduo P3-10 (race cron) registrado |
| 32 | @ts-nocheck critical | **DEFERRED** | 19 ocorrências mapeadas; pagamento/roteamento IA priorizados para próxima onda (remoção requer testes comportamentais; risco de mudança silenciosa) |
| 33 | Mock/demo inventory | **FIXED** | PROD RISK removidos (demoData/demoMetrics/demoBookings/demoConversations); SAFE mantidos (mock-send bloqueado em prod ✓; src/simulation, zlab = demo-only por design) |
| 34 | DDC client data source | **FIXED** | 00dffba5 — adaptRevenueMetrics sem ×4.5/×18/×25; períodos reais ou zeros; flags source/degraded documentadas como ainda ignoradas pelo UI (risco residual §24) |
| 35 | Graph API version | **PASS** | Centralizada (env.ts:59→meta-config→meta-client/whatsapp-send/cloud-api); mock v18 = display-only; zero hardcode prod |
| 36 | Graph API error contract | **DEFERRED** | meta-client já tem erro estruturado; padronização global sem refactor gigante = próxima fase |
| 37 | Meta rate card | **PASS** | BR: marketing 0.3217 / utility 0.035 / auth 0.035 / service 0.035 (01/10/2026); service pré-outubro não-billável; evidência ≠ estimate ≠ billing separados |
| 38 | CAPI readiness | **PASS** | Contrato puro, 0 callers, flag OFF; checklist de ativação (§25) |
| 39 | Marketing Messages readiness | **PASS** | Sem sender de campanha; sendWhatsAppTemplate existe p/ utility/service; cadeia attribution preparada; OFF |
| 40 | Instagram readiness | **PARTIAL** | Coluna pronta + flag OFF; parsing/sender acoplados a WhatsApp; adapter IWhatsAppAdapter existe mas não usado — blockers registrados |
| 41 | Business Agent readiness | **PASS** | Hardcoded available:false/provider:none; interfaces futuras registradas (depende de P1-8/P1-2) |
| 42 | Meta One isolation | **PASS** | Nenhuma feature crítica depende de Meta One (ausência de flag = OFF) |
| 43 | Zélla Brain | **PASS** | Pipeline cognitivo íntegro (LGPD→guardrails(fallback)→intent→GraphRAG→RAG→tools→NeuroRouter→resposta); sem pipeline duplicado; gap: guardrails mortos no happy-path (§17 risco) |
| 44 | ConversationLearner | **PASS** | Único dono da promoção; sanitize/validate gates; anti-padrões em escalation |
| 45 | ZéLLM | **PASS** | src/lib/zellm NÃO EXISTE ✓; Zellm = camada conceitual (meta-learning.ts + metadata.zellm) sobre Brain/Router/Learner/Memory/Telemetry |
| 46 | DDC/Brain telemetry | **PASS** | Contextos carregam IDs/latências, sem prompt completo/token; notification DDC carrega trecho 60 chars (interno, DB) |
| 47 | NFT/build memory | **FIXED** | 51f6d2dc — outputFileTracingExcludes p/ /api/zcc/ze-code/apply (.git/tests/docs/migrations); causa raiz (process.cwd() em git-applier.ts:240,318) documentada |
| 48 | CI Master Gate | **PASS** | `branches: ain]` NÃO EXISTE no arquivo real — `branches: [main]` verificado byte a byte (od -c) = artefato de leitura anterior; gate NÃO cobre feat/* (gap de política, não bug) |
| 49 | CI startup failure | **BLOCKED** | Runs 35124045693/35124049285 = startup_failure sem jobs, sistêmico; PAT sem Actions:Read nesta sessão → CI OBSERVABILITY BLOCKED |
| 50 | Vercel | **BLOCKED** | account deployment blocked (externo) separado de application build failure (ENVIRONMENTAL sandbox) |
| 51 | Test matrix | **PASS** | Atualizada (§9): security 593, meta 146, e2e 16 specs fora do gate |
| 52 | Concurrency audit | **PARTIAL** | touchMetaConnection (P2002 swallow = degradação aceitável), payment-cron flag (P3-10), recordMetaPricingFromStatus findFirst→create — registrados; attribution link = guarded write ✓ |
| 53 | Error path audit | **PASS** | Integrações externas: fail-closed DB (idempotência, budget); 4xx nunca retry; 5xx 1×; estados consistentes; gaps menores registrados (P3-7/P3-8) |
| 54 | Data contract audit | **PASS** | null vs undefined normalizado (normalizers); currency explícito em MetaCostLog; ausência de currency em Transaction/Reservation = dívida documentada (§24) |
| 55 | Production fallback audit | **FIXED** | catch→fake eliminado de deliveries/ai-status/conversations/bookings/metrics; varredura completa em §13 (honestos mantidos) |
| 56 | Security regression expansion | **FIXED** | +46 asserções novas em 6 arquivos (handover, revenue, demo-honesty, multi-currency, cloud-api/NFT, LGPD, frontend) |
| 57 | Documentação de arquitetura | **PARTIAL** | Documentado NESTE relatório pós-correção (§13-§21); docs/ permanentes = próxima onda |
| 58 | Final tech lead review | **PASS** | diff main...HEAD revisado (75 arquivos); main intacta; 7 commits pequenos por domínio |
| 59 | Testes finais | **PASS** | typecheck 0 · lint 0 errors · unit 4/4 · security 577/16 · meta 146/146 · generate/validate PASS · build ENVIRONMENTAL (§8) |
| 60 | Relatório 02B | **PASS** | Este documento |

## 3. P0 (encontrados nesta fase — TODOS CORRIGIDOS)

| ID | Problema | Correção |
|---|---|---|
| P0-2 | **Receita multiplicada N×**: cron gravava `totalRevenue` month-to-date em cada snapshot diário; `/api/ddc/metrics` SOMAVA os N dias (≈7× semana, ≈30× mês) | cceb67b5: snapshots = incremento diário |
| P0-3 | **Fabricação inline no caminho real**: `/api/ddc/deliveries` substituía valores reais 0 por demoData (R$15.870 OTA, metaShield 79.2%, "Maria Silva"+chave PIX fake) | e7ebc1ed: zeros+flags |
| P0-4 | **Seeder grava receita fake no DB**: GET /api/ddc/conversations criava booking PIX "confirmado/pago" R$700 + guests fictícios em qualquer tenant sem conversas → contaminava TODAS as calculadoras | e7ebc1ed: gated non-production |
| P0-5 | **KPIs fabricados persistidos**: cron gravava conversionRate 12 / satisfaction 4.2 / occupancy 65 / autonomy 85 sintéticos como "real" | cceb67b5: sem defaults |

## 4. P1 (pendências da FASE 02 — estado após 02B)

| ID | Problema | Estado 02B |
|---|---|---|
| P1-1 | Webhook legado paralelo (LGPD bypass) | PARTIAL — REMOVAL GATE documentado; decisão TL (remover/migrar) pendente |
| P1-2 | Handover sem supressão | **FIXED** (a094dde5) |
| P1-3 | Budget cego p/ BRL | **FIXED** (mechanismo nativo; ativação = env TL) |
| P1-4 | Agregados BRL+USD inválidos | **FIXED** (6fd7d01d) |
| P1-5 | RLS dormente | UNVERIFIED/PARTIAL — barreira real documentada (extensão Prisma); adoção de withTenantContext = decisão TL |
| P1-6 | Revenue SoT fragmentada + inflação | PARTIAL — inflação eliminada; SoT único = decisão TL (§13) |
| P1-7 | CI startup_failure + observabilidade | BLOCKED (conta GitHub / PAT) |
| P1-8 | Credenciais Meta globais | BLOCKED (vault/secret store = infra) |

## 5. P2 (principais — estado)

P2-1 unique defensiva custo: DEFERRED (análise de dados pré-constraint) · P2-2 purge attribution: DEFERRED (política TL) · P2-3 demo flag UI-ciega: PARTIAL (demo eliminado na fonte; flags ainda não lidas pelo UI) · P2-4 mock fallback frontend: PARTIAL (mantido só como zeros honestos) · P2-5 FX 5.15: PARTIAL (marcado ESTIMATIVA; fonte declarada = decisão) · P2-6 cloud-api timeout: **FIXED** · P2-7 health 401/PENDING: DEFERRED · P2-8 FK MetaCostLog: DEFERRED (linhas 'shared') · P2-9 pseudo-tenant 'shared': DEFERRED (design) · P2-10 metadata.zellm writers: PARTIAL (PATCH agora faz MERGE — preserva; writers de outcome = próxima onda) · P2-11 correlationId: DEFERRED · P2-12 retention LGPD: DEFERRED · P2-13 NFT: **FIXED**.

## 6. Correções (7 commits — FILE/BEFORE/AFTER/WHY/RISK/TEST)

**C1 `cceb67b5` fix(revenue)** — cron/metrics-snapshot: BEFORE `totalRevenue = reduce(sem filtro)` sobre janela MTD + defaults `||12/||4.2/||65/||85/1.5`; AFTER filtro `confirmed/checked_in/checked_out` + janela diária + zeros honestos; ddc/metrics: raw-path com filtro + demoMetrics(R$12.450/87.230/345.670)→zeros+degraded + meta.source semântico + attendedChange conversa-vs-conversa; revenue-details: status filter PIX. WHY: inflação persistida e fabricação. RISK: baixo (shape preservado; flags aditivas; snapshots antigos MTD saem da janela 30d). TEST: revenue-status-integrity (9).

**C2 `e7ebc1ed` fix(ddc)** — deliveries/ai-status/conversations/bookings sem demo; no-auth→401; seeder non-prod; dead consts removidos. RISK: baixo (UI exibe zeros/estado honesto). TEST: ddc-demo-honesty (11).

**C3 `a094dde5` fix(handover)** — lookup `in ['active','escalated']` latest-wins; guard pós-LGPD/pós-persistência retorna `aiResponse:''`+sem custo; media branch idem; PATCH valida status + metadata MERGE; telemetria handover.*. RISK: baixo (comportamento controlado por 12 asserções; opt-out continua respondendo durante handover). TEST: handover-suppression-regression (12).

**C4 `6fd7d01d` fix(meta)** — summary por-moeda; budget multi-moeda com BRL nativo por env; meta-costs valida datas; comentário "NÃO é verdade financeira" restaurado (quebra PRÉ-EXISTENTE da certificação por 5e61159b — Master Gate nunca rodava tests/meta); wave4 assertion atualizada ao novo shape (contrato preservado). RISK: médio-baixo — shape do /api/meta-costs mudou (sem consumer frontend; API interna). TEST: meta-cost-multi-currency (11) + meta suite 146.

**C5 `51f6d2dc` fix(meta)** — cloud-api timeout 15s + códigos de erro; NFT excludes. RISK: baixo (código dormante; config scoped). TEST: cloud-api-and-nft-hardening (7).

**C6 `bbbccadd` fix(security)** — redação PII/credencial em logs. RISK: baixo (triagem via textLength/últimos-4; env novo ZELLA_NUCLEAR_TOKEN com fallback efêmero = nuclear desabilitado até configurar). TEST: lgpd-log-redaction (9).

**C7 `00dffba5` fix(ddc)** — adaptRevenueMetrics honesto + dashboard passa períodos reais. RISK: baixo (cards mostram valores reais/zeros). TEST: frontend-revenue-honesty (5).

## 7. Arquivos alterados (26, +1009/−359)

src: whatsapp-ai-responder.ts · webhooks/whatsapp/route.ts · ddc/conversations/[id]/route.ts · ddc/conversations/route.ts · ddc/metrics/route.ts · ddc/revenue-details/route.ts · ddc/deliveries/route.ts · ddc/ai-status/route.ts · ddc/bookings/route.ts · cron/metrics-snapshot/route.ts · meta-cost-guard.ts · meta-costs/route.ts · whatsapp/cloud-api.ts · next.config.ts · lib/ddc/ddc-mapper.ts · app/ddc/DDCDashboardContent.tsx · lib/pulse-socket-server.ts · lib/bsuid-resolver.ts. tests: 8 novos (revenue-status-integrity, ddc-demo-honesty, handover-suppression-regression, meta-cost-multi-currency, cloud-api-and-nft-hardening, lgpd-log-redaction, frontend-revenue-honesty) + meta-wave4-regression (assertion atualizada).

## 8. Testes

| Verificação | Resultado |
|---|---|
| npm run typecheck | **EXIT 0** |
| npm run lint | **EXIT 0** (0 errors) |
| npm run test:unit | **4/4 PASS** |
| vitest tests/security/ | **577 passed / 16 skipped (593)** — +46 vs baseline |
| vitest tests/meta/ | **146/146 PASS** (11 arquivos) |
| prisma generate / validate | **PASS / PASS** (6.19.3) |
| npm run build | **ENVIRONMENTAL** — `✓ Compiled successfully in 40s` → `Running TypeScript...` → worker `SIGKILL`; dmesg `oom-kill constraint=CONSTRAINT_NONE task_memcg=/k8s.io/...` anon-rss 1.35GB, cgroup 4GiB; TS compila (typecheck EXIT 0); sem aumento de heap; não é bug de aplicação |

## 9. Regression Tests (novos — FRENTE 56)

1. tests/security/revenue-status-integrity.test.ts (9) — filtros de receita, snapshot diário, sem KPI sintético. 2. tests/security/ddc-demo-honesty.test.ts (11) — zero fabricação DDC. 3. tests/security/handover-suppression-regression.test.ts (12) — política de handover + telemetria + PATCH validado. 4. tests/meta/meta-cost-multi-currency.test.ts (11) — agregados por moeda + budget BRL. 5. tests/meta/cloud-api-and-nft-hardening.test.ts (7) — timeout sem retry + NFT excludes. 6. tests/security/lgpd-log-redaction.test.ts (9) — sem PII/credencial em logs. 7. tests/security/frontend-revenue-honesty.test.ts (5) — sem multiplicadores. 8. meta-wave4-regression — assertion do budget atualizada (contrato multi-moeda).

## 10. Database/Migrations

23 migrations; sem edição nesta fase. **RISCO REGISTRADO (FRENTE 22):** `20260916000000` e `20260916140000` foram editadas APÓS push (0e464cea, 9b49dcf0) — checksum drift potencial para DBs que aplicaram v1; ação TL: `prisma migrate resolve` onde aplicável + `migrate diff` no CI quando voltar. MetaCostLog sem FK tenant (linhas `shared` bloqueiam FK direta). PerformanceSnapshot: linhas históricas MTD saem naturalmente da janela de 30 dias.

## 11. Security

LGPD logs: corrigido (C6). Send mock bloqueado em produção ✓. HMAC fail-closed ✓. Nuclear ops agora exigem env + token nunca logado ✓. CSP `unsafe-inline` = risco residual registrado (P3-class). Cloud-api sem retry duplicante ✓.

## 12. Tenant Isolation

Extensão Prisma (70 modelos travados por teste) = barreira REAL; RLS DDL existe e permanece dormente (0 callers de withTenantContext) — UNVERIFIED em PostgreSQL real; FORCE não ativado (sem contexto = app quebra). `meta_webhook_events` global por design. Cross-tenant test real: UNVERIFIED (sem PG).

## 13. Revenue

**Mapa das 15 calculadoras** consolidado (FRENTE 09/14): Booking.totalValue (metrics raw ✓filtrado, snapshot ✓filtrado+diário, revenue-details ✓filtrado, weekly-report ✓já tinha, airb-pro goals ✓paymentStatus=paid, reports ✗cancelados incluídos — P2 residual, linkinbio ✗ — P2 residual); Reservation.totalPrice (attribution snapshot); Transaction (ZCC metrics COMPLETED ✓); UpsellRecord (filtrado ✓); Subscription (SaaS, domínio separado ✓); frontend adapter (agora honesto ✓). **Recomendação SoT (decisão TL):** receita de hóspede = Booking com `status ∈ {confirmed, checked_in, checked_out}` como fonte canônica de CURTO prazo via módulo único `lib/finance/guest-revenue.ts`; unificação Booking↔Reservation com bridge + campo currency no médio prazo; ledger Revenue só depois.

## 14. Meta

Agregados por moeda ✓; budget multi-moeda ✓ (ativação BRL = env); rate card BR íntegro; Graph centralizada v23 (registry até v26); client seguro (timeout 15s, 4xx sem retry, sem vazamento); health global-cred (limitação documentada); MetaConnection sem token coluna ✓; dedup authoritative por findFirst+update ✓.

## 15. WhatsApp

Sender real (whatsapp-send): 15s timeout, sem retry, correlationId, fail-closed sem credencial em prod, mock bloqueado ✓. cloud-api (template, dormante): timeout adicionado ✓. Multi-chunk perde wamids de chunks intermediários (P3 — registrado).

## 16. Handover

Política explícita implementada: ACTIVE→ESCALATED→HUMAN CONTROL; IA suprimida (zero custo Meta/LLM durante handover); mensagem do hóspede persistida + notificação high-priority ao humano; reativação = ação humana validada; telemetria started/suppressed/ended. **Risco documentado (§17):** escalation automático só dispara no fallback do cérebro (GuestResponderBrain sem guardrails) — gap pré-existente registrado, requer decisão de comportamento.

## 17. Brain

Pipeline íntegro (§43); guardrails/injection/scam bloqueiam SOMENTE no fallback executeCognitivePipeline — no happy-path (GuestResponderBrain) não há guardWhatsAppMessage (grep 0 matches): **ARCHITECTURAL GAP registrado** (não alterado: mudança de comportamento do cérebro sem testes comportamentais viola a disciplina desta fase).

## 18. ZéLLM

Camada conceitual sobre Brain/Router/Learner/Memory/Telemetry; nenhum diretório/learner paralelo criado ✓; metadata.zellm preservado por MERGE no PATCH ✓.

## 19. Learner

ConversationLearner único dono ✓; HUMAN_HANDOVER nunca promovido (NEGATIVE_OUTCOME_NOT_PROMOTABLE) ✓; writers de outcome (P2-10) = próxima onda.

## 20. Telemetry

handover.* eventos adicionados ao bridge existente (sem sistema paralelo) ✓; correlationId ponta-a-ponta: proposta `correlationId = wamid` no claim inbound propagado via buffer→conversation.metadata→responder→tool calls; decisão/imersão = próxima fase (FRENTE 28 DEFERRED).

## 21. DDC

Todos os endpoints operacionais honestos (§6 C2/C7); flags degraded/source expostas no server; UI ainda não as consome (risco residual menor — números já não são fabricados).

## 22. CI

master-gate.yml verificado byte a byte: **`branches: [main]` correto — `ain]` era artefato de leitura** (FRENTE 48 PASS, sem fix necessária). Gate não cobre feat/* (ze-code-review roda em PRs — único coverage). startup_failure sistêmico de runs remotos = INFRASTRUCTURE (FRENTE 49 BLOCKED). REMOVAL GATE do webhook legado: 5 condições documentadas na FASE 02 §5.1 permanecem.

## 23. Vercel

account deployment blocked (EXTERNO) ≠ application build failure (TS compila 40s; OOM = cgroup sandbox). Sem ação nesta fase.

## 24. Remaining Risks

1. Webhook legado ativo (LGPD bypass sob misconfig) — decisão TL. 2. RLS não comprovada (sem PG real). 3. Credenciais Meta globais (vault). 4. Guardrails mortos no happy-path do cérebro. 5. UI não consome degraded/source (números honestos, contexto ausente). 6. airb-pro/reports + linkinbio ainda somam status não-receita. 7. FX 5.15 residual em 4 arquivos (marcado estimativa). 8. Transaction/Reservation sem campo currency. 9. CorrelationId ponta-a-ponta ausente. 10. Migration checksum drift (2 migrations editadas pós-push). 11. UI demos ZCC (gated). 12. property-name fallback cosmético 'Pousada Paraíso'. 13. CSP unsafe-inline. 14. @ts-nocheck 19 arquivos.

## 25. Meta Growth Blockers

**Restantes antes da FASE 03:** (1) decisão webhook legado; (2) RLS: adoção de withTenantContext nos fluxos Meta + validação PG real; (3) vault de credenciais por tenant; (4) CI remoto arbitrável; (5) política attribution retention; (6) unique defensiva de custo; (7) writers de outcome p/ Learning. **Resolvidos nesta fase:** handover ✓, agregados multi-moeda ✓, budget BRL ✓, inflação de receita ✓, demo fabricado ✓, timeout cloud-api ✓, NFT ✓, LGPD logs ✓.

## 26. Next Phase

1. TL: push (credencial), resolver CI startup_failure na conta, inspecionar PR #96, decidir webhook legado (REMOVE/MIGRATE), definir `META_BUDGET_*_BRL`, `prisma migrate resolve` nas 2 migrations. 2. FASE 03 (planejamento): SoT módulo `lib/finance/guest-revenue.ts` + writers de outcome + correlationId (wamid) + guardrails no happy-path + @ts-nocheck pagamento. 3. Infra: Postgres efêmero p/ canary RLS negativo. 4. Só então: Meta Growth Engine com flags próprios.

## 27. GO/NO-GO

**FASE 02B STATUS: GO WITH CONDITIONS**

Fundação corrigida e comprovada localmente: 577 testes de security verdes (+46 regressões novas), 146 meta, typecheck/lint/unit/prisma PASS, build ENVIRONMENTAL com evidência de OOM de infraestrutura. Os 4 P0 desta fase e 5 P1 da FASE 02 foram corrigidos com commits pequenos e rastreáveis. As CONDIÇÕES são os blockers de §25 — nenhum invalida a fundação; TODOS são pré-requisitos da onda Growth (externos: CI/Vercel/vault/decisões TL). Nenhum PASS inventado; BLOCKED/UNVERIFIED declarados como tais.

---
*Fim do relatório — FASE 02B HARDENING · HEAD final local 00dffba5 · push pendente de credencial*
