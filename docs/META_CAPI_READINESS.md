# Meta Conversions API (Business Messaging) — READINESS

> Onda correção/hardening (auditoria FASE 9). Status: **FALTANDO — DEPENDÊNCIA EXTERNA.**
> Nada deste módulo está ativo. A flag `META_CAPI_ENABLED` nasce `false`.

## 1. O que já existe (preparado nesta onda)

| Item | Status | Arquivo |
|---|---|---|
| Contrato interno de evento CAPI | PREPARADO | `src/lib/meta/meta-capi.ts` |
| Builder de evento a partir de attribution determinística | PREPARADO | `buildMetaCapiEvent()` |
| Dedupe própria via `event_id` determinístico (`zella-{messageId}`) | PREPARADO | idem |
| Porta de saída única flag-gated | PREPARADO | `sendMetaCapiEvent()` |
| Flags/config em `.env.example` | PREPARADO | `META_CAPI_ENABLED/DATASET_ID/TEST_EVENT_CODE` |
| Chamada real em caminho de produção | **NENHUMA** | 0 callers (verificação no teste de certificação) |

## 2. Fatos oficiais verificados (documentação Meta)

- A variante **"Conversions API for Business Messaging"** existe na documentação
  oficial (`developers.facebook.com` → ads-commerce/conversions-api/business-messaging).
- Requer **dataset no Events Manager** e **system user token com permissão
  `ads_management`** (onboarding guide; confirmar requisitos completos na ativação).
- A Meta **não deduplica** eventos dessa variante — a dedupe é responsabilidade
  do remetente. Daí o `event_id` determinístico por `messageId` já no contrato.

## 3. UNVERIFIED (não inventado — confirmar na ativação)

- **Payload exato da variante Business Messaging**: campos obrigatórios extras,
  `action_source` aceito, formato de `user_data` para mensagens (o shape genérico
  CAPI está no contrato, mas pode divergir da variante BM).
- **Endpoint exato da variante**: o genérico é `POST {version}/{dataset_id}/events`;
  a variante BM pode exigir path/parâmetros adicionais.
- **Elegibilidade/limites por conta** (aprovação Meta por WABA/comercial).

## 4. Checklist de ativação (só depois disto ligar a flag)

1. Criar dataset no Events Manager e obter `META_CAPI_DATASET_ID`.
2. Criar system user com `ads_management` e gerar token → `META_CAPI_ACCESS_TOKEN`
   (ou reutilizar `META_ACCESS_TOKEN` se a mesma WABA já o possuir).
3. Validar o payload contra o **onboarding guide oficial** da variante BM —
   corrigir `buildMetaCapiEvent` conforme o contrato real (event_name válido,
   campos BM obrigatórios).
4. Ativar `META_CAPI_TEST_EVENT_CODE` e validar eventos no Events Manager (ambiente de teste).
5. Wiring de produção (chamar `sendMetaCapiEvent` a partir de reservas/attribution
   confirmadas — apenas evidência DETERMINISTIC) em PR próprio, revisado.
6. Só então `META_CAPI_ENABLED=true` em produção.

## 5. Riscos conhecidos

- **Dedupe**: enquanto a Meta não deduplica, retries nossos podem criar eventos
  duplicados — o `event_id` determinístico mitiga, mas o retry do `fetch` aqui é
  desativado de propósito (sem retry cego; falha volta ao caller).
- **LGPD**: `user_data` só deve conter dados com base legal de uso publicitário —
  revisar consentimento do hóspede antes de enviar PII hashed.
- **Receita**: `custom_data.value` deve vir de evidência determinística
  (`MetaAttributionEvent.reservationValue` linkado) — nunca inferência.
