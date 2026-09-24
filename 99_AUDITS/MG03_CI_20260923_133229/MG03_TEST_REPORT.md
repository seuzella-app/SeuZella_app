# MG03_TEST_REPORT.md — MG-03 (MASTER GATE FINAL — forense CI)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 3 de 9 (MG-03 CI)
- Modo da onda: forense ESTÁTICA READ-ONLY — NENHUM workflow disparado
  (GitHub congelado), sem rede, sem banco, sem credenciais; valores de
  chaves/secrets NUNCA lidos/exibidos
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
- CONTENT VERIFY (relatório do payload): 40 OK / 0 FALHA (exigido 40/40)
- CONTENT RE-VERIFY (documentos instalados): 28/28 (20 canônicos no relatório + 8 incondicionais nos achados)
- SHAPES-3 RE-VERIFY (assinaturas nos arquivos reais): 9 OK / 0 FALHA (exigido 9/9)

## A varredura forense (o que o MG-03 examinou)

- .github/workflows: inventário por arquivo (triggers, jobs, permissions
  explícita/ausente) — lista completa em MG03_WORKFLOWS.txt;
- triggers: contagens (push/pull_request/schedule/workflow_dispatch/
  workflow_call) — expressões de cron NUNCA exibidas (agendamento é
  decisão do dono);
- permissions: workflows com bloco explícito vs default do repositório;
  permissions: write-all é apontado como privilégio excessivo;
- secrets referenciados: 8 NOME(s) (lista completa em
  MG03_SECRET_NAMES.txt) — valores NUNCA lidos (não existem no repositório);
- superfície de risco de CI: pull_request_target e permissões excessivas
  apontados por arquivo:linha — conteúdo NUNCA exibido;
- referências a deploy em CI: contagem por arquivo (CI congelado —
  execução NENHUMA; deploy oficial é da janela MG-07);
- vercel.json: SÓ LEITURA (NUNCA editado) — chaves por NOME e crons em
  contagem (expressões NUNCA exibidas);
- workflows e vercel.json: varredura de token de domínio proibido e de
  segredo literal (só arquivo:linha — conteúdo NUNCA exibido).

## Resumo dos achados

BLOQUEIOS=0 ATENÇÃO=0 INFO=16
  [INFO] workflows: 30 arquivo(s) em .github/workflows (nomes na evidência MG03_WORKFLOWS.txt)
  [INFO] triggers (contagens de arquivos): push=4 pull_request=7 schedule=13 workflow_dispatch=27 workflow_call=0
  [INFO] trigger schedule (cron) presente em 13 workflow(s) — expressões NUNCA exibidas (agendamento é decisão do dono)
  [INFO] permissions explícitas em 30/30 workflow(s) (GITHUB_TOKEN sem permissão explícita herda default do repo)
  [INFO] nenhum workflow com permissions: write-all (privilégio mínimo preservado)
  [INFO] secrets referenciados em workflows: 8 NOME(s) (lista na evidência MG03_SECRET_NAMES.txt; valores NUNCA lidos — não existem no repositório)
  [INFO] steps uses: (actions referenciadas): 41 ocorrência(s) — nomes/versões públicos (contagens)
  [INFO] referências a deploy em CI: 1 arquivo(s) (.github/workflows/deploy.yml
  [INFO] workflows: 0 padrão de segredo literal
  [INFO] dependabot.yml: presente (higiene de dependências versionada)
  [INFO] CODEOWNERS: ausente (revisão de PR não é obrigada por arquivo — GitHub congelado, inerte)
  [INFO] vercel.json: presente (SÓ LEITURA nesta onda — NUNCA editado pela campanha)
  [INFO] vercel.json: chaves canônicas detectadas (NOMES): framework regions rewrites headers crons functions
  [INFO] vercel.json: crons declarados = 34 (expressões/caminhos NUNCA exibidos — agendamento é decisão do dono)
  [INFO] vercel.json: 0 padrão de segredo literal
  [INFO] NENHUM workflow foi disparado nesta onda (GitHub congelado; a onda não toca em git remoto) — CI permanece INERTE por decisão da campanha

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.
