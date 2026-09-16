# META CONNECT — IMPLEMENTAÇÃO (Fase 10)

Onda: `feat/meta-zella-foundation`

## Estado atual: READ-ONLY

`META_CONNECT_ENABLED=false` nesta onda. O backend de conexão existe
(schema, health, telemetria), mas **não há fluxo de conexão ativo** — nenhuma
credencial é capturada, nenhuma chamada de setup é feita.

## API

### `GET /api/ddc/meta-connect` (autenticada, rate-limited)

Retorna o estado REAL da conexão Meta do tenant. **Nunca fabrica status verde.**

```json
{
  "success": true,
  "data": {
    "whatsapp": {
      "enabled": false,
      "state": "NOT_CONFIGURED | PENDING | CONNECTED | ERROR | DISCONNECTED",
      "reason": "…",
      "displayPhoneNumber": "…",
      "wabaId": "…", "businessAccountId": "…", "phoneNumberId": "…",
      "verificationStatus": "UNVERIFIED | PENDING | VERIFIED",
      "lastWebhookAt": "…", "lastDeliveryAt": "…"
    },
    "instagram": { "enabled": false, "state": "NOT_CONFIGURED" },
    "businessAgent": {
      "businessAgentAvailable": false,
      "businessAgentEnabled": false,
      "businessAgentProvider": "none",
      "businessAgentBillingModel": "none"
    },
    "webhook": { "lastWebhookAt": "…", "webhookRecent": true, "lastHealthCheckAt": "…" },
    "graphApi": { "activeVersion": "v23.0", "targetVersion": "v26.0" },
    "flags": { "…": "…" },
    "costTracking": { "authoritativeSource": "meta_webhook_pricing" }
  },
  "meta": { "readOnlyWave": true }
}
```

## Regras de estado (nunca mentir no DDC)

| Estado | Só é retornado quando |
|---|---|
| `NOT_CONFIGURED` | flag off OU credenciais ausentes |
| `PENDING` | credenciais presentes, aguardando primeiro webhook |
| `CONNECTED` | credenciais + webhook nas últimas 24h (evidência real) |
| `DISCONNECTED` | havia webhook, mas nada nas últimas 24h |
| `ERROR` | falha explícita de credencial/health |

`VERIFICADO`/`HEALTHY` só com verificação real do backend. **Nunca fabricar verde.**

## Health (Fase 11)

- Cache TTL 5 min (sem polling agressivo, sem chamadas Meta custosas).
- `lastHealthCheckAt` persistido em `MetaConnection`.
- Evidência de vida: `lastWebhookAt`/`lastDeliveryAt` atualizados pelo webhook.

## Frontend

A área DDC → Configurações → Meta consome esta rota. Nesta onda a rota é a
fonte da verdade; UI completa (tela de conexão) entra na onda de ativação com
`META_CONNECT_ENABLED=true`.

## Webhook canônico (definição operacional — auditoria desta onda)

**URL a configurar no painel da Meta (App Dashboard → WhatsApp → Webhooks):**

```
https://<domínio-de-produção>/api/webhooks/whatsapp
```

- Este é o webhook canônico: HMAC fail-closed, idempotência (`meta_webhook_events`),
  pricing authoritative (`pricing.billable`), attribution (referral), heartbeat
  (`MetaConnection.lastWebhookAt/lastDeliveryAt`) e telemetria `meta.*`.
- A rota é pública no middleware (`PUBLIC_API_PREFIXES`) — a autenticação é a
  assinatura `X-Hub-Signature-256` verificada dentro do handler, não sessão.
  (`/api/webhooks/whatsapp` estava AUSENTE da lista e recebia 401 em produção —
  corrigido nesta onda; `vercel.json` ganhou config de função equivalente ao legado.)
- `/api/webhook-whatsapp` (rota antiga) permanece no ar por compatibilidade, mas
  NÃO processa statuses/pricing/attribution/idempotência. Não deve ser usada em
  novas configurações da Meta; remoção fica para onda futura com migração
  explícita do callback URL.

## Como ativar futuramente

1. `META_CONNECT_ENABLED=true`
2. Preencher `META_ACCESS_TOKEN`/`META_WABA_ID`/`META_PHONE_NUMBER_ID`
3. Webhook público assinado na Meta (GET verify + POST HMAC já implementados)
4. O DDC passa a refletir os estados automaticamente

## Rollback

Flags off + git revert. Nada destrutivo.
