# MG04_TEST_REPORT.md — MG-04 (MASTER GATE FINAL — forense tenant isolation)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 4 de 9 (MG-04 tenant isolation)
- Modo da onda: forense ESTÁTICA READ-ONLY — NENHUMA consulta executada
  (nenhum dado de tenant lido), sem rede, sem banco, sem credenciais;
  valores de chaves/secrets NUNCA lidos/exibidos
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

## A varredura forense (o que o MG-04 examinou)

- middleware: presença, menções a tenant em contagem e matchers em contagem
  (caminhos NUNCA enumerados — conteúdo NUNCA exibido);
- guards da casa: uso por contagem de arquivos (requireInternalSecret,
  tenantBudgetGuard/canUseTier, CircuitBreaker, guardRequest) — definições
  re-verificadas pelo SHAPES-3 nesta execução;
- menções a tenant em src/: 503 arquivo(s) (contagens por
  arquivo em MG04_TENANT_FILES.txt) — conteúdo NUNCA exibido;
- schema: modelos e modelos com campo tenantId em CONTAGEM (NOMES de modelo
  NUNCA exibidos);
- migrations: RLS/policy em contagem (a profundidade é a onda MG-06);
- rotas de API: inventário de guards por rota (321 rota(s)
  em MG04_ROUTES_GUARD.txt) — rota sem guard da casa = ATENÇÃO;
- superfície tenant (rotas + middleware): segredo literal = BLOQUEIO (VALOR
  NUNCA exibido); consulta raw e token de domínio proibido = ATENÇÃO
  (arquivo:linha em MG04_SURFACE_HITS.txt — conteúdo NUNCA exibido).

## Resumo dos achados

BLOQUEIOS=0 ATENÇÃO=3 INFO=10
  [INFO] middleware: presente (src/middleware.ts) — 1 linha(s) com menção a tenant (CONTAGEM — conteúdo NUNCA exibido)
  [INFO] middleware: 1 linha(s) com matcher (contagem — caminhos NUNCA enumerados nesta onda)
  [INFO] guards da casa em uso (contagem de arquivos em src/): requireInternalSecret=7 budget=17 circuit=16 wiring=94 (definições re-verificadas pelo SHAPES-3; conteúdo NUNCA exibido)
  [INFO] menções a tenant em src/: 503 arquivo(s) (contagens por arquivo na evidência MG04_TENANT_FILES.txt — conteúdo NUNCA exibido)
  [INFO] schema: 127 modelo(s), 81 com campo tenantId (NOMES de modelo NUNCA exibidos — contagens)
  [INFO] migrations com RLS/policy: 2 arquivo(s) (contagem — conteúdo NUNCA exibido)
  [INFO] rotas de API: 321 route.ts em src/app/api (guards por rota na evidência MG04_ROUTES_GUARD.txt)
  [INFO] rotas com guard da casa: 95/321 (nomes das rotas e guards detectados apenas na evidência — conteúdo NUNCA exibido)
  **[ATENÇÃO]** 226 rota(s) de API sem import de guard da casa (NOMES na evidência MG04_ROUTES_GUARD.txt; conteúdo NUNCA exibido): superfície para revisão do dono antes do RELEASE — webhooks com assinatura própria podem ser legítimos
  [INFO] superfície tenant (rotas + middleware): 0 padrão de segredo literal
  **[ATENÇÃO]** consulta raw ($queryRaw/$executeRaw) na superfície tenant: 17 ocorrência(s) — arquivo:linha na evidência MG04_SURFACE_HITS.txt (conteúdo NUNCA exibido): verificar escopo por tenant
  **[ATENÇÃO]** token de domínio proibido na superfície tenant: 80 ocorrência(s) — arquivo:linha na evidência MG04_SURFACE_HITS.txt (conteúdo NUNCA exibido; NOMES de arquivo que contêm o próprio token ficam retidos dos documentos desta onda; profundidade no MG-05)
  [INFO] isolamento: nenhuma consulta executada, nenhum dado de tenant lido nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.
