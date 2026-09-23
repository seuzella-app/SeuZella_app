# MG04_RELATORIO.md — MG-04 (MASTER GATE FINAL — forense tenant isolation)

Onda: MG-04 de 9 — quarta onda da campanha **MASTER GATE FINAL**
(pré-RELEASE), sucessora do MG-01 (PostgreSQL/Prisma), do MG-02 (Build) e do
MG-03 (CI). Data de nascimento da campanha: depois do GREEN do RUN29-A, que
selou a fundação JEV com a tag LOCAL SEUZELLA_JEV_MASTER_CLOSURE_01
(commit fc07fc8fbd7822dda2d186981e21a218a6bfd642 — NUNCA push).

## 1. ESCOPO DA ONDA (leitura pura — READ-ONLY)

Esta onda é uma varredura forense ESTÁTICA do domínio de isolamento de
tenant (multitenância) do projeto. Ela examina, por leitura pura do
filesystem, a superfície de isolamento versionada — sem executar consulta
alguma, sem abrir conexão com banco, sem rede e sem credenciais. Nenhum
dado de tenant é lido, nenhum registro é tocado, nenhuma consulta é
executada: a onda inventaria a superfície de isolamento como ela está
versionada, para que a decisão sobre endurecer (ou não) qualquer ponto seja
100% do dono, com mapa completo na mão.

Examinado pela onda:

- src/middleware.ts — a borda do isolamento: presença, contagem de linhas
  com menção a tenant e contagem de linhas com matcher (caminhos NUNCA
  enumerados nesta onda; o conteúdo do arquivo é NUNCA exibido);
- guards da casa — uso por contagem de arquivos em src/:
  requireInternalSecret (auth), tenantBudgetGuard/canUseTier (budget),
  CircuitBreaker (fusível) e guardRequest (wiring) — as definições são
  re-verificadas pelo SHAPES-3 nesta mesma execução;
- menções a tenant em src/ — contagem de arquivos e de menções por arquivo
  (evidência MG04_TENANT_FILES.txt; conteúdo NUNCA exibido);
- prisma/schema.prisma — contagem de modelos e de modelos com campo
  tenantId (NOMES de modelo NUNCA exibidos — apenas contagens);
- prisma/migrations — contagem de arquivos com RLS/policy (ROW LEVEL
  SECURITY / CREATE POLICY — conteúdo NUNCA exibido; a profundidade de
  migrations é a onda MG-06);
- rotas de API (route.ts em src/app/api) — inventário por rota: quais
  guards da casa cada rota importa (evidência MG04_ROUTES_GUARD.txt) e
  contagem de rotas sem import de guard — NOMES de rota ficam na evidência,
  não nos documentos desta onda (conteúdo NUNCA exibido);
- superfície tenant (rotas + middleware) — varredura de segredo literal
  (BLOQUEIO, VALOR NUNCA exibido), de consulta raw ($queryRaw/$executeRaw —
  ATENÇÃO, arquivo:linha na evidência MG04_SURFACE_HITS.txt) e de token de
  domínio proibido (ATENÇÃO, arquivo:linha na evidência; NOMES de arquivo
  que contêm o próprio token ficam retidos dos documentos desta onda).

Não é escopo desta onda: executar consulta ou conectar banco (NUNCA), ler
qualquer valor de variável ou registro, examinar o domínio proibido em
profundidade (MG-05), analisar migrations em profundidade (MG-06), executar
build/deploy (MG-07) ou varrer testes além das 8 suítes JEV (MG-08).

## 2. A CADEIA SOBRE A QUAL A ONDA RODA (16 âncoras, hash exato)

A fundação inteira é re-verificada antes de qualquer instalação. O selo da
fundação é EXIGIDO: sem ele, a onda se recusa (rc=98). As ondas anteriores
da campanha também são exigidas: docs/MG01_RELATORIO.md, docs/MG01_ACHADOS.md,
docs/MG02_RELATORIO.md, docs/MG02_ACHADOS.md, docs/MG03_RELATORIO.md e
docs/MG03_ACHADOS.md fazem parte das dependências (rc=86 sem eles).

- RUN12-A = bede7de39b13d243dcabcb8d8ac0e3b6f9312422
- RUN13-A = 480281d25412db930c5dc2ddc32175cb4c7f4430
- RUN14-A = aff5ca018e5b0986264022142ccff1464b113010
- RUN15-A = 2b53b8e9a2c64bd7b7062b2413a2fef72815bd42
- RUN16-A = 7d7f28f1ad29e1292611b40276c63d17b848f4ea
- RUN17-A = 1828090e2264e21dc4f293988b9ccb8e50b096ce
- RUN18-A = e5eeb65da0e0ccaa69ae12288292d7a9cd59fff1
- RUN19-A = ffa3902b54a50b0adfd0d286ddef8281f5e80327
- RUN22-A = c6c070446381a4ecae6c1cb3a355fcec2c2b9568
- RUN23-A = 7b3f9810163550595bccb58002a1c91845527fe1
- RUN24-A = de7345693dd9c36d69394df20bb8d29a2fe142d5
- RUN25-A = c6275fd887fc93addacac038270c75eedfdaeeb8
- RUN26-A = 371a96cdbd89c4cd0c6a1f13c796b5ad726a3a7e
- RUN27-A = 5e19649b5d5e5293029052cc9dde695fe857c899
- RUN28-A = 6261e3a55a57a9e1379784b2fe26a9e793c1338e
- RUN29-A = fc07fc8fbd7822dda2d186981e21a218a6bfd642 (o selo)

Além das âncoras: 39 arquivos de dependência (32 da fundação RUN22..RUN28
+ o certificado RUN29-A + os 2 documentos do MG-01 + os 2 documentos do
MG-02 + os 2 documentos do MG-03), SHAPES-3 (9 assinaturas da casa
re-conferidas nos arquivos reais), tsc sem erros novos e as 8 suítes JEV
GREEN.

## 3. A CAMPANHA MASTER GATE FINAL (as 9 ondas até o RELEASE)

A campanha materializa a janela de fechamento do dono (estimativa de
esforço, não promessa de prazo; a margem de residuais cobre bloqueadores
que aparecerem). Uma onda por domínio, cada uma com kit próprio, gates
próprios, digest próprio e commit local próprio — NUNCA push:

- MG-01 — PostgreSQL/Prisma: schema, migrations, drift, datasource
  (CONCLUÍDA — forense estática READ-ONLY, GREEN);
- MG-02 — Build: next.config, tsconfig, toolchain, artefatos e superfície de
  build (CONCLUÍDA — forense estática READ-ONLY, GREEN; o next build em si
  é da janela MG-07);
- MG-03 — CI: workflows, triggers, permissions, secrets por NOME e
  vercel.json em só leitura (CONCLUÍDA — forense estática READ-ONLY, GREEN;
  nenhum workflow disparado — GitHub congelado);
- MG-04 — Tenant isolation (ESTA ONDA): middleware, guards, rotas, schema e
  superfície de isolamento — forense estática READ-ONLY;
- MG-05 — Billing: SOMENTE checagem de AUSÊNCIA do domínio proibido
  (superfície, sem tokens, sem escrita — a onda própria detalha o método);
- MG-06 — Migration: segurança e reversibilidade em profundidade;
- MG-07 — VPS/deploy: preparação e, se o dono quiser, o next build oficial
  (credenciais e acendimento são 100% do dono);
- MG-08 — Testes: varredura além das 8 suítes JEV;
- MG-09 — Wiring residual: referências mortas, TODOs, pontas soltas.

Fechando MG-01 a MG-09 GREEN: RELEASE.

## 4. ACHADOS DESTA EXECUÇÃO

O relatório canônico (este arquivo) documenta escopo, método, cadeia e
campanha. Os achados da execução vivem em dois lugares:

- docs/MG04_ACHADOS.md — instalado junto com este relatório (aditivo),
  com o resumo BLOQUEIOS / ATENÇÃO / INFO da execução;
- 99_AUDITS/MG04_TENANT_<timestamp>/ — evidência completa (findings brutos,
  contagens de menções a tenant, inventário de rotas e guards, hits de
  superfície, content verify, shapes-3, tsc, vitest, digest de colagem).

Achados BLOQUEIO não bloqueiam esta onda (a onda forense é GREEN quando a
varredura conclui e a fundação está íntegra): eles ALIMENTAM a decisão de
RELEASE do dono, e cada correção nasce em onda própria, com rollback
fail-closed. Exemplos nesta onda: segredo literal na superfície tenant é
BLOQUEIO (VALOR NUNCA exibido); rota sem guard da casa e consulta raw são
ATENÇÃO para revisão do dono.

## 5. GARANTIAS DA ONDA

- READ-ONLY: nenhuma escrita além dos 2 documentos aditivos em docs/;
- isolamento preservado: nenhuma consulta executada, nenhum dado de tenant
  lido, nenhuma conexão aberta — a varredura é estática sobre o código
  versionado;
- sem banco: nenhuma conexão é aberta — nem direta, nem via ORM;
- sem rede: nenhum npm install, nenhum fetch, nenhuma chamada externa;
- sem credenciais: nada é pedido ao dono em momento algum;
- fail-closed: qualquer divergência => nada é instalado/commitado (rollback);
- NUNCA push: commit e evidência apenas locais; GitHub congelado;
- selo intocado: SEUZELLA_JEV_MASTER_CLOSURE_01 permanece apontando para o
  commit do RUN29-A — verificado antes e depois da onda;
- tenantId apenas em CONTAGEM: o campo é contado no schema e nas menções —
  o conteúdo de qualquer registro ou linha de código é NUNCA exibido;
- middleware em contagem: presença, menções e matchers em contagem —
  caminhos e conteúdo NUNCA enumerados nesta onda;
- guards: apenas contagens de uso e presença por rota — a lógica interna
  dos guards é NUNCA exibida;
- rotas (route.ts): inventário por NOME na evidência — o conteúdo das rotas
  é NUNCA exibido; NOMES de rota com o próprio token proibido ficam retidos
  dos documentos desta onda;
- valor NUNCA exibido: nem de secret, nem de variável, nem de registro —
  apenas NOMES, contagens e arquivo:linha;
- SHADOW_ONLY preservado: o pulso JEV continua INERTE sem ?src= (decisão do
  dono, documentada em docs/JEV_OPERACAO.md);
- domínio financeiro: AUSENTE desta onda (a checagem própria é o MG-05).

## 6. PRÓXIMO PASSO

MG-05 — Billing (checagem de AUSÊNCIA do domínio proibido — método próprio
da onda, valores NUNCA exibidos). O dono dispara no chat ("GO MG-05"); o kit
nasce com nome versionado próprio (SZ_MG05_BILLING_V1.zip) e a mesma
doutrina: gates, digest, commit local, NUNCA push.
