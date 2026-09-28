# RUN A2 RECON — ANÁLISE PRELIMINAR PÓS-DIGEST

**Data:** 2026-09-25 | **Base auditada:** `e46590a28e15c76455b065348eb05f875f0cc6e4` (branch `feat/meta-zella-foundation`)
**Fonte:** DIGEST.txt capturado READ-ONLY no iMac por `RUN_A2_RECON.sh` (sha do script: `c5fcfe35f42dd41b4e1e0b8d661d28a51e3a15066b2aac398c0e4cf68dd3971f`), rc=0, saída `99_AUDITS/RUN_A2_RECON_20260924_220811/`
**Cópia de trabalho no sandbox:** `sz_recon/DIGEST_iMac_e46590a2_20260924_220811.txt` (569 linhas, 321 rotas — contagens idênticas ao original; sha local `d294f66e...dc25`; oráculo permanente = arquivo no iMac)

---

## 1. PROVA GIT DA BASE — TODA VALIDADA

| Item | Esperado | Capturado | Veredito |
|---|---|---|---|
| A) HEAD | e46590a28e15…6e4 | e46590a28e15…6e4 | ✅ |
| B) Branch | feat/meta-zella-foundation | feat/meta-zella-foundation | ✅ |
| C) LOG -3 | LOTE A ← transfer ← MG-07 | idêntico | ✅ |
| D) Parent do HEAD | 82bf6047bdac…800f (pureza: LOTE A = commit único) | idêntico, tree 9d3b22958bda…5b60 | ✅ |
| E) diff 82bf6047..HEAD | 10 files, 158+/17- | 10 files, 158+/17-, mesmos arquivos do selo | ✅ |
| F) git status | árvore rastreada limpa | só kits/zips não-rastreados | ✅ |
| G) Nº de rotas | 321 | 321 | ✅ |
| J) Patch LOTE A no iMac | selo 4b9ae67180d3…b621b6 | **4b9ae67180d3…b621b6 — BATE** | ✅ |

**Conclusão de proveniência:** o commit do LOTE A é puro (um commit, parent correto, stat exato do selo) e o iMac ainda guarda o **patch autêntico byte-exato** (`SEUZELLA_LOTE_A_SECURITY/LOTEA_SECURITY.patch`). O manifesto confirma o efeito do LOTE A em produção de código: as 5 rotas `zcc/consent` + `zcc/semantica/{graph,decisions,conflicts,export}` aparecem com `verifyZCCAccess,resolveZccTenantScope,tenantFromRequest` — a blindagem V-A1 está viva no HEAD.

**Payload capturado (não transferido, fica no iMac como oráculo):** `payload.tar.gz` = 403.940 bytes, sha `1bbd741d2b751fcf5b99681ebe098a98fee47beda16e2ae4f5c56c8a62a8adc2`, 12 blocos b64.

## 2. METODOLOGIA E CAVEAT

Os marcadores do manifesto (LABNAME, withApiGuard, verifyCronM2MToken, verifyZCCAccess, timingSafe, tenantFromRequest, nodeEnvCheck, mutation) vêm de **grep heurístico** por arquivo de rota. Ausência de marcador **não** prova ausência de proteção: pode haver guard dentro de helper não-greppado (ex.: `api-shield.ts` 347l, `resource-guard.ts` 135l, `tenant-authorization.ts` 96l, `waf-middleware.ts` 164l, `cron-secret.ts` 125l) ou no `middleware.ts` (que tem só **38 linhas** — capacidade centralizada baixa). O oposto também vale: marcador presente não prova profundidade correta (ordem AUTHN→TENANT→AUTHZ). Portanto esta análise **prioriza**, não condena. A varredura W2 lê código real das 321 rotas.

## 3. CLUSTERS DE RISCO IDENTIFICADOS NO MANIFESTO

**C1 — Rotas de laboratório SEM `nodeEnvCheck` (≈15):** o padrão correto existe (`airb-test`, `leads/seed`: LABNAME+nodeEnvCheck), mas falta em `zcc/simulation-lab` (GET,POST — citada nominalmente no prompt RUN A2), `zcc/synthetic-brazil` + `/generate`, `zella/simulate` (291l), `debug-agent` (+github,+knowledge), `diagnose` (mutation!), `mobile/devices-tracking-v2`, `ddc/locks/oauth/[provider]/devices`, `ddc/simulate-message`, `zcc/whatsapp/simulate`, `zcc/inference-simulation`, `zcc/cerebro/test-alert`, `cron/cerebro-night-pentest`. Em produção, superfície de simulação/debug exposta = alvo direto do requisito "lab DENY em produção".

**C2 — Cron sem guard de autenticação visível (≈27 de 35):** apenas 8 rotas cron têm `verifyCronM2MToken` (cerebro-analyze, cerebro-budget-forecast, cerebro-learning, cerebro-night-audit, cerebro-night-pentest, cerebro-night-pulse, jev-shadow-pulse, weekly-report). As demais ~27 não mostram marcador de guard — incluindo as **financeiras** `monthly-billing` (216l), `payment-confirmation`, `payment-overdue`, `plan-expiry`, `plan-limits-check`, `nps-checkout`, `budget-reset`, e as mutadoras `cerebro-cleanup`, `locks-maintenance`, `metrics-snapshot`, `ical-sync`, `lembrete-checkin`, `cerebro-watchdog` (só nodeEnvCheck). Cluster nº 1 em volume — pode haver falsos negativos via `cron-secret.ts`, mas a aposta W2 é unificar tudo em guard único fail-closed.

**C3 — Superfície física de fechaduras (locks) sem guard visível (8 de 9 arquivos):** `locks/[id]` (GET,PATCH,DELETE), `locks/[id]/unlock` (POST!), `locks/[id]/panic-revoke` (POST), `locks/[id]/pins` (GET,POST), `locks/[id]/pins/[pinId]` (DELETE), `locks` (GET,POST), `locks/oauth/[provider]/callback` (mutation) e `locks/oauth/[provider]/devices` (LABNAME). Só `locks/events` tem withApiGuard. Impacto físico direto (abrir porta, revogar PIN) — prioridade máxima no sweep IDOR.

**C4 — Rotas ZCC sem `verifyZCCAccess` (≈16):** `zcc/brain` (124l), `zcc/cerebro/stream` (215l), `zcc/cognitive-bus`, `zcc/cognitive-memory`, `zcc/cortex` + `/growth`, `zcc/digital-twin` (GET,POST), `zcc/dspy-compiler` (GET,POST), `zcc/national-simulator` + `/compare`, `zcc/personas`, `zcc/leads/brain-analyze`, `zcc/adapters`, `zcc/infra/scaling-ruler` (`zcc/health` é liveness, regra própria). O contrato ZCC (autoridade única) exige verifyZCCAccess + tenant scope explícito em todas.

**C5 — `tenantFromRequest` como fonte de tenant (10):** `bim-vision`, `lgpd/consent`, `lgpd/delete-my-data`, `ddc/housekeeping`, `ddc/partner-program/badge`, `cron/learning-cycle`, `pinns-clifford`, `telemetry/ingest`, `telemetry/query`, `webhooks/whatsapp`. Regra do RUN A2: tenant só do principal autenticado; request é não-autoritativo → 403 na divergência. (As rotas zcc/consent+semantica têm `resolveZccTenantScope` — já blindadas pelo LOTE A.)

**C6 — Mutação de negócio sem guard de sessão visível:** `ddc/airb/properties` (CRUD completo, 314l), `campaigns` + `[id]`, `bulk-whatsapp`, `v1/reservations` (171l), `v1/guest/ddc/notifications` (180l), `export/leads`, `hunt`, `scraping`, `landing/contact`, `push/subscribe`, `config/keys` (160l), `targets`, `leads`, `feedback`, `guide/[slug]` (336l), grupos airb-pro `[id]` (PATCH,DELETE sem guard), `ddc/notifications/v2`, `ddc/conversations` family, `special-dates/*` approve/reject, `linkinbio/purchase-addon` + `activate-standalone` (superfície de compra!), `partner-program/*`. Maior cluster em potencial — falsos negativos prováveis (helpers de sessão), razão de mais para leitura real.

**C7 — Admin via ZCC em vez de role-based:** `admin/faturamento-zehla`, `admin/upsell-analytics` usam `verifyZCCAccess`. Com a morte do `x-zcc-master-key` em produção (requisito RUN A2), o acesso admin precisa migrar para role oficial (`system_admin`/`owner`) com allow-list explícita.

**C8 — Webhooks de pagamento sem marcador de assinatura:** `webhooks/asaas` (39l) e `webhooks/mercadopago` (53l) sem `timingSafe`; `checkout/webhook` só nodeEnvCheck. Existe `asaas-webhook-hmac.test.ts` e `webhook-signature.ts` (199l) — provável verificação via helper; confirmar que é obrigatória e fail-closed em produção.

**Sinais positivos (padrão a replicar):** grupo `ddc/credits/*` e `ddc/guests`, `dpo-capture`, `guest-registration`, `personality` com withApiGuard+getServerSession; semantica/consent com resolveZccTenantScope; `internal/flush-buffer` com timingSafe; `webhooks/whatsapp` e `webhooks/payment` com timingSafe+nodeEnvCheck.

## 4. IMPLICAÇÕES PARA AS ONDAS DO RUN A2

- **W1 (fixes nomeados do prompt):** permanece intacta — M2M bcrypt-only, eliminação de plaintext fallback e scope default, morte técnica do `x-zcc-master-key` em produção, roles oficiais (RES-11), deny de lab em produção (C1), bateria de testes A–S. O manifesto dá os alvos concretos do C1.
- **W2 (varredura 321 rotas):** ordem de leitura sugerida pelo risco: C3 locks → C2 cron → C8 webhooks pagamento → C5 tenantFromRequest → C4 ZCC sem guard → C6 mutações → C1 labs → C7 admin → resto. A matriz 321×(rota/método/auth/role/tenant/ownership/mutação/risco/ação) já tem as colunas método/marcadores prontas deste DIGEST.
- **Testes:** inventário H confirma ~150 suítes relevantes, incluindo `run6b-m2m-roles` (254l), `zcc-security` (457l), `cron-auth` (285l), `tenant-isolation-matrix`, `production-auth-canary` — a bateria A–S se anexa a estas, sem reescrever de zero.

## 5. O QUE AINDA FALTA PARA DESTRAVAR

1. **Base byte-exata no sandbox** — via (A) PAT fine-grained read-only (preferida: clona `e46590a2` completo) ou via (B) colar o patch autêntico `LOTEA_SECURITY.patch` (selo J já confirmado no iMac) + arquivos-alvo individuais. Sem a base, nenhum patch gerado aqui é garantia de aplicação byte-exata (lição do experimento de fidelidade: sha transcrito ≠ selo).
2. **Execução do GLM 5.3 Flash no iMac** com o prompt RUN A2 (o dono já o possui) — o recon acima não substitui a execução; ele a mira.
3. **Pós-execução:** trazer de volta o log de execução + diff para a revisão forense (✅/⚠️/❌/🧹/🔒) antes de qualquer commit.
