# MG01_RELATORIO.md — MG-01 (MASTER GATE FINAL — forense PostgreSQL/Prisma)

Onda: MG-01 de 9 — primeira onda da campanha **MASTER GATE FINAL**
(pré-RELEASE). Data de nascimento da campanha: depois do GREEN do RUN29-A,
que selou a fundação JEV com a tag LOCAL SEUZELLA_JEV_MASTER_CLOSURE_01
(commit fc07fc8fbd7822dda2d186981e21a218a6bfd642 — NUNCA push).

## 1. ESCOPO DA ONDA (leitura pura — READ-ONLY)

Esta onda é uma varredura forense ESTÁTICA do domínio de dados do projeto.
Ela executa-se sobre o filesystem, sem banco, sem rede, sem credenciais e
sem prisma CLI: nenhum comando do Prisma que conecte ou provisione é
invocado. Nenhum valor de variável de ambiente é lido — apenas NOMES de
chaves, conferidos por presença. Onde houver nome de modelo ou de tabela,
a onda imprime CONTAGENS, nunca nomes; onde houver operação potencialmente
destrutiva em migration, a onda imprime apenas arquivo:linha e a palavra-
chave detectada, nunca o conteúdo da linha. O valor de qualquer connection
string é NUNCA exibido — se uma URL literal de rede aparecer no datasource,
o achado registra o risco e a linha, com o valor NUNCA exibido.

Examinado pela onda:

- prisma/schema.prisma — presença; contagens de modelos, enums, @@index e
  @@unique; datasource (provider, url=env() versus literal);
- prisma/migrations — contagem de pastas e arquivos .sql; varredura de
  DROP TABLE, DROP COLUMN, TRUNCATE, ALTER TABLE..DROP e DELETE FROM
  (apenas arquivo:linha — conteúdo NUNCA exibido);
- drift estático — modelo do schema sem CREATE TABLE correspondente nas
  migrations (e tabela sem model), com @@map respeitado (contagens);
- package.json — presença e versão de prisma e @prisma/client;
- .env/.env.local — PRESENÇA de DATABASE_URL, DIRECT_URL e
  SHADOW_DATABASE_URL (valor NUNCA lido).

Não é escopo desta onda: conectar no PostgreSQL, rodar migrate, avaliar
isolamento de tenant em profundidade (MG-04), auditar o domínio de
cobrança (MG-05 — apenas ausência do domínio proibido), analisar
reversibilidade linha a linha (MG-06) ou tocar VPS (MG-07).

## 2. A CADEIA SOBRE A QUAL A ONDA RODA (16 âncoras, hash exato)

A fundação inteira é re-verificada antes de qualquer instalação. O selo da
fundação é EXIGIDO: sem ele, a onda se recusa (rc=98).

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

Além das âncoras: 33 arquivos de dependência (32 da fundação RUN22..RUN28
+ o certificado RUN29-A), SHAPES-3 (9 assinaturas da casa re-conferidas
nos arquivos reais), tsc sem erros novos e as 8 suítes JEV GREEN.

## 3. A CAMPANHA MASTER GATE FINAL (as 9 ondas até o RELEASE)

A campanha materializa a janela de fechamento do dono (estimativa de
esforço, não promessa de prazo; a margem de residuais cobre bloqueadores
que aparecerem). Uma onda por domínio, cada uma com kit próprio, gates
próprios, digest próprio e commit local próprio — NUNCA push:

- MG-01 — PostgreSQL/Prisma (ESTA ONDA): schema, migrations, drift,
  datasource — forense estática READ-ONLY;
- MG-02 — Build: next build limpo, sem erro/warning crítico;
- MG-03 — CI: pipeline e verificações automáticas;
- MG-04 — Tenant isolation: multitenância, guards, isolamento (profundo);
- MG-05 — Billing: SOMENTE checagem de AUSÊNCIA do domínio proibido
  (superfície, sem tokens, sem escrita — a onda própria detalha o método);
- MG-06 — Migration: segurança e reversibilidade em profundidade;
- MG-07 — VPS/deploy: preparação (credenciais e acendimento são 100% do dono);
- MG-08 — Testes: varredura além das 8 suítes JEV;
- MG-09 — Wiring residual: referências mortas, TODOs, pontas soltas.

Fechando MG-01 a MG-09 GREEN: RELEASE.

## 4. ACHADOS DESTA EXECUÇÃO

O relatório canônico (este arquivo) documenta escopo, método, cadeia e
campanha. Os achados da execução vivem em dois lugares:

- docs/MG01_ACHADOS.md — instalado junto com este relatório (aditivo),
  com o resumo BLOQUEIOS / ATENÇÃO / INFO da execução;
- 99_AUDITS/MG01_PRISMA_<timestamp>/ — evidência completa (findings brutos,
  content verify, shapes-3, tsc, vitest, digest de colagem).

Achados BLOQUEIO não bloqueiam esta onda (a onda forense é GREEN quando a
varredura conclui e a fundação está íntegra): eles ALIMENTAM a decisão de
RELEASE do dono, e cada correção nasce em onda própria, com rollback
fail-closed.

## 5. GARANTIAS DA ONDA

- READ-ONLY: nenhuma escrita além dos 2 documentos aditivos em docs/;
- sem banco: nenhuma conexão é aberta — a varredura é estática;
- sem rede: nenhum fetch, nenhuma chamada externa, nenhum prisma CLI;
- sem credenciais: nada é pedido ao dono em momento algum;
- fail-closed: qualquer divergência => nada é instalado/commitado (rollback);
- NUNCA push: commit e evidência apenas locais; GitHub congelado;
- selo intocado: SEUZELLA_JEV_MASTER_CLOSURE_01 permanece apontando para o
  commit do RUN29-A — verificado antes e depois da onda;
- valor NUNCA exibido: nem de connection string, nem de chave de ambiente;
- SHADOW_ONLY preservado: o pulso JEV continua INERTE sem ?src= (decisão do
  dono, documentada em docs/JEV_OPERACAO.md);
- SHAPES-3: as 9 assinaturas da casa re-conferidas nos arquivos reais;
- datasource url=env(): credenciais só por referência de nome — se houver
  URL literal de rede, o achado registra o risco com o valor NUNCA exibido;
- migrations destrutivas: só detectadas e relatadas — nunca executadas;
- domínio financeiro: AUSENTE desta onda (a checagem própria é o MG-05);
- tenant: menções contadas, nomes nunca exibidos (profundidade no MG-04);
- drift: detectado por contagem e relatado — nunca "corrigido" nesta onda.

## 6. PRÓXIMO PASSO

MG-02 — Build forense (next build limpo). O dono dispara no chat ("GO
MG-02"); o kit nasce com nome versionado próprio (SZ_MG02_BUILD_V1.zip) e a
mesma doutrina: gates, digest, commit local, NUNCA push.
