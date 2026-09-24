# MG02_BUILD.md — método da onda MG-02 (MASTER GATE FINAL — forense Build)

## O que é

MG-02 é a 2ª onda da campanha MASTER GATE FINAL (pré-RELEASE), sucessora do
MG-01 (PostgreSQL/Prisma). O domínio é BUILD, examinado por varredura
forense ESTÁTICA e READ-ONLY: o next build NÃO é executado (escreveria
artefatos e poderia tocar banco na prerender — a execução oficial é da
janela MG-07), nada conecta, nada executa, nada escreve além de 2 documentos
aditivos em docs/ (MG02_RELATORIO.md, do payload verbatim, e
MG02_ACHADOS.md, gerado pela execução). A onda só corre sobre a fundação
SELADA — a tag SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada
e apontar para o commit do RUN29-A (rc=98 se não) — e sobre o MG-01 fechado
(docs/MG01_RELATORIO.md + docs/MG01_ACHADOS.md são dependências, rc=86).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   35 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA BUILD (read-only): next.config (presença + chaves
   canônicas por NOME), tsconfig (strict/noEmit), package.json
   (scripts.build/typecheck/start, engines — leitura LOCAL, sem rede),
   toolchain instalado (next/react/react-dom/typescript + client prisma
   gerado), lockfile, artefato .next (BUILD_ID, staleness, .gitignore),
   superfície de rotas (CONTAGENS), superfície de env de build (NOMES
   apenas + NEXT_PUBLIC_*), configs de build (domínio proibido e segredo
   literal — só arquivo:linha).
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG02_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO alimenta
a decisão de RELEASE do dono; a correção nasce em onda própria da campanha.
Exemplos de BLOQUEIO nesta onda: package.json sem scripts.build;
tsconfig.json ausente; segredo literal em config de build.
Exemplos de ATENÇÃO: next.config ausente; toolchain incompleto; client
prisma não gerado; .next stale ou fora do .gitignore; NEXT_PUBLIC_* com
padrão de segredo no NOME.

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
