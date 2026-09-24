# MG04_TENANT.md — método da onda MG-04 (MASTER GATE FINAL — forense tenant isolation)

## O que é

MG-04 é a 4ª onda da campanha MASTER GATE FINAL (pré-RELEASE), sucessora do
MG-01 (PostgreSQL/Prisma), do MG-02 (Build) e do MG-03 (CI). O domínio é o
isolamento de tenant (multitenância), examinado por varredura forense
ESTÁTICA e READ-ONLY: nenhuma consulta é executada, nenhum dado de tenant é
lido, nada conecta em banco, nada usa rede, nada escreve além de 2
documentos aditivos em docs/ (MG04_RELATORIO.md, do payload verbatim, e
MG04_ACHADOS.md, gerado pela execução). A onda só corre sobre a fundação
SELADA — a tag SEUZELLA_JEV_MASTER_CLOSURE_01 precisa existir, ser anotada e
apontar para o commit do RUN29-A (rc=98 se não) — e sobre as ondas
anteriores da campanha (MG-01, MG-02 e MG-03 fechados: docs/MG01_*,
docs/MG02_* e docs/MG03_* são dependências, rc=86).

## Ordem dos gates

1. GATES: branch, tags RUN10/RUN11, EXIGÊNCIA DO SELO (rc=98), 16 âncoras
   ancestrais por hash exato (rc=84), W2 7/7 + infra IA crítica (rc=90),
   39 dependências (rc=86), árvore limpa (rc=85), manifestos do kit e do
   payload (rc=92), node/npx.
2. FORENSE ESTÁTICA TENANT ISOLATION (read-only): middleware (presença,
   menções a tenant em contagem, matchers em contagem — conteúdo NUNCA
   exibido), guards da casa por contagem de arquivos (requireInternalSecret,
   tenantBudgetGuard/canUseTier, CircuitBreaker, guardRequest), menções a
   tenant em src/ (contagens por arquivo), schema (modelos e modelos com
   tenantId em contagem — NOMES NUNCA exibidos), migrations (RLS/policy em
   contagem), rotas de API (inventário de guards por rota; rotas sem guard
   = ATENÇÃO), superfície tenant (segredo literal = BLOQUEIO com VALOR
   NUNCA exibido; consulta raw e token proibido = ATENÇÃO com arquivo:linha
   na evidência — conteúdo NUNCA exibido).
3. CONTENT VERIFY 40/40 no relatório do payload (rc=88).
4. SHAPES-3 RE-VERIFY 9/9 nos arquivos reais (rc=87).
5. COLISÃO rc=93 (re-execução => recusa).
6. INSTALAÇÃO 2/2 aditiva + CONTENT RE-VERIFY 28/28 (20 relatório +
   8 achados) => rollback rc=1 se divergir.
7. TSC (whitelist RUN19-A) + VITEST 8 suítes => RED/rollback rc=1.
8. Acendimento por presença (3 chaves — valores NUNCA lidos).
9. Segurança grep duplo (rc=94/95) nos 2 documentos instalados.
10. COMMIT LOCAL (2 arquivos) + re-checagem do selo intocado.
11. MOTOR: evidência + MG04_PASTE_BACK_DIGEST.txt (cópia em ~/Downloads).

## Semântica dos achados

BLOQUEIO / ATENÇÃO / INFO são ACHADOS, não vereditos da onda: a onda é
GREEN quando a varredura conclui com a fundação íntegra. BLOQUEIO alimenta
a decisão de RELEASE do dono; a correção nasce em onda própria da campanha.
Exemplos de BLOQUEIO nesta onda: segredo literal na superfície tenant
(VALOR NUNCA exibido).
Exemplos de ATENÇÃO: middleware ausente; rota de API sem import de guard da
casa (webhooks com assinatura própria podem ser legítimos); consulta raw
($queryRaw/$executeRaw) sem análise de escopo; token de domínio proibido na
superfície tenant (conteúdo NUNCA exibido; profundidade no MG-05).

## Códigos

rc=0 GREEN | rc=83 tag RUN10/RUN11 | rc=84 âncora | rc=85 árvore suja |
rc=86 dependência | rc=87 shapes | rc=88 content | rc=90 infra | rc=92
payload | rc=93 colisão | rc=94 token proibido | rc=95 segredo/env |
rc=96 motor | rc=98 selo ausente/divergente | rc=1 RED (rollback).
