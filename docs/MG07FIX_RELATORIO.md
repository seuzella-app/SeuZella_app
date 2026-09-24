# MG-07 FIX — RELATORIO DA ONDA (restauracao fail-closed ACCOUNT_EXISTS)

- **Onda**       : MG-07 FIX (V8) — correção de regressão de segurança apontada pelo VITEST; RUN SEMÂNTICA (probe v2 do consumidor e throws + escada throw-nativo/retorno-tipado)
- **Campanha**   : MASTER GATE FINAL (PRÉ-RELEASE) — MG-07/9
- **Data (UTC)** : 2026-09-24T03:12:18.000Z
- **Repositório**: branch `feat/meta-zella-foundation` — HEAD antes: `f749f190b83358c1b4607d82ec49d4c4ef59a7c8`
- **Evidências** : `/Users/marciocau/SeuZella_project/99_AUDITS/MG07FIX_20260924_001218`

## 1. O caso

A onda MG-07 V3 terminou rc=84: o VITEST completo acusou **1 única falha
determinística** (3192/3238 verdes, 45 skips por design, TSC verde). O gate
`tests/security-hardening-12-fronts.test.ts` ("17-20") exige que
`src/app/api/checkout/create/route.ts` contenha a string `ACCOUNT_EXISTS` —
e ela não estava. Não era flaky nem ambiente: era desvio gate↔código.
Quatro ondas honraram o fail-closed: o V4 (bloco fixo), o V5 (candidatos
fixos) e o V6 (matriz auto-diagnóstica) foram reprovados pelo TSC real —
mas o log do V6 **provou por eliminação** a causa exata: as formas JSON
(usaram a MESMA query Prisma, sem `createError`) não tiveram TS2345 → a
query é type-safe; todas as formas `createError` tiveram EXATAMENTE 1 erro
TS2345 → um ARGUMENTO da chamada saiu do **domínio de tipos** da assinatura
atual (o r3-f04 estreitou a união de códigos de erro ao remover a chamada).
O V7 é a cura cirúrgica dessa causa, guiada por PROBE da assinatura real.

## 2. Prova forense (ACCPROBE V1 + log V6, leitura apenas)

| Seção | Evidência |
|-------|-----------|
| A | `git log -S ACCOUNT_EXISTS -- route.ts`: **e35bef80** (2026-08-20, "security: harden guest checkout and payment initiation") introduziu; **064db917** (2026-09-02, r3-f04 "gateway uncertainty hardening", PR #47) removeu |
| B | Repo inteiro: 4 commits tocam o token (os 2 acima + gate **eca88859** + docs **8639053f**) |
| C | **0 ocorrências em src/ hoje** — a semântica NÃO migrou; foi apagada |
| D | `RATE_LIMITED` e `status: 'pending'` presentes; tokens proibidos = 0 |
| E | Linha 37 do gate foi moldada em 2026-08-20 (**802df3e7**) — ANTES da remoção |
| F | Log V6: formas JSON sem TS2345 (query type-safe) × createError sempre 1×TS2345 (argumento fora do domínio) |

**Veredito**: H1 — regressão real, com causa de compilação isolada. O gate
está correto e permanece intocado; o código que regrediu. A restauração
devolve o comportamento fail-closed original de `e35bef80`: checkout
de convidado com e-mail que já possui conta → `409 ACCOUNT_EXISTS`
(anti-duplicidade de conta), em vez de criar um segundo tenant
silenciosamente.

## 3. O que esta onda mudou

1. Arquivo(s) de produção: src/app/api/checkout/create/route.ts  — bloco fail-closed inserido
   imediatamente antes da criação do tenant (`141`); SHA-256 do
   route após o patch: `59100b28d55b7ae1b76733a8b76f4618ce7c19f608f8a416b17335040e6b7382`.
2. Cura de domínio: route-only (dominio de codigos ja aceita ACCOUNT_EXISTS ou curado por cast no proprio route).
3. `docs/MG07FIX_RELATORIO.md` + `docs/MG07FIX_ACHADOS.md` — aditivos.

## 4. Portões técnicos desta execução

| Portão | Resultado |
|--------|-----------|
| Varredura da fundação (selo + âncoras) | 17/17 — VERDE |
| Probe da assinatura (createError)      | def=src/lib/error-handler.ts ACCOUNT_EXISTS-no-dominio=AUSENTE irmaos=PAYLOAD_TOO_LARGE,MISSING_FIELDS,INVALID_EMAIL,INVALID_PLAN,INVALID_PAYMENT_METHOD,INVALID_NICHE,INVALID_GATEWAY,INVALID_PRICING,TENANT_INACTIVE,INVALID_ACCOUNT_EMAIL,INVALID_IDEMPOTENCY_KEY,RATE_LIMITED,IDEMPOTENCY_IN_PROGRESS,IDEMPOTENCY_RESULT_UNAVAILABLE,PAYMENT_GATEWAY_NOT_CONFIGURED,PAYMENT_GATEWAY_UNAVAILABLE,PAYMENT_GATEWAY_ERROR,BILLING_IDEMPOTENCY_UNAVAILABLE,IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST,IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING,CHECKOUT_ERROR |
| Engine V8 (análise + escada semântica + TSC) | VERDE (engine semantica — 3 spec: kind=return mode=casted casts=none q=findUnique expr=requestedEmail wrap=0 inline=1 var=existingTenantMG07) |
| Espec vencedora / tentativas           | 3 spec: kind=return mode=casted casts=none q=findUnique expr=requestedEmail wrap=0 inline=1 var=existingTenantMG07 (tentativas: 3) |
| Análise estática do route              | exprs=2 (criacao|requestedEmail antes-ancora@135|customerEmail) idioma=idioma-3args throw=throw-CheckoutError-3args consumers=3 lib=route-only tsc=presente |
| Gate 17-20 isolado                     | VERDE (gate 17-20 isolado passou) |
| VITEST (suíte completa)                | VERDE ( Test Files  315 passed | 3 skipped (318) |       Tests  3193 passed | 45 skipped (3238)) |
| Commit local                           | **exatamente 1**, NUNCA push |

## 5. Garantias permanentes

NUNCA push · nada remoto · sem rede · sem banco · sem credenciais ·
`.env` valores nunca lidos · `vercel.json` intocado (conteúdo nem lido) ·
fail-closed provado (rollback automático de TODOS os arquivos tocados se
engine/VITEST vermelho).
