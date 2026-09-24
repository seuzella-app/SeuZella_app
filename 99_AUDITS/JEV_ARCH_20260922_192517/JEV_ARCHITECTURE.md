# JEV_ARCHITECTURE.md — RUN22-A (JEV MASTER: ARCH/CONTRACT, SHADOW_ONLY)

Gerado: 2026-09-22 | Onda: RUN22-A | Cadeia: âncora RUN19-A = ffa3902b54a50b0adfd0d286ddef8281f5e80327
Diretriz: "SEU ZÉLLA — JEV MASTER IMPLEMENTATION" | Status: SHADOW_ONLY (invariante de tipos)

---

## 1. Escopo desta onda

Contrato de decisão JEV (request/response tipado), porta hexagonal, dois
adapters (heurística local determinística $0 + TypeSafe remoto INATIVO),
registro de providers kind=DECISION (extensão aditiva do ProviderRegistration
do zaos), firewall de privacidade deny-by-default, runner SHADOW_ONLY em
memória e suíte de testes. **Nenhum arquivo existente foi editado** — 12
arquivos novos, todos aditivos. Nenhum fluxo de produção é afetado: nenhum
módulo existente importa JEV (a fiação em pontos de chamada é onda futura,
com as formas exatas já extraídas pelo SHAPES RUN21-A).

## 2. Insumos usados (evidência, não adivinhação)

- RECON RUN20-A: 16/17 alvos, ZERO_INTEGRATION, ProviderAdapter NOT_FOUND
  (slot de adapter vazio — esta onda o preenche), convenção providerId.
- SHAPES RUN21-A: bloco EXATO de ProviderRegistration (23 linhas, L156 do
  zaos-neuro-router.ts), DEFAULT_PROVIDERS (L194), registerProvider (L1039),
  sem typing de kind; árvore de src/domain/decision (13 arquivos);
  AdapterResponse do llm-adapters (L6); exports de budget-guard, circuit-
  breaker, llm-timeout, cost-logger, pii-guard, tier-distributor; infra
  (internal-secret, ssrf-guard, wiring); convenção de env (process.env
  direto); amostra de chamada (cron cerebro-analyze com M2M fail-closed e
  budget cap); middleware (39 linhas).

## 3. O que é o TypeSafe/Jev (pesquisa de mercado, 2026-09-22)

Levantamento público (site typesafe.ai + cobertura de ecossistema):
- TypeSafe AI (lab em SF) constrói "System One Models": modelos NATIVOS PARA
  MÁQUINAS, ao contrário dos LLMs de chat (System Two, RLHF). Treino próprio:
  RLCD — Reinforcement Learning for Calibrated Decisions.
- **Jev** retorna DECISÕES TIPADAS (choice/score/yes-no) com CONFIANÇA
  CALIBRADA — não escreve texto. "A judgment a knowledgeable person makes in
  a second given the right context".
- Números divulgados pelo fabricante/ecossistema (a validar na nossa shadow):
  até ~200x mais rápido (site exibe 193.6x) e ~400x mais barato que LLMs
  comparáveis em tarefas de classificação; ecossistema (LiteLLM, OpenRouter,
  Vercel AI Gateway, Cloudflare, Netlify) integrou em dias.
- SDK oficial TypeScript: `@typesafe-ai/sdk`; também acessível por endpoints
  compatíveis/agregadores. Formato exato do endpoint será confirmado com a
  conta do dono na onda de integração (anti-FIADO).
- Coerência com a diretiva: Jev é um DECISION PROVIDER — exatamente o papel
  kind=DECISION desta arquitetura. O modelo "não alucina" porque não gera
  texto; a calibração de confiança é cidadã de primeira classe — o que o
  contrato JEV captura (confidence em [0,1] + limiar).

## 4. Arquitetura (caminhos das decisões no Cérebro Zélla)

```
                        ┌─────────────────────────────────────────────┐
                        │                 CÉREBRO ZÉLLA               │
                        │  (rotas cron, whatsapp, campanhas, ddc)     │
                        └───────────────┬─────────────────────────────┘
                                        |  (onda futura: pontos de chamada)
                                        v
   ┌────────────────────────────────────────────────────────────────────────┐
   │ JEV SHADOW RUNNER (src/lib/ai/jev/jev-shadow.ts) — IN-MEMORY, sem banco │
   │                                                                        │
   │  envelope bruto ──> CONTRATO (valida requestId/tenant/mode/ocurredAt)  │
   │        | recusa ──> rejected (razão estável)                           │
   │        v                                                               │
   │  FIREWALL PII (allowlist por modo, deny-by-default, trunc+redact)      │
   │        v                                                               │
   │  ┌─────────────────────┐        ┌──────────────────────────────┐       │
   │  | ADAPTER LOCAL ($0)  |        | ADAPTER TYPESAFE (INATIVO)   |       │
   │  | heurística determ.  |        | JEV_ENABLED=true + API_KEY +  |       │
   │  | sempre decide       |        | ssrfGuard + timeout + retry   |       │
   │  └─────────┬───────────┘        └────────────┬─────────────────┘       │
   │            v                                 v                         │
   │  buffer shadow (cap 500): {tenantHash, mode, local, remote, agreement} │
   │  stats: agreementRate por modo  ──> insumo do eval harness (onda futura)│
   └────────────────────────────────────────────────────────────────────────┘
                                        |
                                        v (reuso, mesmas instâncias da casa)
   zaos-neuro-router (registry canônico) │ circuit-breaker │ budget-guard
   (ProviderRegistration estendido aqui, sem editar o zaos)
```

Reuso SEM router paralelo (diretriz): o zaos continua sendo o único roteador;
o registro JEV é catálogo de DECISORES (extensão de ProviderRegistration);
circuit-breaker/budget-guard serão ligados no adapter remoto na onda de
integração usando os blocos exatos do SHAPES (assini L60 do BudgetGuard,
L46 do CircuitBreaker).

## 5. Os 7 modos e onde cada decisão vive no Cérebro

| Modo | Sinal hoje na casa | Caminho de decisão futuro (onda de fiação) |
|------|--------------------|---------------------------------------------|
| INTENT | tf-client USE_TF_INTENT; intent-router | triagem de mensagens WhatsApp antes de gastar LLM |
| SENTIMENT | USE_TF_SENTIMENT | priorização de atendimento/alertas do Cérebro |
| CHURN | sinais de CRM/reservas | retenção: quem o Cérebro acorda primeiro |
| LEAD | formulários/whatsapp | qualificação barata antes de campanha |
| ANOMALY | cerebro/anomaly-detector | triagem 2ª camada das anomalias do cron 15min |
| OCCUPANCY | USE_TF_OCCUPANCY | gating de alertas/previsões de ocupação |
| UPSELL | USE_TF_UPSELL | ofertas no DDC (jamais toca cobrança) |

PRICE deliberadamente EXCLUÍDO do v1 (domínio de cobrança proibido pela
diretriz). Cada modo tem allowlist de campos própria no firewall.

## 6. Contrato (resumo operacional)

- Entrada: `{ requestId, tenantId, mode, payload, occurredAt }` — tenant
  OBRIGATÓRIO (isolamento server-side; 'demo' recusado em produção, regra da
  casa); requestId na regex do middleware; occurredAt ISO.
- Saída (união discriminada, TODAS com `shadowOnly: true` LITERAL):
  - `ok` { source, decision: { label, confidence[0..1], rationale? } }
  - `unavailable` { reason: JEV_DISABLED | JEV_KEY_MISSING | JEV_SHADOW_REQUIRED
    | JEV_TIMEOUT | JEV_SSRF_BLOCKED | JEV_REMOTE_ERROR | JEV_INVALID_RESPONSE }
  - `rejected` { reason: JEV_* } — contrato/firewall recusou a entrada.
- Nunca lança: qualquer exceção vira resultado tipado. O chamador nunca quebra.

## 7. Registro kind=DECISION

`JevProviderRegistration extends ProviderRegistration` (zaos) + kind + modes +
shadowOnly + active. `registerProvider` espelha a convenção do zaos (L1039) e
é fail-closed: recusa GENERATIVE, recusa shadowOnly=false, duplicados, tier
fora de 1..3, custos negativos, latência <= 0, modos inválidos. Defaults:
`jev-local-heuristic` (tier 1, custo 0, ativo) e `jev-typesafe` (tier 2,
baseUrl api.typesafe.ai, INATIVO até onda de integração).

## 8. Matriz fail-closed desta onda

| Condição | Comportamento |
|---|---|
| Sem TYPESAFE_API_KEY | remoto: `unavailable JEV_KEY_MISSING`; fetch nunca é chamado |
| JEV_ENABLED != 'true' | remoto: `unavailable JEV_DISABLED`; fetch nunca é chamado |
| JEV_SHADOW_MODE='false' | IGNORADO — shadow é invariante (tipo literal + guard) |
| Host fora da allowlist SSRF | `unavailable JEV_SSRF_BLOCKED` (guard da casa) |
| Resposta remota em desvio do formato | `unavailable JEV_INVALID_RESPONSE` (nada é adivinhado) |
| Timeout | `unavailable JEV_TIMEOUT` (AbortController, JEV_TIMEOUT_MS) |
| Envelope inválido | `rejected` com razão estável |
| Registro inválido | JevRegistryError com código estável |

## 9. Modelo de custo (a tese do "barato primeiro")

1. Heurística local decide primeiro: $0, latência ~0.1ms, determinística.
2. Shadow compara local vs TypeSafe — o agreementRate POR MODO dirá onde a
   heurística basta (mantém $0) e onde o Jev remoto agrega.
3. Onde remoto valer: System One/divulgado ~400x mais barato que LLM de
   fronteira para classificação — a escala de centenas de milhares de
   decisões é onde o delta vira dinheiro real.
4. Chamadas LLM restantes (conversa real) continuam no zaos com tiering
   existente (tier-distributor/decideTier) + TenantBudgetGuard + cost-logger.
5. Escada final: heurística $0 → Jev (System One) → tier-1 local (Ollama) →
   tier-2/3 (fronteira) só com confiança baixa — o limiar
   JEV_DEFAULT_CONFIDENCE_THRESHOLD governa a escalada.

## 10. Privacidade e learning firewall

- Payload minimizado por allowlist do modo ANTES de qualquer fronteira;
  strings truncadas (512) e PII ofuscada (e-mail/telefone).
- Buffer shadow em memória guarda só: timestamp, requestId, HASH sha256 do
  tenant, modo, respostas tipadas. NUNCA guarda payload nem tenantId puro.
- Nesta onda nada sai do processo (remoto inativo) — learning firewall
  absoluto: NÃO há envio de dados para treino/destilação; quando o remoto
  ativar, só inferência, payload minimizado, e o JEV_LEARNING_FIREWALL.md
  formalizará o contrato (sem consentimento de treino = sem envio).

## 11. STOP=RED re-verificado

Registry estendível ✓ (extensão sem editar zaos) | tenant isolation ✓
(obrigatória no contrato + hash no buffer) | secret handling ✓ (só presença
booleana no config; valor lido apenas no momento da chamada remota, nunca
logado) | migração nenhuma ✓ (12 arquivos novos, aditivos) | push nenhum ✓.

## 12. Próximas ondas (proposta)

1. **SHADOW HARNESS**: povoar o runner com amostras reais (cron/Cérebro) +
   relatório de agreementRate por modo (eval harness da diretiva).
2. **LEDGER**: persistir comparações (schema Prisma aditivo, PII mínima) +
   disagreement mining.
3. **INTEGRAÇÃO TYPESAFE**: ativar `jev-typesafe` com a chave do dono
   (allowlist SSRF + budget/circuit reais + 20 security tests completos).
4. **FIACÃO**: pontos de chamada no Cérebro com feature flags por modo.
