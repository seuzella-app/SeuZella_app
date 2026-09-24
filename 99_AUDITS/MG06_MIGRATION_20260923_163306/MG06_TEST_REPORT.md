# MG06_TEST_REPORT.md — MG-06 (MASTER GATE FINAL — migration: segurança e reversibilidade)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 6 de 9 (MG-06 migration)
- Modo da onda: forense ESTÁTICA READ-ONLY — NENHUMA execução/migração
  executada (leitura pura do filesystem), sem rede, sem banco, sem
  credenciais; valores de chaves/secrets NUNCA lidos/exibidos
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

## A varredura forense (o que o MG-06 examinou)

- inventário de migrations: 22 entrada(s) (NOMES na
  evidência MG06_MIGR_INVENTORY.txt) — conteúdo NUNCA exibido;
- migration_lock.toml: presença verificada (provedor NUNCA exibido) —
  AUSENTE é ATENÇÃO (reversibilidade/execução futura dependem da declaração);
- sinalizações construtivas em contagens (CREATE TABLE, CREATE INDEX,
  CREATE UNIQUE INDEX, CONSTRAINT, IF NOT EXISTS, IF EXISTS) — evidência
  MG06_MIGR_SIGNALS.txt;
- operações destrutivas (DROP TABLE/COLUMN/SCHEMA/TYPE/DATABASE, TRUNCATE),
  DELETE FROM e ALTER COLUMN ... TYPE: contagens e arquivo:linha em
  MG06_MIGR_HITS.txt (conteúdo NUNCA exibido) — ATENÇÃO se presentes;
- RLS/policy em profundidade (aprofundamento do achado do MG-04):
  arquivo:linha — nomes de policy NUNCA exibidos;
- migrations vazias (0 bytes) e diretórios fora do padrão de timestamp do
  Prisma: NOMES só na evidência (ATENÇÃO se presentes);
- segredo literal em migrations = BLOQUEIO (VALOR NUNCA exibido).

## Resumo dos achados

BLOQUEIOS=0 ATENÇÃO=2 INFO=9
  [INFO] inventário de migrations: 22 diretório(s) (NOMES na evidência MG06_MIGR_INVENTORY.txt — conteúdo NUNCA exibido)
  **[ATENÇÃO]** migration_lock.toml: AUSENTE — o provedor da migração não está declarado; reversibilidade/execução futura dependem desta declaração (criação é decisão do dono antes do RELEASE)
  [INFO] sinalizações construtivas: CREATE TABLE=31, CREATE INDEX=89, CREATE UNIQUE INDEX=19, CONSTRAINT=62, IF NOT EXISTS=43, IF EXISTS=17 (contagens em MG06_MIGR_SIGNALS.txt)
  **[ATENÇÃO]** operações destrutivas (DROP TABLE/COLUMN/SCHEMA/TYPE/DATABASE, TRUNCATE): 4 ocorrência(s) — arquivo:linha na evidência MG06_MIGR_HITS.txt (conteúdo NUNCA exibido): irreversibilidade potencial — revisão do dono antes do RELEASE
  [INFO] DELETE FROM em migrations: 0
  [INFO] mudanças de tipo de coluna (ALTER COLUMN ... TYPE): 0
  [INFO] RLS/policy em migrations (profundidade do achado do MG-04): 15 linha(s) — arquivo:linha na evidência MG06_MIGR_HITS.txt (nomes de policy NUNCA exibidos)
  [INFO] migrations vazias (migration.sql com 0 bytes): 0
  [INFO] diretórios fora do padrão de timestamp do Prisma (14 dígitos + _nome): 0 (todas no padrão)
  [INFO] 0 padrão de segredo literal em migrations
  [INFO] ausência: nenhuma execução, nenhuma migração executada, nenhuma consulta, sem banco, sem rede, sem credenciais nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.
