# MG01_PRISMA.md — método da onda MG-01 (MASTER GATE FINAL — forense PostgreSQL/Prisma)

## O que é

MG-01 é a 1ª onda da campanha MASTER GATE FINAL (pré-RELEASE). O domínio é
PostgreSQL/Prisma, examinado por varredura forense ESTÁTICA e READ-ONLY:
nada conecta, nada executa, nada escreve além de 2 documentos aditivos em
docs/ (MG01_RELATORIO.md, do payload verbatim, e MG01_ACHADOS.md, gerado
pela execução). A onda só corre sobre a fundação SELADA — a tag
SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada e apontar para
o commit do RUN29-A (rc=98 se não).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   33 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA (read-only): schema (contagens; nomes nunca exibidos),
   datasource (env() vs literal — valor NUNCA exibido), migrations
   (contagens + operações destrutivas por arquivo:linha — conteúdo nunca
   exibido), drift estático (com @@map), package.json (versões), presença
   de DATABASE_URL/DIRECT_URL/SHADOW_DATABASE_URL (nomes apenas).
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG01_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO alimenta
a decisão de RELEASE do dono; a correção nasce em onda própria da campanha.

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
