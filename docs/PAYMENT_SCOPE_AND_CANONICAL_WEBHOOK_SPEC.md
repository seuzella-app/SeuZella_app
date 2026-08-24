# PAYMENT SCOPE & CANONICAL WEBHOOK SPEC — Seu Zélla

## Escopo comercial confirmado

Os gateways de pagamento do Seu Zélla são:

- **Asaas** — gateway primário para cobrança nacional, PIX, boleto e recorrência quando aplicável.
- **Mercado Pago** — gateway secundário para pagamento no Brasil e fallback operacional.
- **Mock** — somente desenvolvimento, testes e ambientes sem cobrança real.

**Stripe NÃO faz parte do escopo do produto e não deve ser implementado, configurado ou exigido para readiness, billing, E2E ou go-live.**

## Regras de seleção

1. `DEFAULT_PAYMENT_GATEWAY=asaas` ou `mercadopago`, quando configurado.
2. Caso não exista override válido, selecionar o primeiro gateway configurado na ordem `asaas` → `mercadopago`.
3. Mock somente quando nenhum gateway real estiver configurado e somente em modo permitido para desenvolvimento/testes.
4. Em produção, ausência de Asaas e Mercado Pago deve manter o sistema **NOT READY**.

## Contrato canônico

```ts
interface WebhookCanonicalEvent {
  provider: 'asaas' | 'mercadopago';
  providerEventId: string;
  eventType: string;
  occurredAt?: string;
  externalPaymentId?: string;
  externalSubscriptionId?: string;
  internalSubscriptionId?: string;
  tenantId?: string;
  amount?: number;
  currency?: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'unknown';
  rawPayload: unknown;
}
```

## Regras obrigatórias de webhook

1. Validar a assinatura/autenticidade específica de cada provedor antes de qualquer mutação de negócio.
2. Persistir `providerEventId` com unicidade por provedor antes de efeitos irreversíveis.
3. Resolver `tenantId` pelo relacionamento interno de assinatura/pagamento; campos enviados pelo gateway servem para correlação, não para autorização isolada.
4. `rawPayload` é auditoria, nunca fonte primária de autorização.
5. Atualização de assinatura, pagamento e transação deve ocorrer em transação consistente.
6. Evento já processado deve ser reconhecido sem duplicar efeitos.
7. Retry transitório precisa ser seguro; erro definitivo deve ser observável e encaminhado para tratamento/DLQ quando aplicável.
8. Evento desconhecido deve ser reconhecido sem mutação de negócio.

## Homologação obrigatória

### Asaas

- pagamento PIX criado
- pagamento aprovado
- pagamento recusado/cancelado
- cobrança recorrente
- webhook duplicado
- assinatura inválida
- retry
- resolução interna de tenant/subscription

### Mercado Pago

- pagamento PIX criado
- pagamento aprovado
- pagamento recusado/cancelado
- fluxo de checkout aplicável ao produto
- webhook duplicado
- assinatura/autenticidade inválida
- retry
- resolução interna de tenant/subscription

## Fluxo canônico

`HTTP -> authentication/signature verification -> parse -> event idempotency -> canonical normalization -> internal tenant/subscription resolution -> transaction/state transition -> audit -> response`.

## Critério de aceite da Onda 1

Nenhum fluxo de cobrança do Seu Zélla pode depender de Stripe ou de credencial Stripe. Um mesmo evento de Asaas ou Mercado Pago repetido três vezes pode produzir no máximo um efeito de negócio.
