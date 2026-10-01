# W1.1 — Mapa de Autoridade do Bundler de Produção

> Task ID: W1.1-E2E007-CLOSURE · Branch: feat/real-business-workflow-hardening · HEAD base: 71eac1667e6b3cbd92079ab8a245760b73f11e08
> Fonte: leitura integral de `src/lib/message-bundler.ts` (629 LoC), `src/app/api/internal/flush-buffer/route.ts`, `src/app/api/webhooks/whatsapp/route.ts` (1019 LoC), `src/app/api/webhook-whatsapp/route.ts`, `src/lib/queue/queue-service.ts`, `src/lib/queue/queue-bridge.ts`.

## Production entrypoint
- arquivo: `src/lib/message-bundler.ts`
- função: `bufferMessage(payload, processor)` (linha 269) — chamada pela rota canônica `src/app/api/webhooks/whatsapp/route.ts:795` (mensagens normais; opt-out LGPD é interceptado antes e NÃO passa pelo bundler, linhas 730-792).

## Queue
- arquivo: `src/lib/message-bundler.ts` (`bufferMessageViaQStash`, linha 302)
- tecnologia: **Lista Redis via Upstash REST** (`POST /pipeline` com `RPUSH` + `EXPIRE`) — NÃO é BullMQ, NÃO é ioredis direto
- nome: `mb:<tenantId>:<telefoneSanitizado>` (`redisKey()`, linha 231) com `EXPIRE BUNDLE_BUFFER_TTL_SECONDS = 30`

## Worker (consumidor real)
- arquivo: `src/app/api/internal/flush-buffer/route.ts` (37 LoC, wrapper com auth `INTERNAL_ENDPOINT_TOKEN` timing-safe) → `src/lib/message-bundler.ts:550`
- função: `handleFlushBufferRequest(req, processor)` — é esta função que executa o claim/concat/requeue
- agendador: **QStash** (`POST {QSTASH_URL}/publish` com `Upstash-Delay: 3s` e `Upstash-Deduplication-Id`), NÃO um worker loop próprio

## Claim
- arquivo: `src/lib/message-bundler.ts` linhas 420-433 (flush síncrono) e 568-587 (handler do endpoint)
- função: `GET {UPSTASH_REDIS_REST_URL}/lpop/<key>/100` — **CLAIM ATÔMICO (LPOP count)**, RBW Fase N
- semântica: remove-e-entrega atomicamente; o 2º worker concorrente recebe lista vazia e retorna `{success:true, messageCount:0}` (no-op idempotente)

## Lease
- **NÃO EXISTE lease/TTL-claim em produção.** A atomicidade do claim É o LPOP (design RBW Fase N, comentário nas linhas 420-425).
- Qualquer teste que implemente `SET NX EX` como "lease" testa uma primitiva que o runtime não usa → classificado TEST LOGIC na auditoria do e2e-007 anterior.

## Requeue
- arquivo: `src/lib/message-bundler.ts` linhas 452-470 (síncrono) e 596-613 (handler)
- função: em falha do processor → `POST /rpush/<key>` (devolve EXATAMENTE as strings reclamadas, ordem preservada) + `GET /expire/<key>/30` (TTL renovado) → retorno `{success:false, error:'PROCESSOR_FAILED_REQUEUED'}`

## Dedup (agendamento)
- arquivo: `src/lib/message-bundler.ts` linha 253 — `buildFlushDeduplicationId(tenantId, guestPhone, nowMs)`
- bucket determinístico = `floor(nowMs / BUNDLE_WINDOW_MS)`; id = `rbw-flush:<tenant>:<phone>:<bucket>`
- garantia de liveness documentada no próprio código (linhas 237-252, fix RBW v2 da supressão de publishes legítimos)

## Bundle window
- arquivo: `src/lib/message-bundler.ts` linha 19
- const/config: `export const BUNDLE_WINDOW_MS = 3000` (3s); `BUNDLE_BUFFER_TTL_SECONDS = 30`
- **Única definição no runtime** (grep provado). O e2e-007 anterior definia `BUNDLE_WINDOW_MS = 300` LOCAL — sombra sintética do valor real.

## Executor
- arquivo: `src/lib/whatsapp-ai-responder.ts` (`processIncomingMessage`) — injetado como `processor` pela rota flush-buffer (route.ts:21) e pela rota canônica; a injeção por parâmetro é o desenho de produção (o bundler nunca importa o executor internamente)

## QStash
- uso: agendamento do flush com delay de 3s + dedup id por ciclo; callback = `POST {NEXT_PUBLIC_APP_URL}/api/internal/flush-buffer`
- fallback honesto no código: publish QStash falhou → `flushBufferSynchronous` (mesmo contrato LPOP, linhas 405-478); Redis push falhou → `bufferMessageSynchronous`

## Redis
- uso: **Upstash Redis REST API** (HTTP fetch), endpoints usados pelo bundler: `POST /pipeline` (RPUSH+EXPIRE), `GET /lpop/<key>/100`, `POST /rpush/<key>`, `GET /expire/<key>/<ttl>`
- ioredis/bullmq existem em package.json mas o caminho RBW do WhatsApp NÃO os usa (ver legado abaixo)

## E2E atual (pré-W1.1)
- arquivo: `tests/e2e/e2e-007-real-concurrency.test.ts` (kit Wave 1, 425 LoC)

## Divergências do e2e-007 anterior vs produção (auditado arquivo-inteiro)
1. **G1 (ramo BullMQ)**: BullMQ não faz parte do caminho RBW do WhatsApp — `Queue/Worker` do BullMQ provam uma infraestrutura que o runtime não usa no fluxo alvo.
2. **G1 (ramo fallback)**: `claim()` implementado DENTRO do teste (lpop+hset) — primitiva, não o handler de produção (viola invariante T1 do CLAUDE.md).
3. **G2 inteiro**: lease `SET NX EX` + sweep de requeue inventados no teste — produção NÃO possui lease; claim = LPOP atômico; requeue = RPUSH de volta no código real de message-bundler.ts.
4. **G3 inteiro**: `enqueueBundled()` sintético com `INCR` contador — o 2º evento só incrementa contador e **nunca entra em payload algum** (evento perdido no modelo do teste). Produção agrupa RPUSH de payloads completos + LPOP 100 + concatenação `messageContent.join('\n')`.
5. **BUNDLE_WINDOW_MS = 300 local** sombreando o valor real (3000).
6. **ioredis direto** vs produção Upstash REST (HTTP fetch).

## Legado classificado (não é a autoridade)
- `src/app/api/webhook-whatsapp/route.ts` — rota **legada** (nome declarado no próprio comentário da rota canônica, linhas 91-96) → fila **em memória** `src/lib/queue/queue-service.ts` (Map/arrays, DLQ, retries) → processor WHATSAPP_WEBHOOK → `bufferMessage`. O processor deságua no MESMO bundler, mas o claim/exactly-once de produção é o do caminho QStash+Redis.
- `src/lib/queue/queue-bridge.ts` — ponte BullMQ opt-in (`enqueueJobWithBridge`); a rota legada usa `enqueueJob` puro (sem ponte). Não faz parte da autoridade RBW.

## Decisão de teste (regra §5/§8 da W1.1)
O E2E-007 reescrito atravessa EXATAMENTE: `bufferMessage` (RPUSH real + contrato QStash provado) → `handleFlushBufferRequest` (claim LPOP real + concat real + requeue real) sobre **redis-server real**, com dupla de transporte REST local (HTTP→RESP) que replica só os 4 endpoints Upstash usados pelo bundler — semântica atômica vem do redis-server real, não de código de teste. QStash é dupla de dependência externa HTTP (T2 do CLAUDE.md); a lógica sob teste é 100% código de produção.
