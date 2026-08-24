# STRIPE EVENT CANONICAL SPEC — Onda 0

## Objetivo

Eliminar dependência de `event.raw.metadata` e tornar o processamento de eventos Stripe determinístico, idempotente e seguro para multi-tenant.

## Contrato canônico

```ts
interface WebhookCanonicalEvent {
  provider: 'stripe';
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  externalSubscriptionId?: string;
  internalSubscriptionId?: string;
  tenantId?: string;
  amount?: number;
  currency?: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'unknown';
  rawPayload: unknown;
}
```

## Regras obrigatórias

1. Validar `Stripe-Signature` antes do parse de negócio.
2. Persistir o `providerEventId` antes de executar efeitos irreversíveis.
3. Resolver `tenantId` pelo mapeamento interno da aplicação/assinatura; metadata externo é somente auxiliar de correlação.
4. `rawPayload` é auditoria, nunca fonte primária de autorização.
5. Mudança de assinatura/pagamento ocorre por state machine e transação consistente.
6. Evento já processado deve retornar `ALREADY_PROCESSED` ou equivalente sem duplicar efeitos.
7. Erro transitório deve ser retry-safe; erro definitivo deve ser rastreável para DLQ/observabilidade.
8. Eventos desconhecidos devem ser reconhecidos sem produzir mutação de negócio.

## Eventos mínimos da homologação

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `customer.subscription.deleted`
- falha/retry
- evento duplicado
- assinatura inválida
- timestamp expirado/futuro

## Fluxo canônico

`HTTP -> signature verification -> parse -> event idempotency -> canonical normalization -> internal tenant/subscription resolution -> transaction/state transition -> audit -> response`.

## Critério de aceite Onda 1

Nenhum fluxo de cobrança pode depender de `raw.metadata` para autorizar um tenant. Um mesmo event ID repetido três vezes produz no máximo um efeito de negócio.
