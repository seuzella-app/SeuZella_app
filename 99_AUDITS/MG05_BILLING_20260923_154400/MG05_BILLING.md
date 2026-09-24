# MG05_BILLING.md — método da onda MG-05 (MASTER GATE FINAL — billing: ausência do domínio proibido)

## O que é

MG-05 é a 5ª onda da campanha MASTER GATE FINAL (pré-RELEASE), sucessora do
MG-01 (PostgreSQL/Prisma), do MG-02 (Build), do MG-03 (CI) e do MG-04
(tenant isolation). O domínio é a AUSÊNCIA do domínio proibido (financeiro),
verificada por varredura forense ESTÁTICA e READ-ONLY: nenhuma execução,
nenhuma consulta, nada conecta em banco, nada usa rede, nada escreve além de
2 documentos aditivos em docs/ (MG05_RELATORIO.md, do payload verbatim, e
MG05_ACHADOS.md, gerado pela execução). A onda só corre sobre a fundação
SELADA — a tag SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada e
apontar para o commit do RUN29-A (rc=98 se não) — e sobre as ondas
anteriores da campanha (MG-01 a MG-04 fechados: docs/MG01_* a docs/MG04_*
são dependências, rc=86).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   41 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA BILLING — AUSÊNCIA DO DOMÍNIO PROIBIDO (read-only):
   menções ao domínio proibido em src/ (contagens por arquivo), ocorrências
   arquivo:linha em src/ + next.config.ts (baseline conhecido do MG-02
   separado de ocorrências fora dele), rotas com o próprio token no caminho
   (NOMES só na evidência), package.json (dependência do domínio proibido =
   BLOQUEIO), schema e migrations (contagens/arquivo:linha), vercel.json em
   só leitura, documentos da campanha re-verificados, segredo literal em
   arquivo com menção = BLOQUEIO com VALOR NUNCA exibido. Os NOMES dos
   tokens ficam confinados ao motor do kit — documentos da onda com 0
   ocorrência (rc=94 re-provado no fim, com a lista estendida).
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG05_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO alimenta
a decisão de RELEASE do dono; a correção nasce em onda própria da campanha.
Exemplos de BLOQUEIO nesta onda: dependência do domínio proibido no
package.json (NOME só na evidência); segredo literal em arquivo com menção
(VALOR NUNCA exibido).
Exemplos de ATENÇÃO: ocorrências do domínio proibido em código fora do
baseline conhecido do MG-02 (next.config.ts e src/middleware.ts); rota de
API com o próprio token no caminho (webhook legítimo pode justificar —
decisão do dono); menções em schema/migrations; menção documental nos
documentos da campanha (proibição documentada é legítima).

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
