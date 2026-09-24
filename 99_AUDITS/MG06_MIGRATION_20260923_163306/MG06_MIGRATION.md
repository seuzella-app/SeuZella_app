# MG06_MIGRATION.md — método da onda MG-06 (MASTER GATE FINAL — migration: segurança e reversibilidade)

## O que é

MG-06 é a 6ª onda da campanha MASTER GATE FINAL (pré-RELEASE), sucessora do
MG-01 (PostgreSQL/Prisma), do MG-02 (Build), do MG-03 (CI), do MG-04
(tenant isolation) e do MG-05 (billing). O domínio é a SEGURANÇA e a
REVERSIBILIDADE do histórico de migrations (prisma/migrations), verificadas
por varredura forense ESTÁTICA e READ-ONLY: nenhuma migração é executada,
nenhuma consulta é feita, o banco NUNCA é conectado (o Prisma não é
invocado), nada usa rede, nada escreve além de 2 documentos aditivos em
docs/ (MG06_RELATORIO.md, do payload verbatim, e MG06_ACHADOS.md, gerado
pela execução). A onda só corre sobre a fundação SELADA — a tag
SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada e apontar para
o commit do RUN29-A (rc=98 se não) — e sobre as ondas anteriores da campanha
(MG-01 a MG-05 fechados: docs/MG01_* a docs/MG05_* são dependências, rc=86).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   43 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA MIGRATION — SEGURANÇA E REVERSIBILIDADE (read-only):
   inventário de migrations (NOMES só na evidência MG06_MIGR_INVENTORY.txt),
   migration_lock.toml em presença (provedor NUNCA exibido; AUSENTE =
   ATENÇÃO), sinalizações construtivas em contagens (CREATE TABLE, CREATE
   INDEX, CREATE UNIQUE INDEX, CONSTRAINT, IF NOT EXISTS, IF EXISTS —
   evidência MG06_MIGR_SIGNALS.txt), operações destrutivas (DROP
   TABLE/COLUMN/SCHEMA/TYPE/DATABASE, TRUNCATE) em contagens e arquivo:linha
   (MG06_MIGR_HITS.txt — conteúdo NUNCA exibido), DELETE FROM e ALTER
   COLUMN ... TYPE em ATENÇÃO própria, RLS/policy em profundidade
   (aprofundamento do MG-04 — nomes de policy NUNCA exibidos), migrations
   vazias (0 bytes) e diretórios fora da convenção de timestamp do Prisma
   (NOMES só na evidência), segredo literal em migrations = BLOQUEIO com
   VALOR NUNCA exibido.
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG06_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO/ATENÇÃO
alimentam a decisão de RELEASE do dono; a correção nasce em onda própria da
campanha. Exemplo de BLOQUEIO nesta onda: segredo literal em migrations
(VALOR NUNCA exibido; mover para env antes de qualquer execução).
Exemplos de ATENÇÃO: operações destrutivas (irreversibilidade potencial —
DROP/TRUNCATE podem ser legítimos em migração planejada, a decisão é do
dono); DELETE FROM (risco de perda de dados); ALTER COLUMN ... TYPE (risco
para dados existentes); migration_lock ausente (reversibilidade/execução
futura dependem da declaração); migrations vazias (manifesto sem efeito);
diretórios fora da convenção de timestamp (ordenação pode divergir).

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
