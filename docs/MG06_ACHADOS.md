# MG06_ACHADOS.md — achados da varredura forense MG-06 (migration — segurança e reversibilidade)

- Onda: MG-06 (MASTER GATE FINAL — campanha pré-RELEASE)
- Modo: READ-ONLY estático — nenhuma execução, nenhuma migração executada,
  sem rede, sem banco, sem credenciais (NUNCA push)
- Execução: 20260923_163306
- Escopo: inventário de migrations (NOMES só na evidência), migration_lock
  em presença (provedor NUNCA exibido), sinalizações construtivas em
  contagens, operações destrutivas/DELETE FROM/ALTER COLUMN TYPE em
  contagens e arquivo:linha, RLS/policy em profundidade (aprofundamento do
  MG-04), migrations vazias, convenção de timestamp, segredo literal —
  valores NUNCA exibidos

## ACHADOS DA VARREDURA

- [INFO] inventário de migrations: 22 diretório(s) (NOMES na evidência MG06_MIGR_INVENTORY.txt — conteúdo NUNCA exibido)
- **[ATENÇÃO]** migration_lock.toml: AUSENTE — o provedor da migração não está declarado; reversibilidade/execução futura dependem desta declaração (criação é decisão do dono antes do RELEASE)
- [INFO] sinalizações construtivas: CREATE TABLE=31, CREATE INDEX=89, CREATE UNIQUE INDEX=19, CONSTRAINT=62, IF NOT EXISTS=43, IF EXISTS=17 (contagens em MG06_MIGR_SIGNALS.txt)
- **[ATENÇÃO]** operações destrutivas (DROP TABLE/COLUMN/SCHEMA/TYPE/DATABASE, TRUNCATE): 4 ocorrência(s) — arquivo:linha na evidência MG06_MIGR_HITS.txt (conteúdo NUNCA exibido): irreversibilidade potencial — revisão do dono antes do RELEASE
- [INFO] DELETE FROM em migrations: 0
- [INFO] mudanças de tipo de coluna (ALTER COLUMN ... TYPE): 0
- [INFO] RLS/policy em migrations (profundidade do achado do MG-04): 15 linha(s) — arquivo:linha na evidência MG06_MIGR_HITS.txt (nomes de policy NUNCA exibidos)
- [INFO] migrations vazias (migration.sql com 0 bytes): 0
- [INFO] diretórios fora do padrão de timestamp do Prisma (14 dígitos + _nome): 0 (todas no padrão)
- [INFO] 0 padrão de segredo literal em migrations
- [INFO] ausência: nenhuma execução, nenhuma migração executada, nenhuma consulta, sem banco, sem rede, sem credenciais nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas
- [INFO] BLOQUEIOS=0 ATENÇÃO=2 INFO=9

## RESUMO

- BLOQUEIOS: 0
- ATENÇÃO: 2
- INFO: 9

## LEITURA

Achados BLOQUEIO não bloqueiam esta onda (a onda forense é GREEN quando a
varredura conclui e a fundação está íntegra): eles ALIMENTAM a decisão de
RELEASE do dono. Correções nascem em ondas próprias da campanha
MASTER GATE FINAL (fail-closed, NUNCA push).

## PRÓXIMO PASSO

MG-07 — VPS/deploy (preparação e, se o dono quiser, o next build oficial —
método próprio da onda, credenciais e acendimento 100% do dono, valores
NUNCA exibidos).
