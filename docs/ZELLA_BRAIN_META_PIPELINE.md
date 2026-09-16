# ZÉLLA BRAIN → META PIPELINE (Fase 14)

Onda: `feat/meta-zella-foundation`

## Princípio

**NÃO existe um "Meta Brain".** Meta é integrada ao Cérebro atual como canal.
Nada do pipeline do Cérebro foi duplicado ou substituído.

## Fluxo implementado (preservado + enriquecido)

```
Meta (webhook — HMAC fail-closed, timing-safe)
  → idempotência (claimMetaEvent — Fase 5)
  → normalized event (meta-normalizer)
  → ConversationLog / Guest (bsuid-resolver)
  → LGPD opt-out síncrono (preservado)
  → Intent (ai/intent-router)
  → Cognitive Router (ai/cognitive-router — NÃO alterado estruturalmente)
  → RAG/GraphRAG + Tool Calling (preservados)
  → resposta
  → Meta (whatsapp-send — versão centralizada, sem retry cego)
  → outcome (statuses → pricing authoritative → telemetria)
```

## Módulos reutilizados (zero duplicação)

| Módulo | Papel |
|---|---|
| `src/lib/whatsapp-ai-responder.ts` | pipeline principal — intacto |
| `src/lib/ai/cognitive-router.ts` | roteamento cognitivo — intacto |
| `src/lib/brain/conversation-learner.ts` | aprendizagem — intacto |
| `src/lib/cerebro/telemetry-bridge.ts` | telemetria — reutilizado via `recordMetaTelemetry` |

## O que a onda ADICIONOU ao pipeline (aditivo)

1. **Idempotência** (Fase 5): retries da Meta não processam duas vezes.
2. **Statuses** (Fase 6/11): pricing authoritative + heartbeat de conexão +
   telemetria de entrega (`meta.message.delivered|read|failed`).
3. **Attribution** (Fase 9): referral do webhook → `MetaAttributionEvent`
   (campaign → ad → entry point → conversa; janela 7 dias armazenada).
4. **ZéLLM outcomes** (Fase 15/16/17): resultado real da conversa
   (reserva/handover/falha) alimenta a aprendizagem — ver
   `ZELLM_LEARNING_CONTRACT.md`.

## Enriquecimento de contexto (Fase 17)

Contexto de aprendizado agregado por conversa (`ConversationLog.metadata.zellm`):
`channel`, `source`, `campaignId`, `entryPointType`, `intent`, `metaCategory`,
`leadStatus`, `reservationStatus`, `reservationValue`, `humanHandover`,
`outcome`.

Assim o ZéLLM aprende **"qual resposta converte melhor"** — e não somente
"qual resposta parece boa".

## Garantias

- Fallback e guardrails do Cognitive Router: **intactos**.
- ConversationLearner: **preservado**.
- WhatsApp existente: **não foi desligado por esta onda**.
- Nenhuma segunda telemetria, nenhum segundo cérebro.
