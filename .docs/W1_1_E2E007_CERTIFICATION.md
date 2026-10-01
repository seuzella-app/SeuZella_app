# W1.1 — Certificação E2E-007 (fechamento contra produção)

> Task ID: W1.1-E2E007-CLOSURE · Data: 01/out/2026 (UTC-3)
> Branch: `feat/real-business-workflow-hardening` · HEAD base: `71eac1667e6b3cbd92079ab8a245760b73f11e08`

## Identidade

| Campo | Valor |
|---|---|
| Repositório | github.com/seuzella-app/SeuZella_app (clone canônico) |
| Branch | feat/real-business-workflow-hardening |
| HEAD | 71eac1667e6b3cbd92079ab8a245760b73f11e08 (remoto = local, sem commit) |
| Estado da árvore | Wave 1 aplicada (sem commit) + W1.1 (teste + docs) — idêntico ao iMac |

## Arquivos alterados pela W1.1

| Arquivo | Tipo | Observação |
|---|---|---|
| `tests/e2e/e2e-007-real-concurrency.test.ts` | REESCRITO (589 linhas) | única mudança de código — zero produção tocada |
| `.docs/W1_1_PRODUCTION_BUNDLER_MAP.md` | NOVO | mapa de autoridade (§7) |
| `.docs/W1_1_E2E007_CERTIFICATION.md` | NOVO | esta certificação |
| `tsconfig.w11scoped.json` / `tsconfig.w11e2e.json` | NOVOS | verificadores tsc escopados (helpers de ambiente 4GB RAM; o iMac usa o tsc integral) |

`git diff --check` = 0 · único tracked modificado continua sendo `src/instrumentation.ts` (+7, Wave 1).

## Autoridade de produção (resumo do mapa)

- **Production bundler**: `src/lib/message-bundler.ts` — `bufferMessage()` (L269), chamado pela rota canônica `/api/webhooks/whatsapp:795`
- **Production queue**: Lista Redis Upstash REST (`mb:<tenant>:<phone>`, RPUSH+EXPIRE 30s)
- **Production worker**: `/api/internal/flush-buffer` (route.ts:21) → `handleFlushBufferRequest()` (L550), agendado por QStash
- **Production executor**: `processIncomingMessage` (`src/lib/whatsapp-ai-responder.ts`), injetado pela rota
- **Production claim**: LPOP count 100 ATÔMICO (RBW Fase N) — não existe lease SET NX EX em produção
- **Production requeue**: RPUSH de volta (ordem preservada) + EXPIRE renovado quando o processor falha → `{success:false, error:'PROCESSOR_FAILED_REQUEUED'}`
- **BUNDLE_WINDOW_MS**: `3000` (message-bundler.ts L19, única definição; teste importa o valor real)
- **Dedup**: `buildFlushDeduplicationId()` = `rbw-flush:<tenant>:<phone>:<bucket floor(now/3000)>`

## O que o novo e2e atravessa (100% código de produção)

1. `bufferMessage()` real → RPUSH+EXPIRE reais na lista Redis real + publish QStash com `Upstash-Delay: 3s` e `Upstash-Deduplication-Id` reais (contrato provado)
2. `handleFlushBufferRequest()` real (o handler que a rota flush-buffer executa) — claim LPOP 100, concatenação `'\n'`, requeue
3. redis-server REAL (engine RESP) — a atomicidade vem do engine, não de código de teste
4. QStash = dupla de transporte HTTP (dependência externa, invariante T2 do CLAUDE.md); adaptador REST local replica SOMENTE os 4 endpoints Upstash usados pelo bundler — nenhuma lógica de fila/claim/bundle é simulada em JS

## Redis

| Campo | Valor |
|---|---|
| Provider (prova) | redis-server 7.2.5 real, local, porta 6399 (binário do acervo do projeto) |
| REDIS_PRESENT / REDIS_REACHABLE | true / true (via `PING` → PONG; nenhum valor de credencial logado) |
| Sem Redis | 4 skipped com aviso `[E2E-007 REAL v2] BLOQUEADO POR INFRA` (provado: candidatos E2E_REDIS_URL/TEST_REDIS_URL/127.0.0.1:6379) |

## Portões (com Redis real)

| Gate | Prova | Resultado |
|---|---|---|
| **G1** exatamente-uma-vez | 2 entregas reais (`bufferMessage`) + 2 invocações CONCORRENTES do handler real → 1 vencedor (`messageCount=2`), perdedor no-op (`messageCount=0`), processor chamado **1x** com `evento-1\nevento-2`, lista vazia no fim | ✓ PASS (9.1s) |
| **G2** requeue real | processor falha → handler real devolve item (LLEN=1, TTL renovado ≤30, `PROCESSOR_FAILED_REQUEUED`) → flush seguinte processa 1x, conteúdo íntegro, total válido = 1 | ✓ PASS (6.0s) |
| **G3** bundle real | 2 eventos do mesmo ciclo → **1 flush processa 1 batch com CONTEÚDO `msg-A\nmsg-B`** (não é só contagem); após janela real de 3s → bucket novo → bundle separado (`msg-C`); 3 eventos → 2 bundles, **nenhum evento perdido**; contrato de dedup id provado (delay `3s`, bucket na janela observada, builder determinístico com entrada fixa) | ✓ PASS (18.3s) |
| **G4** estado final | SCAN `mb:e2e007-real-*` = 0 chaves após limpeza; namespace exclusivo em todos os gates; estatística do bundler zerada | ✓ PASS |

## Execução (evidência real)

```text
E2E_REDIS_URL=redis://127.0.0.1:6399 npx vitest run tests/e2e/e2e-007-real-concurrency.test.ts
RUN 1: Tests 4 passed (4)        [33.75s]
RUN 2: Tests 4 passed (4)        [33.72s]
RUN 3: Tests 4 passed (4)        [33.78s]
0 skipped · 0 failed em todas as execuções com Redis real
```

```text
Sem Redis (prova de honestidade):
[E2E-007 REAL v2] BLOQUEADO POR INFRA — nenhum redis-server real acessível...
Tests 4 skipped (4)
```

## Qualidade

| Checagem | Comando | Resultado |
|---|---|---|
| TSC (superfície FASE 1 Wave 1) | `tsc -p tsconfig.w11scoped.json` | **0 erros** |
| TSC (e2e-007 W1.1 + bundler) | `tsc -p tsconfig.w11e2e.json` | **0 erros** |
| TSC integral do repo | `tsc --noEmit` | OOM no sandbox (4GB, rc=137) — **limitação do ambiente, não do código**; o iMac já provou `tsc_rc=0` com o MESMO payload Wave 1, e a W1.1 não toca produção (build integral fica para a certificação da wave no iMac, §20) |
| Vitest e2e-007 | 3 runs | **12/12 gate-passes acumulados**, 0 skipped com Redis |
| Regressão | `vitest run rbw-message-bundler-claim + zcc-security + meta-wave3-webhook-guard + credential-gate` | **47/47 passed** — nenhuma área certificada regrediu |
| Lint | `eslint --no-ignore tests/e2e/e2e-007-real-concurrency.test.ts` | 0 problems |
| Build | `npm run build` | Não executado: alteração é somente teste/docs (§20) — build global na certificação da wave no iMac |
| Secrets | revisão do diff | nenhum valor de credencial/token impresso (tokens são efêmeros de teste; URLs locais 127.0.0.1) |

## Bugs encontrados durante a auditoria (W1.1 §25)

Nenhum bug de produção no bundler. O claim atômico, o requeue e a concatenação do bundler real comportam-se exatamente como especificado (RBW Fase N + RBW v2). Os problemas eram TODOS no teste antigo (sintéticos G2/G3, janela sombreada, transporte ioredis), corrigidos nesta onda.

## Limitações honestas (não bloqueiam esta onda)

1. QStash real (nuvem) não é exercitado — é agendador externo; o teste prova o contrato de publish (delay/dedup/callback) e o CONSUMIDOR real (handler). Isso é o desenho correto: a garantia exactly-once vive no claim do consumidor.
2. `npm run build` integral fica para o iMac (limitação de RAM do sandbox documentada acima).
3. O iMac precisa de um redis-server real para reproduzir os 4 GREEN localmente — dependência declarada no kit (ver abaixo).

## Status final

**GREEN** — E2E-007 fechado contra a implementação real de produção, com Redis real, 4/4 gates, 0 skipped, 0 failed, sem lógica sintética, sem regressão, sem secrets.

Próximo passo operacional: dono aplica o kit W1.1 no iMac (ZIP via HUB + SHA256), roda com Redis real local (ou registra BLOCKED-INFRA com a dependência exata declarada) e envia o PASTE-BACK.
