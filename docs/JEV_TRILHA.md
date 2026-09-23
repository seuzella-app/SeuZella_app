# JEV — ESTADO CONSOLIDADO DA TRILHA (docs/JEV_TRILHA.md)

> Onda RUN28-A (DOCS) da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION".
> Este documento é a **fotografia canônica** da trilha JEV no estado atual:
> o que foi construído, onde está ancorado, o que foi provado e o que resta.
> Complementos: `docs/JEV_GLOSSARIO.md` (conceitos) e `docs/JEV_OPERACAO.md`
> (manual do pulso). NUNCA push; GitHub congelado até o GREEN final.

## 1. A diretiva em uma página

A diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION" constrói, em ondas
aditivas e auditáveis, a camada de **decisão verificada em shadow** do
SeuZella: um contrato formal, um juiz local, um avaliador remoto opcional, um
ledger de tudo o que foi observado e um chamador de produção no cron — tudo
isso sem nunca tocar o domínio financeiro, sem rede real nos testes, sem ler
banco e sem jamais empurrar nada para o GitHub. Cada onda é um kit
(SZ_JEV_*.zip) publicado no HUB, executado em UM comando no iMac do dono,
auditado pelo agente a partir do log + digest colados de volta, e fechado com
um commit LOCAL que vira âncora da cadeia para a onda seguinte. Se qualquer
gate divergir, o driver recusa com código específico (rc) e nada é modificado.

## 2. As ondas da trilha JEV (todas GREEN no iMac)

| Onda | Nome | O que entregou | Commit LOCAL (âncora) |
|---|---|---|---|
| RUN20-A | JEV RECON | recon read-only: 16/17 alvos, 320 rotas, 586 suítes, 84 chaves env, ZERO_INTEGRATION | (evidência; sem commit de código) |
| RUN21-A | JEV SHAPES | shapes read-only: ProviderRegistration/DEFAULT_PROVIDERS/registerProvider; decision domain 13 arquivos | (evidência; sem commit de código) |
| RUN22-A | ARCH/CONTRACT | 12 arquivos: contrato + adapters + registry kind=DECISION + firewall PII + shadow runner | `c6c07044` |
| RUN23-A | SHADOW HARNESS | corpus v1 28 amostras + `agreementRate` por modo (89,3%) | `7b3f9810` |
| RUN24-A | SHADOW LEDGER | ledger append-only + retenção + idempotência + sinks JSONL + ponte Cérebro | `de734569` |
| RUN25-A | INTEGRAÇÃO TYPESAFE | rate-limit + cooldown 429 + auth M2M + SSRF + fuzz do parser (240 corpos) | `c6275fd8` |
| RUN26-A | FIAÇÃO NO CÉREBRO | fonte real read-only (caps 5 MB / 10.000 linhas) + ciclo shadow de ponta a ponta + shapes-2 extraídas | `371a96cd` |
| RUN27-A | USO REAL NO CRON | rota nova `/api/cron/jev-shadow-pulse` + pulso com os gates da casa (auth/budget/fusível/teto 25s) + SHAPES-3 VERIFY | `5e19649b` |

Antes do JEV: RUN10→RUN19 consolidaram a fundação (camada W2, rotas W2,
red-team, registry de rotas, higiene de rotas) — âncoras RUN12-A a RUN19-A.
A trilha completa tem hoje **14 âncoras de cadeia** verificáveis.

## 3. Âncoras da cadeia (verificadas como ancestrais do HEAD a cada onda)

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
```

O driver de cada onda confere TODAS as âncoras com `git merge-base --is-ancestor`
e hash exato; qualquer desvio => rc=84 e nada é modificado. Este é o mecanismo
que impede que uma onda nasça de um estado divergente do projeto.

## 4. Arquivos de código da trilha (aditivos, com SHA-256 dos dois últimos blocos)

### RUN27-A (USO REAL NO CRON) — instalados e commitados no iMac
| Arquivo | Linhas | SHA-256 |
|---|---|---|
| `src/lib/ai/jev/jev-cerebro-cron-pulse.ts` | 329 | `82e3c015e0e6a07e063475f8b23e6ba4ae1f61faedc63dc8ea34914d37e26298` |
| `src/app/api/cron/jev-shadow-pulse/route.ts` | 45 | `e75adb2a0e477d98cbdd61fe6132ddf6e6dd6680bce9fe63a99d1c6f7c702f6e` |
| `src/__tests__/jev/jev-cron.test.ts` | 502 | `c6adf7b2e1f66245e4792b3d8d7084a80cb168c93a97f9fbafc62e63d5be3538` |

### RUN26-A (FIAÇÃO NO CÉREBRO) — instalados e commitados no iMac
| Arquivo | Linhas | SHA-256 |
|---|---|---|
| `src/lib/ai/jev/jev-cerebro-file-source.ts` | 76 | `451dc6d09e55b46fd25f4f4daa18f84cc3da2291baf49f453aa793af338a7e90` |
| `src/lib/ai/jev/jev-cerebro-shadow-loop.ts` | 222 | `a518e944697b4a7d3d1c9c87207064d391cca2d500a2f9f4556895d42c68fc99` |
| `src/__tests__/jev/jev-wiring.test.ts` | 433 | `e52097371b777690781242e9b58797b690a621cea3c4df3180f059bcd68b95cb` |

### Blocos anteriores (RUN22..RUN25)
`src/domain/decision/**` (contrato, ports, adapters, models, contracts),
`src/lib/ai/jev/jev-{config,provider-registry,pii-firewall,shadow,
harness-samples,agreement,harness,ledger,cerebro-samples,ledger-sink,
remote-rate-limit,integration}.ts` e as suítes
`src/__tests__/jev/jev-{contract,registry,shadow,harness,ledger,integration}.test.ts`
— 26 arquivos verificados pelo driver do RUN27-A como dependência dura (rc=86
se qualquer um faltar). O driver desta onda DOCS verifica 29 arquivos
(RUN22..RUN27).

## 5. As 8 suítes vitest (todas GREEN: 8 passed / 0 failed no iMac)

| Suíte | Onda | O que prova |
|---|---|---|
| `jev-contract.test.ts` | RUN22-A | contrato, firewall, adapter (modos válidos/inválidos, PII) |
| `jev-registry.test.ts` | RUN22-A | kind=DECISION, shadowOnly literal, recusas |
| `jev-shadow.test.ts` | RUN22-A | config + shadow runner + adapter (fetch nunca sem chaves) |
| `jev-harness.test.ts` | RUN23-A | corpus 28 amostras + agreement 89,3% + sem rede por construção |
| `jev-ledger.test.ts` | RUN24-A | ledger, retenção, idempotência, sinks, ponte (5 invariantes) |
| `jev-integration.test.ts` | RUN25-A | rate-limit, M2M, SSRF, fuzz 240, wiring (segurança 19–22) |
| `jev-wiring.test.ts` | RUN26-A | fonte real + ciclo + idempotência + sink (6 invariantes) |
| `jev-cron.test.ts` | RUN27-A | pulso: gates, feliz, exceção tipada, timeout 25s, integração mockada, sonda do fusível, clamp max, fiação da rota (7 invariantes) |

`tsc --noEmit`: 0 erros novos em toda a trilha (residuais conhecidos do
RUN19-A — proxy TS2448/TS2454 e debug-agent TS2345 — documentados e
whitelistados nos drivers).

## 6. Segurança provada — o mapa das 29 provas

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
19. Rate-limit: janela nega acima do teto + cooldown pós-429 + decorator nem
    chama o inner (RUN25-A).
20. Auth M2M: Bearer exato no host liberado, payload minimizado, chave nunca
    em corpo/resposta/erro (RUN25-A).
21. SSRF na fronteira: veredito de bloqueio do guard da casa honrado antes de
    QUALQUER rede (RUN25-A).
22. Fuzz do parser remoto: 240 corpos determinísticos — nunca lança, sempre
    tipado, desvio recusado (RUN25-A).
23. Fonte real read-only: caps de tamanho/linhas; caminhos sujos => null
    (RUN26-A).
24. Ciclo fail-closed: fonte ausente/quebrada => inerte tipado; re-ciclo
    idempotente (RUN26-A).
25. Pulso fail-closed: sem `?src=` => inerte; budget recusado => skip; fusível
    aberto/indisponível => skip (RUN27-A).
26. Auth da rota: `requireInternalSecret` da casa — recusa devolvida INTACTA;
    zero env na produção da onda (RUN27-A).
27. Teto de tempo: ciclo que não termina em 25s é abandonado com reason tipada
    + `recordFailure` no fusível (RUN27-A).
28. Sonda do fusível: qualquer forma divergente do `CircuitBreaker` da casa =>
    gate indisponível => pulso recusado (RUN27-A).
29. Resposta só contagens: zero tenant/payload/segredo no body — scan
    estrutural da serialização (RUN27-A).

## 7. Lições institucionalizadas

- **RUN25-A — nunca presumir shapes da casa**: a 1ª tentativa do RUN25-A
  falhou RED porque um teste presumiu a política interna do guard da casa.
  Corrigido com oráculo + override determinístico. A lição virou GATE
  PERMANENTE no RUN27-A (SHAPES-3 VERIFY, rc=87): assinaturas conferidas nos
  arquivos reais ANTES de instalar. Nesta onda DOCS, o análogo é o CONTENT
  VERIFY (rc=88) sobre os termos obrigatórios dos documentos.
- **rc=93 — o escudo anti-reinstalação**: re-executar o comando de uma onda
  já GREEN é recusado por colisão ("Nada foi modificado"). Provado 3 vezes em
  produção no iMac após o GREEN do RUN26-A — zero dano nas 3.
- **Nome de zip único por revisão** (regra do dono): `SZ_JEV_CRON_V1.zip`,
  agora `SZ_JEV_DOCS_V1.zip` — nunca reutilizar nome com conteúdo diferente;
  o comando único limpa kits antigos de Downloads.
- **Aditividade**: nenhuma onda edita arquivo existente. Tudo é arquivo NOVO
  ou recusa (rc=93). O `vercel.json` NUNCA é editado pela trilha — agendamento
  é decisão do dono.

## 8. Estado atual e o que falta (RETA FINAL)

- Estado: **RUN27-A GREEN auditado** (commit local `5e19649b`, evidência
  `99_AUDITS/JEV_CRON_20260922_234402`, hashes 3/3 1:1 com o kit publicado).
- 8/8 suítes GREEN; tsc 0 erros novos; 7 invariantes do pulso true; segurança
  0/0/0; acendimento ausente (remoto inerte — decisão do dono).
- **Restante da trilha:**
  1. **DOCS** — esta onda (RUN28-A): glossário consolidado + estado da trilha
     + manual de operação, instalados em `docs/` (aditivos).
  2. **MASTER GATE** — a onda final de certificação da fundação; só lá nasce
     a próxima tag.
  3. **VPS** — deploy na Hostinger, sempre depois do MASTER GATE.
- Uso do pulso (export JSONL + `?src=` + agendamento externo + acendimento de
  3 chaves): **decisão do dono**, quando quiser — nada acende sozinho.

## 9. O que a trilha NUNCA faz (compromissos permanentes)

- NUNCA push (GitHub congelado até o GREEN final).
- NUNCA toca domínio financeiro (grep duplo de tokens proibidos em cada onda).
- NUNCA lê valores de chaves — só PRESENÇA de nomes; scrub duplo em todo texto
  de evidência.
- NUNCA lê banco nem varre disco por conta própria — a fonte é sempre o export
  JSONL apontado pelo dono.
- NUNCA chama rede real nos testes — fetch sempre injetado/mocked.
- NUNCA edita arquivo existente nem agenda cron sem o dono.
