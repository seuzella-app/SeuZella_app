# META PRICING 2026 — ZÉLLA

Onda: `feat/meta-zella-foundation`

## Regra de ouro

```text
Meta aceitou o envio  ≠  Meta cobrou
```

O webhook da Meta informa `pricing.billable` e `pricing.category`. Isso é a
fonte de verdade para saber se a entrega foi cobrável. Quando o payload não
traz valor monetário, o Zélla pode usar o rate card apenas como **estimativa**.
A estimativa nunca deve ser apresentada como valor faturado pela Meta.

## Rate card Brasil usado pelo Zélla para referência

Base do rate card brasileiro vigente desde 01/07/2026:

| Categoria | BRL por mensagem entregue | Observação |
|---|---:|---|
| Marketing | R$ 0,3217 | tarifa de lista |
| Marketing Lite | R$ 0,3217 | mesma tarifa de marketing; payload pode usar `marketing_lite` |
| Utility | R$ 0,0350 | descontos por volume podem existir |
| Authentication | R$ 0,0350 | descontos por volume podem existir |
| Service | R$ 0,0350 a partir de 01/10/2026 | sem assumir custo antes da data |

Os valores de referência devem continuar sendo reconciliados com o rate card e
Billing Hub da Meta antes de faturamento. O preço efetivo também depende do
mercado do destinatário e, em algumas categorias, do volume.

## O que muda em 01/10/2026

- mensagens **Service** passam a ser cobradas por mensagem;
- templates **Utility** enviados dentro da janela de atendimento de 24h deixam
a isenção que existia até setembro;
- a janela de 24h continua existindo como regra de envio e **não** é sinônimo
de gratuidade;
- mensagens recebidas do hóspede não são custo de envio da Meta.

O Zélla separa:

```ts
isCustomerServiceWindowOpen(lastGuestMessageAt) // regra de envio
isMetaMessageBillable({ category, withinServiceWindow, at }) // estimativa de cobrança
```

A decisão real continua vindo de `pricing.billable` do webhook.

## Click-to-Message / Click-to-WhatsApp

A janela de entrada gratuita dos Click-to-Message entry points é estendida de
72 horas para **7 dias a partir de 21/09/2026**. O Zélla registra o entry point,
início e expiração no `MetaAttributionEvent`; a janela não deve ser inferida
retroativamente a partir de uma conversa qualquer.

## Billing em BRL

O Zélla registra `currency` por evento e não aplica câmbio fixo USD→BRL.
Isso é obrigatório porque contas elegíveis no Brasil podem usar faturamento em
BRL. Consumidores novos devem sempre tratar `amount/rate + currency` como par.

O campo legado `MetaCostLog.costUsd` permanece apenas por compatibilidade com
consumidores históricos. Ele acompanha o valor registrado da linha e **não deve
ser interpretado como USD quando `currency != USD`**. A evolução correta do
ledger é migrar consumidores financeiros para uma representação monetária
nativa por moeda.

## Meta Business Agent

Meta Business Agent possui billing separado do WhatsApp Cloud API e não é usado
nesta onda. O Zélla mantém:

```text
META_BUSINESS_AGENT_ENABLED=false
```

O Meta One também não é requisito técnico da Cloud API do Zélla.

## Regra de reconciliação

```text
send accepted
   ↓
estimated=true
   ↓
Meta status
   ↓
pricing.billable
   ↓
if Meta supplied amount → authoritative amount
if Meta did not supply amount → rate-card reference, estimated=true
```

Isso impede que o Zélla invente um custo e o confunda com a fatura real.

## Testes

- `tests/meta/meta-rate-card.test.ts`
- `tests/meta/meta-foundation-certification.test.ts`
- `tests/meta/meta-normalizer.test.ts`
- `tests/meta/meta-send-mode.test.ts`
