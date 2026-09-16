# META ZÉLLA ARCHITECTURE

Onda: `feat/meta-zella-foundation` — Fase 27 (documentação canônica)

## 1. Princípio canônico

**META NÃO É O CÉREBRO DO ZÉLLA.**

Meta é **canal, distribuição, identidade, aquisição e infraestrutura de conversas**.
O Cérebro Zélla permanece 100% responsável por contexto hoteleiro, memória,
conhecimento, raciocínio, ferramentas e aprendizagem.

## 2. Arquitetura alvo

```
META (WhatsApp/Instagram Cloud API)
  ↓
META CHANNEL ADAPTER            (src/lib/meta/meta-client.ts + whatsapp/cloud-api.ts)
  ↓
META EVENT NORMALIZER           (src/lib/meta/meta-normalizer.ts)
  ↓
ZÉLLA CONVERSATION              (src/app/api/webhooks/whatsapp/route.ts → ConversationLog/Guest)
  ↓
ZÉLLA BRAIN                     (whatsapp-ai-responder.ts)
  ├── Guardrails                (src/lib/ai/whatsapp-guardrails.ts)
  ├── Intent Router             (src/lib/ai/intent-router.ts)
  ├── Cognitive Router          (src/lib/ai/cognitive-router.ts)
  ├── RAG / GraphRAG            (src/lib/brain/graph-rag.ts)
  ├── Tool Calling              (src/lib/brain/zehla-tools.ts)
  ├── Persona                   (src/lib/brain/whatsapp-persona-learner.ts)
  ├── Knowledge                 (KnowledgeEntry)
  └── Learning                  (src/lib/brain/conversation-learner.ts + src/lib/meta/meta-learning.ts)
  ↓
ZéLLM COGNITIVE LAYER           (artefatos de aprendizado — NÃO novo modelo)
  ↓
RESPOSTA
  ↓
META (send)
  ↓
STATUS / OUTCOME                (webhook statuses → pricing authoritative)
  ↓
TELEMETRY                       (Telemetry Bridge existente — eventos meta.*)
  ↓
CÉREBRO APRENDE                 (outcomes → padrões verificados / anti-patterns)
```

## 3. O que existe (antes desta onda — preservado)

| Componente | Arquivo | Status |
|---|---|---|
| Webhook WhatsApp multi-tenant | `src/app/api/webhooks/whatsapp/route.ts` | Preservado + evoluído |
| HMAC/timing-safe/fail-closed | idem | Preservado sem alteração |
| Tenant resolution E.164 | `src/lib/resolve-tenant-by-phone.ts` | Preservado |
| LGPD opt-out síncrono | `src/lib/lgpd-consent.ts` | Preservado |
| Envio Cloud API | `src/lib/whatsapp-send.ts` | Corrigido (Fase 20) |
| Cloud API centralizada (legado) | `src/lib/whatsapp/cloud-api.ts` | Preservado |
| Cost guard | `src/lib/meta-cost-guard.ts` | Corrigido cirurgicamente (Fase 6/7/19) |
| Cérebro / pipeline | `src/lib/whatsapp-ai-responder.ts` + `src/lib/ai/*` + `src/lib/brain/*` | NÃO tocado estruturalmente |
| Telemetry Bridge | `src/lib/cerebro/telemetry-bridge.ts` | Reutilizado (Fase 24) |
| Planos/preços | `src/lib/plan-features.ts` | NÃO alterado (LITE 197 / PRO 397 / MAX 797 / PARCEIRO 247) |

## 4. O que foi criado nesta onda

| Novo módulo | Papel |
|---|---|
| `src/lib/meta/meta-types.ts` | Contratos normalizados (Fase 4) |
| `src/lib/meta/meta-config.ts` | Flags + versão Graph API centralizada (Fase 1/2/29) |
| `src/lib/meta/meta-rate-card.ts` | Rate card configurável + billable vs janela (Fase 6/7/8) |
| `src/lib/meta/meta-normalizer.ts` | Normalização de eventos (Fase 4) |
| `src/lib/meta/meta-client.ts` | Cliente Graph com timeout/retry seguro/correlationId (Fase 20) |
| `src/lib/meta/meta-health.ts` | Health com TTL, sem polling agressivo (Fase 11) |
| `src/lib/meta/meta-events.ts` | Idempotência DB + telemetria meta.* (Fase 5/24) |
| `src/lib/meta/meta-attribution.ts` | Click-to-WhatsApp, janela 7 dias armazenada (Fase 9) |
| `src/lib/meta/meta-learning.ts` | Contrato ZéLLM capture→sanitize→validate→score→promote (Fase 15/16/17) |
| `src/app/api/ddc/meta-connect/route.ts` | DDC META CONNECT read-only (Fase 10) |

Novas entidades Prisma (migration aditiva `20260916000000_meta_foundation_connections_idempotency_attribution`):
`MetaConnection`, `MetaWebhookEvent`, `MetaAttributionEvent` + colunas aditivas em `MetaCostLog`
(`category`, `billable`, `currency`, `rate`, `source`).

## 5. O que está desativado / preparado mas desligado

| Capacidade | Flag | Estado |
|---|---|---|
| Conexão Meta (connect flow) | `META_CONNECT_ENABLED` | `false` — DDC read-only |
| Instagram como canal | `META_INSTAGRAM_ENABLED` | `false` (Fase 12 — contrato próprio futuro) |
| Meta Business Agent | `META_BUSINESS_AGENT_ENABLED` | `false` — SEMPRE (Fase 13) |
| Atribuição | `META_ATTRIBUTION_ENABLED` | `true` (observabilidade) |
| Custo | `META_COST_TRACKING_ENABLED` | `true` (observabilidade) |
| Aprendizagem | `META_LEARNING_ENABLED` | `true` (observabilidade) |

## 6. Dependências

- **Depende de credencial:** apenas o fluxo `live` de envio (já existente) e
  futuras chamadas Graph quando `META_CONNECT_ENABLED=true`.
- **Depende de Meta approval:** webhook em produção (URL pública + app review).
- **NÃO depende de Meta One:** nada nesta onda exige assinatura Meta One.

## 7. Como ativar futuramente / desligar / rollback

- Ativar: setar `META_CONNECT_ENABLED=true` + credenciais completas → health
  passa a reportar estados reais; DDC META CONNECT mostra conexão.
- Desligar: flags para `false` — todo o pipeline de mensagens existente
  continua funcionando (o WhatsApp atual NÃO foi desligado por esta onda).
- Rollback: `git revert` do commit da onda; migration é aditiva e pode
  permanecer sem efeito funcional.

## 8. Riscos residuais

Ver `99_AUDITS` e o relatório da onda: rate card precisa ser revisado contra o
painel da Meta antes de faturamento real; janela de entrada Click-to-Message
de 7 dias deve ser confirmada por política da Meta no momento da campanha.
