# MG03_CI.md — método da onda MG-03 (MASTER GATE FINAL — forense CI)

## O que é

MG-03 é a 3ª onda da campanha MASTER GATE FINAL (pré-RELEASE), sucessora do
MG-01 (PostgreSQL/Prisma) e do MG-02 (Build). O domínio é CI, examinado por
varredura forense ESTÁTICA e READ-ONLY: NENHUM workflow é disparado (o
GitHub está congelado e o git remoto NUNCA é tocado pela campanha), nada
conecta, nada executa, nada escreve além de 2 documentos aditivos em docs/
(MG03_RELATORIO.md, do payload verbatim, e MG03_ACHADOS.md, gerado pela
execução). A onda só corre sobre a fundação SELADA — a tag
SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada e apontar para o
commit do RUN29-A (rc=98 se não) — e sobre as ondas anteriores da campanha
(MG-01 e MG-02 fechados: docs/MG01_* e docs/MG02_* são dependências, rc=86).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   37 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA CI (read-only): .github/workflows (inventário por
   arquivo: triggers, jobs, permissions explícita/ausente), contagens de
   triggers (expressões de cron NUNCA exibidas — agendamento é decisão do
   dono), secrets referenciados por NOME (valores NUNCA lidos — não existem
   no repositório), superfície de risco (pull_request_target,
   permissions: write-all — arquivo:linha, conteúdo NUNCA exibido),
   referências a deploy em CI (contagem; execução NENHUMA), higiene
   (dependabot/CODEOWNERS), vercel.json SÓ LEITURA (chaves por NOME, crons
   em contagem), varredura de token de domínio proibido e de segredo
   literal (só arquivo:linha).
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG03_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO alimenta
a decisão de RELEASE do dono; a correção nasce em onda própria da campanha.
Exemplos de BLOQUEIO nesta onda: segredo literal em workflow ou em
vercel.json (valor NUNCA exibido).
Exemplos de ATENÇÃO: nenhum workflow versionado; pull_request_target
(checkout de PR com token do repo); permissions: write-all (privilégio
excessivo); token de domínio proibido em workflow/vercel.json (conteúdo
NUNCA exibido; profundidade no MG-05).

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
