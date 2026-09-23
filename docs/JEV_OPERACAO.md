# JEV — MANUAL DE OPERAÇÃO DO PULSO (docs/JEV_OPERACAO.md)

> Onda RUN28-A (DOCS) da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION".
> Este manual explica COMO USAR o pulso shadow instalado pelo RUN27-A
> (`/api/cron/jev-shadow-pulse`) — sempre como **decisão do dono**. Nada roda
> sem opt-in: sem `?src=`, o pulso é INERTE por construção. Conceitos em
> `docs/JEV_GLOSSARIO.md`; histórico e âncoras em `docs/JEV_TRILHA.md`.

## 0. Regra de ouro

O kit da trilha NUNCA procura, lê ou envia dados por conta própria. O dono
decide: gera um export JSONL, aponta o arquivo com `?src=`, e chama a rota
autenticada. Sem esses passos, o pulso responde inerte e NADA é lido,
avaliado ou registrado. Agendamento externo (`vercel.json` ou cron externo)
também NÃO é editado pela trilha — é decisão do dono, com a autenticação da
casa.

## 1. Visão rápida do fluxo

```
export JSONL (você gera)  ──►  ?src=<caminho absoluto>  ──►  rota autenticada
        │                            │                            │
        │                            │                            ├─ auth da casa (internal-secret)
        │                            │                            ├─ gate 1: ?src= ausente => INERTE
        │                            │                            ├─ gate 2: fonte recusada => INERTE
        │                            │                            ├─ gate 3: budget recusado => SKIP
        │                            │                            ├─ gate 4: fusível aberto/indisponível => SKIP
        │                            │                            └─ gate 5: ciclo com teto de 25s
        ▼                            ▼                            ▼
   1 amostra/linha            caps 5 MB / 10.000 linhas      resposta SÓ com contagens
```

## 2. Passo 1 — gerar o export JSONL (decisão do dono)

Uma amostra por linha, JSON por linha:

```
{"tenantId":"seu-tenant","mode":"INTENT","text":"texto real do cliente"}
{"tenantId":"seu-tenant","mode":"SENTIMENT","payload":{"text":"..."}}
```

Regras que a fonte e o firewall aplicam (recusa, nunca silêncio):

| Regra | Efeito |
|---|---|
| Tenant `demo` | RECUSADO em produção |
| Modo fora dos 7 do contrato | RECUSADO (a lista canônica está em `JevDecisionContract.ts`) |
| Campos fora da allowlist do firewall | DESCARTADOS (deny-by-default) |
| E-mail/telefone no texto | OFUSCADOS na fronteira |
| Amostra que sobra vazia após o firewall | RECUSADA |
| Arquivo maior que 5 MB | EXCEDE O CAP (recusado) |
| Arquivo com mais de 10.000 linhas | EXCEDE O CAP (recusado por ciclo) |

Dica operacional: gere exports pequenos primeiro (dezenas de linhas) para
validar o formato, depois escale dentro dos caps. O `tenantId` é seu
identificador real — lembre que só o SEU HASH sai do processo (o valor puro
nunca aparece em ledger, relatório ou resposta).

## 3. Passo 2 — chamar a rota (com o servidor da casa rodando)

Endpoint NOVO instalado pelo RUN27-A (rota aditiva; as rotas irmãs não mudam):

```
/api/cron/jev-shadow-pulse?src=<CAMINHO-ABSOLUTO-DO-ARQUIVO.jsonl>
```

- Parâmetro obrigatório: `src` — caminho absoluto do export JSONL.
- Parâmetro opcional: `max` — inteiro `1..500`, default `50` (quantidade
  máxima de amostras avaliadas no ciclo; valores acima de 500 são limitados a
  500; lixo é interpretado como o default).
- Autenticação: o mecanismo interno da casa (`internal-secret`, RUN19-A). O
  kit NUNCA lê nem exibe valores de chave; a recusa da auth da casa é
  devolvida INTACTA (a casa decide a resposta).

Sem `src`, a resposta é inerte com razão `fonte-nao-indicada`. Com `src`
inválido/ilegível, inerte com razão `fonte-ausente`. Nos dois casos NADA é
processado.

## 4. Passo 3 — ler a resposta (só contagens)

O corpo contém apenas contagens e razões tipadas — zero payload, zero tenant
real, zero segredo:

| Campo | Significado |
|---|---|
| `status` | `ran` (executou), `inerte` (fonte não indicada/ausente) ou `skip` (budget/fusível) |
| `lidas` | linhas lidas do export dentro dos caps |
| `aceitas` / `recusas` | amostras aceitas após firewall / recusadas (com razões agregadas) |
| `avaliadas` | amostras efetivamente avaliadas (até `max`) |
| `acordos` / `divergências` | direção local × remoto (quando o remoto está aceso) |
| `ledger` | entradas apendadas neste ciclo (idempotência por `contentHash`) |

Casos especiais já provados pela suíte `jev-cron.test.ts`:

- **Exceção do ciclo** => http 500 com razão tipada `excecao-no-ciclo`, SEM
  stack/message do erro (nada vaza).
- **Ciclo lento demais** => abandonado no teto de 25s com razão
  `ciclo-timeout` + `recordFailure` no fusível (o teto é menor que o
  `maxDuration = 60` da rota).
- **Fusível aberto** => `skip` com `breaker-aberto`; **fusível indisponível**
  (forma divergente na casa) => `skip` com `breaker-indisponivel` (sonda
  fail-closed).
- **Budget recusado** => `skip` com `budget-indisponivel`.
- Re-processar o MESMO export não duplica ledger (idempotência).

## 5. Agendamento externo (opcional — decisão do dono)

A trilha NÃO edita `vercel.json` nem cria cron. Se o dono quiser agendar:

1. Defina o agendamento no mecanismo da casa (ex.: cron do `vercel.json` ou
   agendador externo) apontando para a rota — sempre autenticado pelo
   mecanismo interno da casa.
2. Lembre dos caps: cada ciclo lê no máximo 5 MB / 10.000 linhas e avalia até
   `max` amostras; o idempotente por `contentHash` protege contra janelas
   sobrepostas sobre o mesmo arquivo.
3. O fusível e o budget da casa continuam valendo a cada chamada — se a casa
   estiver degradada, o pulso dá skip e tenta de novo na próxima janela.

## 6. Acendimento remoto (3 chaves — presença, nunca valores)

O remoto do JEV só acende com as 3 chaves definidas pelo DONO no `.env.local`:

| Chave | Efeito quando PRESENTE |
|---|---|
| `TYPESAFE_API_KEY` | credencial do remote port (o valor NUNCA é lido/exibido pelos kits) |
| `JEV_ENABLED=true` | liga o caminho remoto (sem isso, fetch nunca é chamado) |
| `SSRF_ALLOWLIST` | host do endpoint liberado na fronteira SSRF da casa |

Combinações:

- **0 chaves** (estado atual no iMac): remoto INERTE — heurística local decide
  em shadow; nada quebra; os testes e o pulso funcionam normalmente (acordos/
  divergências exigem remoto aceso; sem remoto, só avaliação local é
  registrada).
- **3 chaves + host correto**: o remote port PROTEGIDO acende no próximo
  start; as avaliações passam a ter contraparte remota (rate-limit, auth M2M,
  SSRF e fuzz continuam valendo).

Para conferir o estado SEM expor valores: rode a onda mais recente e veja a
seção "ESTADO DO ACENDIMENTO" do log/digest — ela mostra só PRESENTE/AUSENTE.

## 7. Defesas em camadas (resumo)

| Camada | Defesa | Onda |
|---|---|---|
| 1. Entrada | caps 5 MB / 10.000 linhas; caminho sujo => null | RUN26-A |
| 2. Privacidade | firewall deny-by-default; ofuscação; vazio => recusa | RUN22-A |
| 3. Orçamento | `tenantBudgetGuard.canUseTier` (chave sintética, custo 0) | RUN27-A |
| 4. Estabilidade | fusível da casa por sonda fail-closed | RUN27-A |
| 5. Tempo | teto de 25s com `recordFailure` | RUN27-A |
| 6. Tráfego | rate-limit + cooldown 429 (endpoint remoto) | RUN25-A |
| 7. Fronteira de rede | auth M2M + SSRF guard da casa | RUN25-A |
| 8. Persistência | ledger só hashes + idempotência + retenção | RUN24-A |

## 8. Solução de problemas

**A rota responde inerte (`fonte-nao-indicada`).** Normal sem `?src=` —
aponte o export JSONL do dono.

**Inerte (`fonte-ausente`).** O caminho em `?src=` não existe/ilegível —
confira o caminho absoluto e permissões de leitura.

**`skip` com `budget-indisponivel`.** O budget da casa recusou o tier —
verifique os limites do budget guard; o pulso não força.

**`skip` com `breaker-aberto`/`breaker-indisponivel`.** Fusível da casa aberto
ou forma divergente — a casa se protege; tente novamente após a janela de
reset do fusível.

**http 500 `excecao-no-ciclo` / `ciclo-timeout`.** O ciclo lançou ou passou de
25s. Confira o tamanho do export (reduza `max`) e o estado do servidor; o
fusível registrou a falha (`recordFailure`).

**Driver recusou o kit (rc).** Tabela rápida: 83 tag ausente; 84 âncora não
ancestral; 85 árvore suja; 86 dependência de onda anterior ausente; 88
conteúdo obrigatório divergiu (DOCS); 90 infra crítica divergiu; 92 payload
divergiu do manifesto; 93 colisão (re-execução após GREEN — é o escudo, não
erro); 94/95 segurança; 96 motor; 1 RED com rollback. Cole o log inteiro no
chat para auditoria — nenhuma execução modifica o projeto fora do fluxo
aditivo.

**Re-executei o comando de uma onda fechada.** rc=93 "Nada foi modificado" —
comportamento projetado (provado 3 vezes no iMac). Use o comando da onda
atual no HUB.

## 9. Checklist de primeira operação (quando o dono decidir)

1. Gerar export JSONL pequeno (10–50 linhas) com tenants reais (nunca `demo`).
2. Servidor da casa rodando; conferir as 3 chaves se quiser avaliação remota
   (ou rodar só local, que funciona sem chaves).
3. Chamar `/api/cron/jev-shadow-pulse?src=...&max=10` e ler as contagens.
4. Conferir o ledger (contagens) e, se configurado, o sink opt-in.
5. Repetir com exports maiores dentro dos caps; agendar só depois de
   confortável.
6. Em qualquer dúvida: colar o log/digest no chat para auditoria do agente.
