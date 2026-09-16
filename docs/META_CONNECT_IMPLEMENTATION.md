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

## Como ativar futuramente

1. `META_CONNECT_ENABLED=true`
2. Preencher `META_ACCESS_TOKEN`/`META_WABA_ID`/`META_PHONE_NUMBER_ID`
3. Webhook público assinado na Meta (GET verify + POST HMAC já implementados)
4. O DDC passa a refletir os estados automaticamente

## Rollback

Flags off + git revert. Nada destrutivo.
