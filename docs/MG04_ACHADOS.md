# MG04_ACHADOS.md — achados da varredura forense MG-04 (tenant isolation)

- Onda: MG-04 (MASTER GATE FINAL — campanha pré-RELEASE)
- Modo: READ-ONLY estático — nenhuma consulta executada, sem rede, sem banco,
  sem credenciais (NUNCA push)
- Execução: 20260923_150404
- Escopo: middleware (borda do isolamento), rotas de API + guards da casa
  (uso e ausência), menções a tenant, schema (tenantId em contagem),
  migrations (RLS em contagem), consulta raw — valores NUNCA exibidos

## ACHADOS DA VARREDURA

- [INFO] middleware: presente (src/middleware.ts) — 1 linha(s) com menção a tenant (CONTAGEM — conteúdo NUNCA exibido)
- [INFO] middleware: 1 linha(s) com matcher (contagem — caminhos NUNCA enumerados nesta onda)
- [INFO] guards da casa em uso (contagem de arquivos em src/): requireInternalSecret=7 budget=17 circuit=16 wiring=94 (definições re-verificadas pelo SHAPES-3; conteúdo NUNCA exibido)
- [INFO] menções a tenant em src/: 503 arquivo(s) (contagens por arquivo na evidência MG04_TENANT_FILES.txt — conteúdo NUNCA exibido)
- [INFO] schema: 127 modelo(s), 81 com campo tenantId (NOMES de modelo NUNCA exibidos — contagens)
- [INFO] migrations com RLS/policy: 2 arquivo(s) (contagem — conteúdo NUNCA exibido)
- [INFO] rotas de API: 321 route.ts em src/app/api (guards por rota na evidência MG04_ROUTES_GUARD.txt)
- [INFO] rotas com guard da casa: 95/321 (nomes das rotas e guards detectados apenas na evidência — conteúdo NUNCA exibido)
- **[ATENÇÃO]** 226 rota(s) de API sem import de guard da casa (NOMES na evidência MG04_ROUTES_GUARD.txt; conteúdo NUNCA exibido): superfície para revisão do dono antes do RELEASE — webhooks com assinatura própria podem ser legítimos
- [INFO] superfície tenant (rotas + middleware): 0 padrão de segredo literal
- **[ATENÇÃO]** consulta raw ($queryRaw/$executeRaw) na superfície tenant: 17 ocorrência(s) — arquivo:linha na evidência MG04_SURFACE_HITS.txt (conteúdo NUNCA exibido): verificar escopo por tenant
- **[ATENÇÃO]** token de domínio proibido na superfície tenant: 80 ocorrência(s) — arquivo:linha na evidência MG04_SURFACE_HITS.txt (conteúdo NUNCA exibido; NOMES de arquivo que contêm o próprio token ficam retidos dos documentos desta onda; profundidade no MG-05)
- [INFO] isolamento: nenhuma consulta executada, nenhum dado de tenant lido nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas
- [INFO] BLOQUEIOS=0 ATENÇÃO=3 INFO=10

## RESUMO

- BLOQUEIOS: 0
- ATENÇÃO: 3
- INFO: 10

## LEITURA

Achados BLOQUEIO não bloqueiam esta onda (a onda forense é GREEN quando a
varredura conclui e a fundação está íntegra): eles ALIMENTAM a decisão de
RELEASE do dono. Correções nascem em ondas próprias da campanha
MASTER GATE FINAL (fail-closed, NUNCA push).

## PRÓXIMO PASSO

MG-05 — Billing (checagem de AUSÊNCIA do domínio proibido — método próprio da
onda, valores NUNCA exibidos).
