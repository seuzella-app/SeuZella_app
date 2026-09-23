# MG06_RELATORIO.md — MG-06 (MASTER GATE FINAL — migration: segurança e reversibilidade em profundidade)

Onda: MG-06 de 9 — sexta onda da campanha **MASTER GATE FINAL**
(pré-RELEASE), sucessora do MG-01 (PostgreSQL/Prisma), do MG-02 (Build), do
MG-03 (CI), do MG-04 (tenant isolation) e do MG-05 (billing). Data de
nascimento da campanha: depois do GREEN do RUN29-A, que selou a fundação JEV
com a tag LOCAL SEUZELLA_JEV_MASTER_CLOSURE_01
(commit fc07fc8fbd7822dda2d186981e21a218a6bfd642 — NUNCA push).

## 1. ESCOPO DA ONDA (leitura pura — READ-ONLY; nenhuma migração executada)

Esta onda é uma varredura forense ESTÁTICA de profundidade sobre as
migrations do projeto (prisma/migrations): ela mede, em contagens e
arquivo:linha, a segurança e a reversibilidade do histórico de migração —
sem executar UMA migração sequer, sem conectar banco (o Prisma não é
invocado), sem rede, sem credenciais. O que a onda examina é o MANIFESTO de
esquema que o banco um dia seguirá: cada operação destrutiva ali é um risco
potencial de irreversibilidade — e cada sinalização construtiva (índices,
constraints, IF EXISTS/IF NOT EXISTS, RLS) é um sinal de integridade.

Examinado pela onda:

- inventário de migrations — contagem de diretórios; NOMES só na evidência
  MG06_MIGR_INVENTORY.txt (conteúdo NUNCA exibido);
- migration_lock.toml — presença (o provedor é NUNCA exibido): AUSENTE é
  ATENÇÃO, porque reversibilidade e execução futura dependem da declaração;
- sinalizações construtivas em contagens — CREATE TABLE, CREATE INDEX,
  CREATE UNIQUE INDEX, CONSTRAINT, IF NOT EXISTS, IF EXISTS (evidência
  MG06_MIGR_SIGNALS.txt);
- operações destrutivas — DROP TABLE, DROP COLUMN, DROP SCHEMA, DROP TYPE,
  DROP DATABASE e TRUNCATE: contagem + arquivo:linha (evidência
  MG06_MIGR_HITS.txt; conteúdo NUNCA exibido) — ATENÇÃO com irreversibilidade
  potencial (revisão do dono antes do RELEASE);
- DELETE FROM — contagem + arquivo:linha: risco de perda de dados em
  re-execução (ATENÇÃO própria);
- ALTER COLUMN ... TYPE — contagem + arquivo:linha: mudança de tipo com
  risco para dados existentes (ATENÇÃO própria);
- RLS/policy em profundidade — arquivo:linha das ocorrências (ROW LEVEL
  SECURITY, CREATE/DROP/ALTER POLICY): aprofundamento do achado do MG-04
  (2 migrations com RLS/policy); nomes de policy NUNCA exibidos;
- migrations vazias (migration.sql com 0 bytes) e diretórios fora do padrão
  de timestamp do Prisma (14 dígitos + _nome) — NOMES só na evidência,
  ATENÇÃO própria (ordenação/manifesto sem efeito);
- segredo literal em migrations — BLOQUEIO com VALOR NUNCA exibido (mover
  para env é decisão do dono antes de qualquer execução).

Não é escopo desta onda: executar qualquer coisa (NUNCA — nenhuma migração
corre, nenhuma consulta é feita), conectar banco, usar rede, ler valor de
variável/secret, editar arquivo existente, varrer o domínio proibido (a
ausência do financeiro já foi verificada pelo MG-05 — nada do financeiro é
varrido aqui), executar build/deploy (MG-07), varrer testes além das 8
suítes JEV (MG-08) ou mexer no wiring (MG-09). A correção de qualquer
achado é 100% decisão do dono — a onda entrega o mapa completo em contagens
e arquivo:linha, e correções nascem em ondas próprias.

## 2. A CADEIA SOBRE A QUAL A ONDA RODA (16 âncoras, hash exato)

A fundação inteira é re-verificada antes de qualquer instalação. O selo da
fundação é EXIGIDO: sem ele, a onda se recusa (rc=98). As ondas anteriores
da campanha também são exigidas: docs/MG01_RELATORIO.md, docs/MG01_ACHADOS.md,
docs/MG02_RELATORIO.md, docs/MG02_ACHADOS.md, docs/MG03_RELATORIO.md,
docs/MG03_ACHADOS.md, docs/MG04_RELATORIO.md, docs/MG04_ACHADOS.md,
docs/MG05_RELATORIO.md e docs/MG05_ACHADOS.md fazem parte das dependências
(rc=86 sem eles).

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

Além das âncoras: 43 arquivos de dependência (32 da fundação RUN22..RUN28
+ o certificado RUN29-A + os 2 documentos do MG-01 + os 2 documentos do
MG-02 + os 2 documentos do MG-03 + os 2 documentos do MG-04 + os 2
documentos do MG-05), SHAPES-3 (9 assinaturas da casa re-conferidas nos
arquivos reais), tsc sem erros novos e as 8 suítes JEV GREEN.

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
- MG-04 — Tenant isolation: middleware, guards, rotas, schema e superfície
  de isolamento (CONCLUÍDA — forense estática READ-ONLY, GREEN; nenhuma
  consulta executada, nenhum dado de tenant lido);
- MG-05 — Billing: ausência do domínio proibido (CONCLUÍDA — contagens e
  arquivo:linha, GREEN; os BLOQUEIOS alimentam a decisão de RELEASE do dono);
- MG-06 — Migration (ESTA ONDA): segurança e reversibilidade em profundidade
  — inventário, migration_lock, sinalizações construtivas, operações
  destrutivas, DELETE FROM, ALTER COLUMN TYPE, RLS em profundidade,
  migrations vazias, convenção de timestamps, segredo literal;
- MG-07 — VPS/deploy: preparação e, se o dono quiser, o next build oficial
  (credenciais e acendimento são 100% do dono);
- MG-08 — Testes: varredura além das 8 suítes JEV;
- MG-09 — Wiring residual: referências mortas, TODOs, pontas soltas.

Fechando MG-01 a MG-09 GREEN: RELEASE.

## 4. ACHADOS DESTA EXECUÇÃO

O relatório canônico (este arquivo) documenta escopo, método, cadeia e
campanha. Os achados da execução vivem em dois lugares:

- docs/MG06_ACHADOS.md — instalado junto com este relatório (aditivo),
  com o resumo BLOQUEIOS / ATENÇÃO / INFO da execução;
- 99_AUDITS/MG06_MIGRATION_<timestamp>/ — evidência completa (findings
  brutos, inventário de migrations, sinalizações, arquivo:linha de
  destrutivas/DELETE/ALTER TYPE/RLS/segredo, content verify, shapes-3, tsc,
  vitest, digest de colagem).

Achados BLOQUEIO/ATENÇÃO não bloqueiam esta onda (a onda forense é GREEN
quando a varredura conclui e a fundação está íntegra): eles ALIMENTAM a
decisão de RELEASE do dono, e cada correção nasce em onda própria, com
rollback fail-closed. Exemplos nesta onda: segredo literal em migrations é
BLOQUEIO (VALOR NUNCA exibido); operação destrutiva, DELETE FROM, ALTER
COLUMN TYPE, migration vazia, diretório fora da convenção de timestamp e
migration_lock ausente são ATENÇÃO para revisão do dono (a reversibilidade
do histórico permanece decisão do dono).

## 5. GARANTIAS DA ONDA

- READ-ONLY: nenhuma escrita além dos 2 documentos aditivos em docs/;
- nenhuma migração executada: a onda Lê os arquivos de migração — o banco
  NUNCA é conectado e o Prisma NUNCA é invocado (sem banco, sem rede);
- contagem: cada operação aparece como CONTAGEM e arquivo:linha na
  evidência — o conteúdo de qualquer linha é NUNCA exibido;
- migration_lock em presença: o provedor é NUNCA exibido (só presença/ausência);
- inventário por NOMES de diretório: o conteúdo dos .sql é NUNCA exibido —
  apenas o que as expressões de varredura casam, em arquivo:linha;
- sem rede: nenhum npm install, nenhum fetch, nenhuma chamada externa;
- sem credenciais: nada é pedido ao dono em momento algum;
- fail-closed: qualquer divergência => nada é instalado/commitado (rollback);
- NUNCA push: commit e evidência apenas locais; GitHub congelado;
- selo intocado: SEUZELLA_JEV_MASTER_CLOSURE_01 permanece apontando para o
  commit do RUN29-A — verificado antes e depois da onda;
- domínio financeiro FORA do escopo: nada do domínio proibido é varrido
  nesta onda (pertence ao MG-05 — só contagens lá);
- valor NUNCA exibido: nem de secret, nem de variável, nem de registro —
  apenas NOMES, contagens e arquivo:linha;
- SHADOW_ONLY preservado: o pulso JEV continua INERTE sem ?src= (decisão do
  dono, documentada em docs/JEV_OPERACAO.md);
- documentos da onda limpos: 0 token proibido e 0 segredo nos 2 documentos
  instalados (rc=94/95 re-provados no fim).

## 6. PRÓXIMO PASSO

MG-07 — VPS/deploy (preparação e, se o dono quiser, o next build oficial —
método próprio da onda; credenciais e acendimento 100% do dono, valores
NUNCA exibidos). O dono dispara no chat ("GO MG-07"); o kit nasce com nome
versionado próprio (SZ_MG07_VPSDEPLOY_V1.zip) e a mesma doutrina: gates,
digest, commit local, NUNCA push.
