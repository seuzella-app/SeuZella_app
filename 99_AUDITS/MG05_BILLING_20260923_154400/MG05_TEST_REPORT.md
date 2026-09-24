# MG05_TEST_REPORT.md — MG-05 (MASTER GATE FINAL — billing: ausência do domínio proibido)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 5 de 9 (MG-05 billing)
- Modo da onda: forense ESTÁTICA READ-ONLY — NENHUMA execução/consulta
  (leitura pura do filesystem), sem rede, sem banco, sem credenciais;
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

## A varredura forense (o que o MG-05 examinou)

- menções ao domínio proibido em src/ e next.config.ts: 174
  arquivo(s) (contagens por arquivo em MG05_BANNED_FILES.txt) — conteúdo
  NUNCA exibido;
- ocorrências arquivo:linha em código: 728 em MG05_CODE_HITS.txt
  (baseline conhecido do MG-02 separado do resto — conteúdo NUNCA exibido);
- rotas de API com o próprio token no caminho: contagem (NOMES só na
  evidência MG05_SURFACE_MORE.txt);
- package.json: dependências do domínio proibido/gateways financeiros em
  contagem (BLOQUEIO se presente — NOME só na evidência, versão NUNCA exibida);
- schema.prisma e migrations: menções em contagem/arquivo:linha (NOMES de
  modelo/campo NUNCA exibidos);
- vercel.json: SÓ LEITURA (NUNCA editado) — menções em contagem;
- documentos da campanha (MG-01..MG-04): coerência re-verificada (os rc=94
  das ondas anteriores re-provados nesta execução);
- segredo literal nos arquivos COM menção = BLOQUEIO (VALOR NUNCA exibido).

## Resumo dos achados

BLOQUEIOS=2 ATENÇÃO=6 INFO=3
  [INFO] menções ao domínio proibido em src/: 173 arquivo(s) (contagens por arquivo na evidência MG05_BANNED_FILES.txt — conteúdo NUNCA exibido)
  **[ATENÇÃO]** ocorrências do domínio proibido em código: 727 (arquivo:linha na evidência MG05_CODE_HITS.txt — conteúdo NUNCA exibido; baseline conhecido do MG-02: next.config.ts e src/middleware.ts; a remoção é decisão do dono antes do RELEASE)
  **[ATENÇÃO]** ocorrências FORA do baseline conhecido (next.config.ts e src/middleware.ts): 723 — arquivo:linha na evidência MG05_CODE_HITS.txt (conteúdo NUNCA exibido; NOMES de arquivo ficam na evidência)
  **[ATENÇÃO]** rotas de API com o próprio token no caminho: 1 (NOMES na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido): superfície exposta de domínio proibido — decisão do dono antes do RELEASE
  **[BLOQUEIO]** dependência do domínio proibido instalada no package.json: 1 ocorrência(s) (NOMES dos pacotes na evidência MG05_SURFACE_MORE.txt; versões NUNCA exibidas): presença de implementação financeira proibida — decisão de remoção é do dono antes do RELEASE
  **[ATENÇÃO]** schema.prisma: 1 linha(s) com menção ao domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — NOMES de modelo/campo NUNCA exibidos)
  **[ATENÇÃO]** migrations: 2 linha(s) com menção ao domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido)
  [INFO] vercel.json: 0 linha(s) com menção ao domínio proibido (só leitura; NUNCA editado)
  **[ATENÇÃO]** documentos da campanha: 1 ocorrência(s) do domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido): menção documental de proibição é legítima; a decisão de manter é do dono
  **[BLOQUEIO]** segredo literal em arquivo com menção ao domínio proibido: 1 ocorrência(s) — arquivo:linha na evidência MG05_CODE_HITS.txt; VALOR NUNCA exibido; mover para env antes de qualquer reativação
  [INFO] ausência: nenhuma execução, nenhuma consulta, sem rede, sem banco, sem credenciais nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.
