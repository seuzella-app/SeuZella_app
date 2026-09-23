# JEV — CERTIFICADO MASTER DA FUNDAÇÃO (docs/JEV_CERTIFICACAO.md)

> Onda RUN29-A (MASTER GATE) da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION".
> Este documento é o **certificado canônico de fechamento da fundação**: a prova
> consolidada, onda a onda, de que a trilha JEV foi construída, executada,
> auditada e selada no iMac do dono. É também o registro de nascimento da tag
> `SEUZELLA_JEV_MASTER_CLOSURE_01` — a ÚNICA tag nascida nesta trilha depois
> das tags RUN10/RUN11, criada LOCALMENTE (NUNCA push). Depois deste selo, a
> trilha segue para a VPS (decisão do dono, sempre depois do MASTER GATE).

## 1. O que está sendo certificado

A diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION" entregou, em ondas aditivas
e auditáveis, a camada de **decisão verificada em shadow** do SeuZella: um
contrato formal (RUN22-A), um juiz local com corpus medido (RUN23-A), um ledger
append-only (RUN24-A), a integração Typesafe com todas as defesas de fronteira
(RUN25-A), a fiação no Cérebro com fonte real read-only (RUN26-A), o pulso de
produção no cron com os gates da casa (RUN27-A) e a documentação canônica
(RUN28-A). Cada onda nasceu de um kit (SZ_JEV_*.zip) publicado no HUB,
executado em UM comando no iMac, auditada pelo agente a partir do log + digest
colados de volta, e fechada com um commit LOCAL que virou âncora da cadeia.
Nenhuma onda editou arquivo existente; nenhuma tocou o domínio financeiro;
nenhuma leu banco; nenhuma chamou rede real nos testes; nenhuma fez push.

## 2. As âncoras da cadeia — 15 elos provados (ancestrais do HEAD, hash exato)

Cada driver conferiu TODAS as âncoras anteriores com
`git merge-base --is-ancestor` + hash exato antes de modificar qualquer coisa.
Qualquer desvio => rc=84 e nada é modificado.

```
RUN12-A = bede7de39b13d243dcabcb8d8ac0e3b6f9312422
RUN13-A = 480281d25412db930c5dc2ddc32175cb4c7f4430
RUN14-A = aff5ca018e5b0986264022142ccff1464b113010
RUN15-A = 2b53b8e9a2c64bd7b7062b2413a2fef72815bd42
RUN16-A = 7d7f28f1ad29e1292611b40276c63d17b848f4ea
RUN17-A = 1828090e2264e21dc4f293988b9ccb8e50b096ce
RUN18-A = e5eeb65da0e0ccaa69ae12288292d7a9cd59fff1
RUN19-A = ffa3902b54a50b0adfd0d286ddef8281f5e80327
RUN22-A = c6c070446381a4ecae6c1cb3a355fcec2c2b9568
RUN23-A = 7b3f9810163550595bccb58002a1c91845527fe1
RUN24-A = de7345693dd9c36d69394df20bb8d29a2fe142d5
RUN25-A = c6275fd887fc93addacac038270c75eedfdaeeb8
RUN26-A = 371a96cdbd89c4cd0c6a1f13c796b5ad726a3a7e
RUN27-A = 5e19649b5d5e5293029052cc9dde695fe857c899
RUN28-A = 6261e3a55a57a9e1379784b2fe26a9e793c1338e
```

## 3. As ondas certificadas (todas GREEN no iMac, uma a uma)

| Onda | Nome | O que entregou | Âncora |
|---|---|---|---|
| RUN20-A | JEV RECON | recon read-only: 16/17 alvos, 320 rotas, 586 suítes, ZERO_INTEGRATION | evidência |
| RUN21-A | JEV SHAPES | shapes: ProviderRegistration/DEFAULT_PROVIDERS; decision domain 13 arquivos | evidência |
| RUN22-A | ARCH/CONTRACT | 12 arquivos: contrato + adapters + registry kind=DECISION + firewall PII + shadow runner | `c6c07044` |
| RUN23-A | SHADOW HARNESS | corpus v1 28 amostras + agreementRate por modo (89,3%) | `7b3f9810` |
| RUN24-A | SHADOW LEDGER | ledger append-only + retenção + idempotência + sinks JSONL + ponte Cérebro | `de734569` |
| RUN25-A | INTEGRAÇÃO TYPESAFE | rate-limit + cooldown 429 + auth M2M + SSRF + fuzz 240 corpos | `c6275fd8` |
| RUN26-A | FIAÇÃO NO CÉREBRO | fonte real read-only (caps 5 MB / 10.000 linhas) + ciclo shadow de ponta a ponta | `371a96cd` |
| RUN27-A | USO REAL NO CRON | rota `/api/cron/jev-shadow-pulse` + gates da casa + SHAPES-3 VERIFY | `5e19649b` |
| RUN28-A | DOCS | glossário + trilha canônica + manual de operação (34 termos verificados) | `6261e3a5` |

## 4. Arquivos certificados (32, todos aditivos, todos instalados no iMac)

### RUN27-A (USO REAL NO CRON)
| Arquivo | Linhas | SHA-256 |
|---|---|---|
| `src/lib/ai/jev/jev-cerebro-cron-pulse.ts` | 329 | `82e3c015e0e6a07e063475f8b23e6ba4ae1f61faedc63dc8ea34914d37e26298` |
| `src/app/api/cron/jev-shadow-pulse/route.ts` | 45 | `e75adb2a0e477d98cbdd61fe6132ddf6e6dd6680bce9fe63a99d1c6f7c702f6e` |
| `src/__tests__/jev/jev-cron.test.ts` | 502 | `c6adf7b2e1f66245e4792b3d8d7084a80cb168c93a97f9fbafc62e63d5be3538` |

### RUN26-A (FIAÇÃO NO CÉREBRO)
| Arquivo | Linhas | SHA-256 |
|---|---|---|
| `src/lib/ai/jev/jev-cerebro-file-source.ts` | 76 | `451dc6d09e55b46fd25f4f4daa18f84cc3da2291baf49f453aa793af338a7e90` |
| `src/lib/ai/jev/jev-cerebro-shadow-loop.ts` | 222 | `a518e944697b4a7d3d1c9c87207064d391cca2d500a2f9f4556895d42c68fc99` |
| `src/__tests__/jev/jev-wiring.test.ts` | 433 | `e52097371b777690781242e9b58797b690a621cea3c4df3180f059bcd68b95cb` |

### Blocos RUN22..RUN25 (26 arquivos) e RUN28-A (3 documentos)
- `src/domain/decision/**` — contrato, ports, adapters, models, contracts;
- `src/lib/ai/jev/jev-{config,provider-registry,pii-firewall,shadow,
  harness-samples,agreement,harness,ledger,cerebro-samples,ledger-sink,
  remote-rate-limit,integration}.ts`;
- `src/__tests__/jev/jev-{contract,registry,shadow,harness,ledger,
  integration}.test.ts`;
- `docs/JEV_GLOSSARIO.md`, `docs/JEV_TRILHA.md`, `docs/JEV_OPERACAO.md`.

O driver deste MASTER GATE verifica os 32 arquivos como dependência dura
(rc=86 se qualquer um faltar) e re-verifica as 9 assinaturas SHAPES-3 nos
arquivos reais (rc=87 se qualquer uma divergir) — o mesmo padrão que fechou
o RUN27-A, agora como varredura final de certificação.

## 5. As 8 suítes vitest (todas GREEN no iMac)

| Suíte | Onda | O que prova |
|---|---|---|
| `jev-contract.test.ts` | RUN22-A | contrato, firewall, adapter (modos válidos/inválidos, PII) |
| `jev-registry.test.ts` | RUN22-A | kind=DECISION, shadowOnly literal, recusas |
| `jev-shadow.test.ts` | RUN22-A | config + shadow runner + adapter (fetch nunca sem chaves) |
| `jev-harness.test.ts` | RUN23-A | corpus 28 amostras + agreement 89,3% + sem rede por construção |
| `jev-ledger.test.ts` | RUN24-A | ledger, retenção, idempotência, sinks, ponte (5 invariantes) |
| `jev-integration.test.ts` | RUN25-A | rate-limit, M2M, SSRF, fuzz 240, wiring (segurança 19–22) |
| `jev-wiring.test.ts` | RUN26-A | fonte real + ciclo + idempotência + sink (6 invariantes) |
| `jev-cron.test.ts` | RUN27-A | pulso: gates, feliz, exceção tipada, timeout 25s, integração, sonda, clamp, fiação (7 invariantes) |

`tsc --noEmit`: 0 erros novos em toda a trilha (residuais conhecidos do
RUN19-A — proxy TS2448/TS2454 e debug-agent TS2345 — documentados e
whitelistados nos drivers).

## 6. O mapa das 29 provas de segurança (certificadas nesta onda)

1. fetch nunca é chamado sem `JEV_ENABLED=true` E `TYPESAFE_API_KEY` (RUN22-A).
2. Valor da chave nunca aparece na serialização do config (RUN22-A).
3. Tenant ausente/vazio/longo recusado (RUN22-A).
4. Tenant `demo` recusado em produção (RUN22-A).
5. Buffer shadow guarda HASH do tenant — id puro nunca serializado (RUN22-A).
6. Payload nunca serializado no buffer shadow (RUN22-A).
7. Firewall deny-by-default (RUN22-A).
8. PII ofuscada (e-mail/telefone) na fronteira (RUN22-A).
9. kind GENERATIVE recusado no registro (RUN22-A).
10. shadowOnly=false recusado no registro (RUN22-A).
11. shadowOnly literal true em TODA variante de resposta (RUN22-A).
12. Modo inválido recusado em contrato/firewall/adapter (RUN22-A).
13. fetch global NUNCA chamado pelo harness (RUN23-A).
14. Relatório do harness sem tenantId puro (RUN23-A).
15. Relatório do harness sem payload/texto do corpus (RUN23-A).
16. Ledger RECUSA draft com payload — PII nunca persistida (RUN24-A).
17. Idempotência: re-append do mesmo conteúdo não duplica (RUN24-A).
18. Retenção: poda por idade/capacidade com clock injetado (RUN24-A).
19. Rate-limit: janela nega acima do teto + cooldown pós-429 + decorator nem chama o inner (RUN25-A).
20. Auth M2M: Bearer exato no host liberado, payload minimizado, chave nunca em corpo/resposta/erro (RUN25-A).
21. SSRF na fronteira: veredito de bloqueio do guard da casa honrado antes de QUALQUER rede (RUN25-A).
22. Fuzz do parser remoto: 240 corpos determinísticos — nunca lança, sempre tipado (RUN25-A).
23. Fonte real read-only: caps de tamanho/linhas; caminhos sujos => null (RUN26-A).
24. Ciclo fail-closed: fonte ausente/quebrada => inerte tipado; re-ciclo idempotente (RUN26-A).
25. Pulso fail-closed: sem `?src=` => inerte; budget recusado => skip; fusível aberto/indisponível => skip (RUN27-A).
26. Auth da rota: `requireInternalSecret` da casa — recusa devolvida INTACTA (RUN27-A).
27. Teto de tempo: ciclo que não termina em 25s é abandonado com reason tipada + `recordFailure` (RUN27-A).
28. Sonda do fusível: qualquer forma divergente do `CircuitBreaker` da casa => gate indisponível => pulso recusado (RUN27-A).
29. Resposta só contagens: zero tenant/payload/segredo no body (RUN27-A).

## 7. A tag de fechamento — SEUZELLA_JEV_MASTER_CLOSURE_01

Este MASTER GATE é o ÚNICO lugar da trilha onde nasce uma tag depois das tags
RUN10/RUN11: `SEUZELLA_JEV_MASTER_CLOSURE_01`, tag anotada, criada LOCALMENTE
sobre o commit desta onda, com a cadeia completa de 15 âncoras certificada
antes. A tag é o selo de fechamento da fundação — o mesmo padrão das tags
`SEUZELLA_RUN7_MASTER_CLOSURE_01`, `SEUZELLA_RUN8_MASTER_CLOSURE_01` e
`SEUZELLA_RUN9_MASTER_CLOSURE_01` das trilhas anteriores. NUNCA push: a tag
permanece no iMac do dono, como tudo nesta trilha; enviar ao GitHub é decisão
100% manual do dono e não faz parte de nenhum kit.

## 8. Lições institucionalizadas (agora parte da fundação)

- **RUN25-A — nunca presumir shapes da casa**: virou o gate permanente
  SHAPES-3 VERIFY (rc=87, RUN27-A), re-aplicado nesta onda como varredura
  final (9/9 assinaturas nos arquivos reais).
- **rc=93 — o escudo anti-reinstalação**: re-executar comando de onda GREEN é
  recusado por colisão; provado 3 vezes em produção após o RUN26-A.
- **rc=97 — o escudo da tag**: se a tag de fechamento já existe, o MASTER
  GATE se recusa (nada é duplicado, nada é movido).
- **Nome de zip único por revisão** (regra do dono): SZ_JEV_DOCS_V1.zip agora,
  SZ_JEV_MASTERGATE_V1.zip nesta onda — nunca reutilizar nome com conteúdo
  diferente.
- **CONTENT VERIFY (rc=88, RUN28-A)**: a documentação só entra se conferir
  com a realidade da trilha — aplicado aqui aos 40 termos do certificado.
- **Aditividade**: nenhuma onda edita arquivo existente; `vercel.json` NUNCA
  é editado pela trilha (agendamento é decisão do dono).

## 9. O que vem depois do selo — VPS

Fechado o MASTER GATE, a trilha resta em um único passo: **VPS** (deploy na
Hostinger), sempre DEPOIS deste selo e como decisão do dono. O uso do pulso
continua sendo decisão do dono a qualquer momento: export JSONL (regras e
caps 5 MB / 10.000 linhas em `docs/JEV_OPERACAO.md`), chamada com `?src=`,
acendimento das 3 chaves (`TYPESAFE_API_KEY`, `JEV_ENABLED`,
`SSRF_ALLOWLIST`) por presença no `.env.local` e agendamento externo opcional
— nada acende sozinho. Remoto permanece SHADOW_ONLY por construção.

## 10. Compromissos permanentes do certificado

NUNCA push (GitHub congelado; tag local). NUNCA toca domínio financeiro
(grep duplo em toda onda). NUNCA lê valores de chaves — só presença de nomes;
scrub duplo em todo texto de evidência. NUNCA lê banco nem varre disco por
conta própria — a fonte é sempre o export JSONL apontado pelo dono. NUNCA
chama rede real nos testes — fetch sempre injetado/mocked. NUNCA edita
arquivo existente nem agenda cron sem o dono. Estes compromissos valem para
tudo que vier depois: VPS, operação e manutenção.
