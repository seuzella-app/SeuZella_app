# JEV — Método da FIAÇÃO NO CÉREBRO (RUN26-A)

7ª onda da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION". O RUN24-A
construiu a ponte (port + parser), o RUN25-A construiu a fábrica protegida
do remotePort; esta onda os FIA num uso real de ponta a ponta — tudo em
arquivos NOVOS — e extrai as shapes-2 exatas para o uso real no cron.

## 1. O que esta onda entrega

- **`jev-cerebro-file-source.ts`** — a FONTE REAL de amostras
  (implementa `JevSampleSource` da RUN24-A):
  - leitura READ-ONLY de um export JSONL EXISTENTE (caminho explícito,
    opt-in — o kit NUNCA procura nem lê dados por conta própria);
  - caps: 5 MB (`JEV_FILE_SOURCE_MAX_BYTES`) e 10.000 linhas
    (`JEV_FILE_SOURCE_MAX_LINES`) — arquivo maior é RECUSADO;
  - fail-closed: caminho vazio/sem .jsonl/inexistente/diretório =>
    fonte null; leitura falha => lote vazio tipado; NUNCA lança;
  - linhas inválidas seguem CRUAS para o parser da RUN24-A, que as recusa
    com reason tipado (nada "entra para ver se serve").

- **`jev-cerebro-shadow-loop.ts`** — o CHAMADOR do ciclo shadow:
  - `runCerebroShadowCycle(opts)`: fonte -> parser (firewall/tenant-hash/
    fingerprint) -> ledger (`cerebro-sample` pending) -> runner shadow
    (local SEMPRE + remoto PROTEGIDO quando aceso, via
    `createActiveShadowRunner` da RUN25-A) -> ledger (`shadow-decision`
    com labels/agreement) -> export JSONL -> sink local opt-in;
  - fail-closed: fonte ausente/quebrada => ciclo INERTE tipado
    (`fonte-ausente` / `fonte-falhou-leitura`); NUNCA lança;
  - caps: `maxSamples` clamp [1..500] (default 50) + `readCapped` no
    relatório;
  - higiene estrutural: o relatório carrega SÓ contagens/estados — zero
    payload, zero tenant puro, zero chave (provado sobre a serialização).

- **`jev-wiring.test.ts`** — 7ª suíte JEV (12 testes) com cenário PINADO:
  - export com 6 linhas (3 válidas + demo + modo inválido + lixo) =>
    3 aceitas / 3 recusas tipadas;
  - remoto aceso (fetch mock RESERVA): 3 avaliadas => 3 remotas ok =>
    2 acordos + 1 divergência (RESERVA, RESERVA, PRECO_INFO locais);
  - re-ciclo com a mesma fonte/ledger => 0 novos + 6 duplicatas
    (idempotência por contentHash de ponta a ponta);
  - caps: `maxSamples=2` => readCapped + 4 appends;
  - sink: 6 linhas, nenhuma com `"payload"`, tenant puro ou chave; todos
    os tenantHash 16-hex;
  - invariantes: tenantHashOnly, payloadNotSerialized, idempotentCycle,
    networkOnlyMocked, capRespected, secretNeverInReport — todas `true`
    no relatório (`JEV_WIRING_REPORT.json`).

- **MOTOR READ-ONLY SHAPES-2** (`kit_scripts/jev_shapes2.js`, fora do
  payload): extrai exports/métodos de budget-guard, circuit-breaker,
  llm-timeout, o corpo da rota cron do Cérebro, modelos prisma com tenant,
  middleware e flags USE_TF_* — com PROVA de árvore intocada (git status
  antes/depois idênticos). Saída: `JEV_WIRING_SHAPES.md/.json` na evidência.
  É a AUTORIZAÇÃO da próxima onda usar essas peças com assinaturas exatas
  (lição RUN25-A: nunca presumir a política/assinatura interna da casa).

## 2. Como o ciclo é executado (hoje e depois)

- HOJE (esta onda): o ciclo é executado pela SUÍTE de fiação com fetch
  injetado e export de teste — prova de ponta a ponta SEM tocar produção.
- PRÓXIMA ONDA (USO REAL NO CRON): a rota cron do Cérebro (arquivo novo)
  chama `runCerebroShadowCycle` com as shapes-2 exatas
  (circuit-breaker/budget/llm-timeout) e a fonte apontada para o export
  JSONL que VOCÊ gerar (formato na seção F do digest).

## 3. Segurança (matriz desta onda)

- **Fonte read-only**: flag 'r', caps de tamanho/linhas, sem glob, sem
  rede, sem env — o caminho é parâmetro explícito do chamador.
- **Tenant puro**: entra só no runner (que hasheia — RUN22-A) e no parser
  (que hasheia — RUN24-A); ledger/relatório/sink só têm hashes 16-hex.
- **Payload**: nunca serializado no ledger (recusado no append), nunca no
  relatório do ciclo, nunca no sink (linhas higienizadas).
- **Fail-closed**: qualquer problema vira estado tipado inerte; o ciclo
  NUNCA quebra o chamador.
- **SHADOW_ONLY**: `shadowOnly` literal true em toda resposta; nada vivo;
  nada em produção chama o ciclo nesta onda.

## 4. O que esta onda NÃO faz

Não edita arquivo existente, não lê banco (extração é via export JSONL do
dono; prisma é extraído read-only para a próxima onda), não faz chamada de
rede real (fetch injetado nos testes), não escreve no `.env.local`, não lê
valor de chave alguma (apenas presença), não faz push, não toca domínio
financeiro. Circuit-breaker/budget-guard REAIS continuam intocados — as
shapes-2 desta onda autorizam o uso deles na próxima.

## 5. Roadmap restante da trilha

USO REAL NO CRON DO CÉREBRO (chamada do ciclo com as shapes-2, arquivo
novo) → DOCS → MASTER GATE → VPS.
