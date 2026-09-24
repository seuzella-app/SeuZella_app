# JEV — Método do SHADOW LEDGER (RUN24-A)

5ª onda da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION". O RUN23-A
MEDIU o baseline; esta onda PERSISTE a evidência de decisão em um LEDGER
APEND-ONLY, com IDEMPOTÊNCIA, RETENÇÃO e EXPORTAÇÃO local — e entrega a
PONTE pelas quais as amostras REAIS do Cérebro entrarão (na onda de fiação,
sem editar arquivo existente).

## 1. O que é o ledger

O ledger (`jev-ledger.ts`) é um log apend-only de entradas de decisão shadow:

- **Entrada**: seq monotônica, ts do evento, kind (`shadow-decision` |
  `cerebro-sample`), source, requestId, tenantHash (sha256-16hex), modo,
  status/label/confiança local, label remoto, agreement, expectedLabel,
  contentHash. **Payload não existe no formato** — não é "escondido": o
  formato não tem onde colocá-lo e o append RECUSA qualquer draft que o
  traga (`payload-forbidden`).
- **Append-only**: nenhuma API muta/remove entrada individual; entradas são
  congeladas (`Object.freeze`) e o teste prova imutabilidade. A ÚNICA saída
  é a retenção (abaixo).
- **Idempotência**: `contentHash` = sha256 do conteúdo SEMÂNTICO (timestamp
  FORA do hash). Re-append do mesmo conteúdo (retry, re-exportação) devolve
  o seq existente com `duplicate: true` — linha nunca duplica.
- **Retenção** (política da onda): idade máxima 30 dias (`retentionMs`) +
  capacidade máxima 1000 entradas na janela; clock injetável (determinismo).
  Poda as mais antigas; nunca reescreve o que está dentro da janela.
- **Fail-closed**: `append` nunca lança — resultado tipado com reason
  (`tenant-hash-invalido`, `payload-forbidden`, `campo-desconhecido:*`,
  `modo-invalido`, `status-pendente-nao-aceita-label`, etc.).

## 2. Sinks locais (opt-in explícito)

`jev-ledger-sink.ts` define `JevLedgerSink` (append de linhas JSONL já
higienizadas) com duas implementações:

- **MemorySink** — guarda linhas em memória (inspeção/testes); lote que
  excede a capacidade é recusado INTEIRO (atômico).
- **FileSink** — append em arquivo JSONL (default `jev-ledger.jsonl`) com
  flag `'a'` (NUNCA trunca arquivo existente). Exige caminho ABSOLUTO
  passado pelo chamador; construído com `null` = desativado (fail-closed).
  Linha acima de 4096 chars ou com quebra de linha inesperada recusa o
  lote (defesa contra vazamento de conteúdo bruto).

Nenhum fluxo de produção chama sink nesta onda — a decisão de destino
definitivo (dir/período/rotação) é da onda de fiação, com aprovação do dono.

## 3. Ponte das amostras do Cérebro

`jev-cerebro-samples.ts` é a fronteira pelas quais amostras REAIS entrarão:

- `JevSampleSource` (port): a fiação no Cérebro implementa a leitura
  read-only da fonte real num ARQUIVO NOVO — sem editar código existente;
- `parseCerebroSample` (parser puro, nunca lança): tenantId -> hash (id puro
  não atravessa), tenant `demo` recusado, payload passa pelo MESMO firewall
  da produção (allowlist por modo + PII ofuscada), amostra que sobra vazia
  após o firewall é RECUSADA, expectedLabel opcional;
- fingerprint de conteúdo (sha256) vira requestId — o dedupe do ledger
  elimina re-exportações idênticas;
- `toLedgerDrafts` gera entradas `cerebro-sample` com status `pending`
  (a decisão virá pelo runner em onda futura).

## 4. Evidência da onda (relatório pinado)

O suite escreve `JEV_LEDGER_REPORT.json` (via `JEV_LEDGER_EVIDENCE_DIR`)
com um cenário determinístico: 6 entradas shadow-decision (2 match, 2
mismatch, 1 sem remoto, 1 rejeitada) + 3 amostras Cérebro (com PII no cru,
higienizadas) + 1 re-exportação dedupeada + 2 tentativas inválidas recusadas
+ 1 entrada velha podada pela retenção + flush em FileSink de tmpdir.
**Números pinados**: total=9 (shadow=6, cerebro=3), agreement 2/2 = 50%,
sink written=9, lastPruned=1. Cinco invariantes provadas sobre o próprio
estado/serialização: `seqMonotonic`, `tenantHashOnly`, `payloadNotSerialized`,
`appendOnlyFrozen`, `idempotentAppends`.

## 5. O que esta onda NÃO faz

Não lê banco, não toca Payload/Cérebro, não chama rede, não lê env, não
adiciona chave de ambiente nova, não edita arquivo existente, não faz push,
não toca domínio financeiro. A extração REAL de amostras do Cérebro acontece
na onda de FIAÇÃO, implementando a ponte desta onda.

## 6. Próxima onda

INTEGRAÇÃO TYPESAFE — o `remotePort` acende (agreement local-vs-remoto),
`TYPESAFE_API_KEY` entra SÓ no `.env.local` do iMac nessa onda, e as
security tests restantes (rate-limit do endpoint, auth M2M, fuzz do parser
remoto) ganham evidência própria.
