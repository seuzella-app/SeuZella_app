# SZ_JEV_CRON_V1 — RUN27-A: USO REAL NO CRON DO CÉREBRO (SHADOW_ONLY)

## O que esta onda entrega

A 8ª onda da trilha JEV dá ao ciclo shadow (RUN26-A) o **primeiro chamador de
produção**: uma rota NOVA de cron (`src/app/api/cron/jev-shadow-pulse/route.ts`)
que segue o padrão das rotas irmãs da casa (`dynamic = 'force-dynamic'`,
`maxDuration = 60`) e aplica, nesta ordem fail-closed:

| Gate | Módulo da casa (assinatura EXATA das shapes-2) | Falha => |
|---|---|---|
| 1. `?src=` ausente | — (opt-in por construção) | inerte `fonte-nao-indicada` |
| 2. fonte recusada | `createFileSampleSource` (RUN26-A) | inerte `fonte-ausente` |
| 3. budget | `tenantBudgetGuard.canUseTier(tenantId, tier, estimatedCost?, plan?)` | skip `budget-indisponivel` |
| 4. fusível | `CircuitBreaker` via sonda `probeHouseBreaker` (allow/recordSuccess/recordFailure) | skip `breaker-indisponivel` / `breaker-aberto` |
| 5. ciclo + teto | `runCerebroShadowCycle` (RUN26-A) com timer próprio de 25s | `ciclo-timeout` / http 500 tipado |

- Auth da rota: `requireInternalSecret(req): Response | null` — a recusa da
  casa é devolvida INTACTA (o kit não reinventa auth).
- Chave de budget SINTÉTICA (`jev-shadow-pulse`): não é tenant real, nunca sai
  do processo; tier 0 e custo estimado 0 (o pulso é shadow).
- Sonda do fusível: NUNCA presume construtor/config — se a forma real do
  `CircuitBreaker` não expuser os 3 métodos esperados, o gate fica
  `indisponivel` e o pulso é RECUSADO (fail-closed).
- `withLlmTimeout`/`withLlmFallback` e as flags `USE_TF_*` EXISTEM no projeto,
  mas os parâmetros/módulo de origem não vieram nas shapes-2 — NÃO são usados
  (lição RUN25-A: nunca adivinhar assinatura interna). Documentado na seção K.

## SHAPES-3 VERIFY (novo gate, rc=87)

Antes de instalar, o driver confere NOS ARQUIVOS REAIS as 9 assinaturas que o
payload usa. Qualquer desvio => rc=87, nada é modificado. A lição RUN25-A
("nunca presumir a política/assinatura interna de módulos da casa") virou gate
permanente da trilha.

## Uso real (decisão do DONO)

1. Gere o export JSONL de amostras (1 por linha; tenant 'demo' recusado; um
   dos 7 modos do contrato; firewall de PII aplica; caps 5 MB / 10k linhas).
2. Com o servidor da casa rodando e autenticado pelo mecanismo interno
   (internal-secret), chame:
   `/api/cron/jev-shadow-pulse?src=<CAMINHO-ABSOLUTO-DO-ARQUIVO.jsonl>&max=<1..500>`
3. A resposta contém SÓ contagens (zero payload/tenant real/segredo).
4. Agendamento externo (vercel.json): NÃO é editado pelo kit — decisão do dono.

## Arquivos instalados (3, aditivos)

- `src/lib/ai/jev/jev-cerebro-cron-pulse.ts` — lib do pulso (gates + sonda + timer)
- `src/app/api/cron/jev-shadow-pulse/route.ts` — rota nova (aditiva)
- `src/__tests__/jev/jev-cron.test.ts` — suíte por contrato + integração mockada

## Segurança (invariantes da trilha, agora 29 provas)

Resposta só contagens; tenant puro nunca sai (ledger só hashes); recusa de
auth intacta; zero env nos arquivos de produção da onda; zero rede real nos
testes (fetch injetado/mocked); zero domínio financeiro; NUNCA push.
