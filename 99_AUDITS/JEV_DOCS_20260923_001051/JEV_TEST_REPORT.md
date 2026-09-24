# JEV_TEST_REPORT.md — RUN28-A (subset DOCS)

- Suítes executadas (vitest): 8 (em src/__tests__/jev/ — include do vitest do projeto)
  - src/__tests__/jev/jev-contract.test.ts     (contrato + firewall — RUN22-A)
  - src/__tests__/jev/jev-registry.test.ts     (kind=DECISION fail-closed — RUN22-A)
  - src/__tests__/jev/jev-shadow.test.ts       (config + shadow runner + adapter — RUN22-A)
  - src/__tests__/jev/jev-harness.test.ts      (corpus + agreement + invariants — RUN23-A)
  - src/__tests__/jev/jev-ledger.test.ts       (ledger + retenção + sinks + ponte — RUN24-A)
  - src/__tests__/jev/jev-integration.test.ts  (rate-limit + M2M + SSRF + fuzz + wiring — RUN25-A)
  - src/__tests__/jev/jev-wiring.test.ts       (fonte real + ciclo + ledger + sink — RUN26-A)
  - src/__tests__/jev/jev-cron.test.ts         (pulso: gates + fusível + timeout + integração — RUN27-A)
- Resultado: 8 passed / 0 failed
- tsc --noEmit: 0 erro(s) total | residuais conhecidos RUN19-A tolerados | NOVOS: 0 (exigido: 0)
- CONTENT VERIFY (docs do payload): 34 OK / 0 FALHA (exigido 34/34)
- CONTENT RE-VERIFY (arquivos instalados): 20/20 (cópia byte-idêntica)

## Leitura desta onda

Esta onda NÃO adiciona código: instala 3 documentos em docs/ e PROVA que o
projeto segue estável (tsc 0 novos + 8 suítes GREEN + conteúdo canônico). A
documentação é aditiva e não edita nenhum arquivo existente.

## Mapeamento para as security tests da diretiva (estado acumulado da trilha)

| # | Segurança provada na trilha |
|---|---|
| 1 | fetch nunca é chamado sem JEV_ENABLED=true E TYPESAFE_API_KEY (RUN22-A) |
| 2 | valor da chave nunca aparece em serialização do config (RUN22-A) |
| 3 | tenant ausente/vazio/longo recusado (RUN22-A) |
| 4 | tenant 'demo' recusado em produção (RUN22-A) |
| 5 | buffer shadow guarda HASH do tenant — id puro nunca serializado (RUN22-A) |
| 6 | payload nunca serializado no buffer shadow (RUN22-A) |
| 7 | firewall deny-by-default (RUN22-A) |
| 8 | PII ofuscada (e-mail/telefone) na fronteira (RUN22-A) |
| 9 | kind GENERATIVE recusado no registro (RUN22-A) |
| 10 | shadowOnly=false recusado no registro (RUN22-A) |
| 11 | shadowOnly literal true em TODA variante de resposta (RUN22-A) |
| 12 | modo inválido recusado em contrato/firewall/adapter (RUN22-A) |
| 13 | fetch global NUNCA chamado pelo harness (RUN23-A — sem rede por construção) |
| 14 | relatório do harness sem tenantId puro (provado sobre a serialização) |
| 15 | relatório do harness sem payload/texto do corpus |
| 16 | ledger RECUSA draft com payload — PII nunca entra no log persistido (RUN24-A) |
| 17 | idempotência de ledger: re-append do mesmo conteúdo não duplica linha (RUN24-A) |
| 18 | política de retenção: poda por idade/capacidade, clock injetado (RUN24-A) |
| 19 | RATE-LIMIT do endpoint: janela nega acima do teto + cooldown pós-429 + decorator nem chama o inner (RUN25-A) |
| 20 | AUTH M2M: Bearer exato no host liberado, payload minimizado, chave nunca em corpo/resposta/erro (RUN25-A) |
| 21 | SSRF na fronteira: veredito de bloqueio do guard da casa honrado antes de QUALQUER rede (RUN25-A) |
| 22 | FUZZ do parser remoto: 240 corpos determinísticos — nunca lança, sempre tipado, desvio recusado (RUN25-A) |
| 23 | FONTE REAL read-only: caps de tamanho/linhas; caminhos sujos => null (RUN26-A) |
| 24 | CICLO fail-closed: fonte ausente/quebrada => inerte tipado; re-ciclo idempotente (RUN26-A) |
| 25 | PULSO fail-closed: sem ?src= => inerte; budget recusado => skip; fusível aberto/indisponível => skip (RUN27-A) |
| 26 | AUTH da rota: requireInternalSecret da casa — recusa devolvida INTACTA; zero env na produção da onda (RUN27-A) |
| 27 | TETO DE TEMPO: ciclo que não termina em 25s é abandonado com reason tipada + recordFailure no fusível (RUN27-A) |
| 28 | SONDA do fusível: qualquer forma divergente do CircuitBreaker da casa => gate indisponível => pulso recusado (RUN27-A) |
| 29 | RESPOSTA só contagens: zero tenant/payload/segredo no body (scan estrutural da serialização — RUN27-A) |

Diretiva cumprida: a DOCUMENTAÇÃO agora é canônica e verificada — o análogo
documental do SHAPES-3 (CONTENT VERIFY, rc=88) garante que o que está escrito
em docs/ corresponde exatamente aos termos, razões e âncoras da trilha. Remoto
segue SHADOW_ONLY; NUNCA push.
