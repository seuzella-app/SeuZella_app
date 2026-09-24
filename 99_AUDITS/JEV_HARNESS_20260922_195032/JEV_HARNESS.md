# JEV_HARNESS — RUN23-A (JEV MASTER: SHADOW HARNESS, SHADOW_ONLY)

## O que esta onda entrega

A onda ARCH/CONTRACT (RUN22-A) criou o **caminho de decisão** (contrato ->
firewall -> adapter local -> runner shadow em memória). Esta onda o **mede**:
um corpus rotulado v1 com 28 amostras (4 por modo x 7 modos) roda PELO runner
shadow — exatamente o mesmo caminho que produção usará — e um motor de
agreement compara cada resposta do baseline local ($0) com um **ground truth
independente**, produzindo o `agreementRate` POR MODO.

Esta é a evidência que a diretiva pedia para decidir **ONDE** o decision
provider remoto (Jev/TypeSafe) vale o custo: os modos onde o baseline erra
são os candidatos naturais para o degrau remoto; os modos onde ele acerta
quase tudo podem permanecer heurísticos por muito mais tempo.

## Método (e por que a métrica é honesta)

1. **Ground truth independente**: os rótulos do corpus foram atribuídos de
   forma independente da heurística (como um conjunto de rotulação humano). Se
   o corpus concordasse 100% com o código por construção, a métrica não
   mediria nada — por isso as divergências são o PRODUTO da onda, não um bug.
2. **Caminho real de produção**: cada amostra entra como envelope bruto no
   `JevShadowRunner.evaluate()`, passando por validação do contrato e pelo
   firewall de PII (allowlist por modo) antes de chegar ao adapter — igual ao
   que um chamador real faria.
3. **Métrica única e explícita**:
   `agreementRate = matches / (matches + mismatches)` — conta apenas amostras
   decididas (status ok). Amostras rejected/unavailable ficam fora do
   denominador e são reportadas à parte, para indisponibilidade nunca inflar
   nem esconder qualidade.
4. **Determinismo**: mesma entrada -> mesmo agreement. Latência e timestamps
   não entram no relatório; duas execuções produzem agregação idêntica
   (provado em teste).

## Corpus v1 (28 amostras, append-only)

| Modo | Amostras | Cobre | Divergências esperadas |
|---|---|---|---|
| INTENT | 4 | RESERVA / CANCELAMENTO / PRECO_INFO / OUTRO | INT-002 (ordem de keywords) |
| SENTIMENT | 4 | POSITIVO / NEGATIVO / NEUTRO / misto | — |
| CHURN | 4 | ALTO / MEDIO / BAIXO + fronteira | CHU-004 (fronteira 0.75) |
| LEAD | 4 | qualificado / não / solo | LEA-003 (lead solo) |
| ANOMALY | 4 | CRITICA / ALTA / MEDIA / NORMAL | — |
| OCCUPANCY | 4 | alta / média / baixa + fronteira | — |
| UPSELL | 4 | oferecer / não oferecer | — |

Regras do corpus (invariantes, provadas em teste):
- **Nenhum dado real de cliente**: textos sintéticos, sem e-mail, sem
  telefone, sem nome de pessoa;
- tenantId sintético (`tenant-harness-*`, nunca 'demo');
- extensão **append-only**: novas amostras entram com bump de versão do
  corpus (`jev-harness-corpus-v1` -> v2), rótulo antigo nunca é reescrito;
- campos só das allowlists do firewall (honestidade com a produção).

## Invariantes SHADOW_ONLY provadas nesta onda

- `remotePortUsed = false`: o runner do harness é construído com
  `remotePort: null` — o caminho remoto é **estruturalmente inexistente**
  (não depende de env, flag ou chave). O teste espiando `fetch` global prova
  que nenhuma rede é tocada.
- `shadowOnlyAllTrue = true`: toda resposta do baseline carrega o literal
  `shadowOnly: true` (garantia do sistema de tipos da onda ARCH).
- `tenantHashOnly = true` / `payloadNotSerialized = true`: o relatório não
  contém tenantId puro nem texto de payload — provado sobre a própria
  serialização do relatório dentro do teste.
- Nada persiste: o runner do harness é isolado por execução; o singleton
  `jevShadow` da casa não é tocado; o ledger persistido é a onda seguinte.

## Relatório (JEV_HARNESS_REPORT.json)

Escrito pelo SUITE de testes quando o driver define
`JEV_HARNESS_EVIDENCE_DIR` (mesma rodada do vitest que gateia o GREEN — fonte
única). Shape: `wave`, `corpusVersion`, `totalSamples`, `agreement` (global +
por modo + divergências), `remoteAgreementRate: null` (acende na integração) e
`invariants`. O driver valida o JSON (shape, contagens coerentes, >= 7
amostras, invariants todos true) antes de autorizar o commit.

## Segurança

- 0 tokens de domínio proibido; 0 padrões de segredo (grep duplo do driver);
- sem env, sem chave, sem rede nesta onda;
- commit LOCAL único (NUNCA push); rollback RED remove os 4 arquivos;
- evidência em `99_AUDITS/JEV_HARNESS_<ts>/` (nunca sobrescrita).

## Próxima onda

**LEDGER** — persistência apend-only das entradas shadow + exportação de
amostras reais do Cérebro (com retenção e dedup). Depois: integração TypeSafe
(chave no .env.local do iMac, +security tests), fiação no Cérebro, DOCS,
MASTER GATE, VPS.
