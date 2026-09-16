# META PRICING 2026 (Fase 6/7/8/19)

Onda: `feat/meta-zella-foundation`

## Regra de ouro

```
Meta aceitou o envio   ≠   Meta cobrou
```

O evento **authoritative** de billing é o **status da Meta com
`pricing.billable = true`**. Registros criados no aceite do envio são
**estimativas** (`source='send_accepted'`, `estimated=true`) para observabilidade
e enforcement de orçamento em tempo real — nunca custo real.

## Fluxo de custo (implementado)

1. **Envio** (`whatsapp-send.ts`) → Meta aceita → registra `MetaCostLog` com
   `source='send_accepted'`, custo derivado do **rate card** (estimativa).
2. **Status webhook** (`webhooks/whatsapp/route.ts` → `processMetaStatuses`) →
   `pricing.billable`/`pricing.category`/`message_id` →
   `recordMetaPricingFromStatus()` registra/promove `MetaCostLog` com
   `source='meta_webhook_pricing'` (authoritative, **sem dupla contagem**:
   a estimativa do mesmo messageId é atualizada in place).
3. **Orçamento por plano** (`checkMetaBudget`) continua agregando `costUsd`
   sem dupla contagem.

## Categorias (Fase 6)

`marketing` | `utility` | `authentication` | `service` | `marketing_lite`

Categoria desconhecida → registrada como **UNKNOWN**: **não descartada,
não inventada, não precificada**.

## Rate card configurável (Fase 7)

`src/lib/meta/meta-rate-card.ts` — dados de configuração versionados:

| market | currency | category | rate | effectiveFrom | effectiveUntil |
|---|---|---|---|---|---|
| BR | BRL | service | 0.0315 | 2025-07-01 | 2026-09-30 |
| BR | BRL | service | 0.0315 | 2026-10-01 | null |
| BR | BRL | utility | 0.0315 | 2025-07-01 | null |
| BR | BRL | authentication | 0.0315 | 2025-07-01 | null |
| BR | BRL | marketing | 0.1875 | 2025-07-01 | null |
| BR | BRL | marketing_lite | 0.0938 | 2025-07-01 | null |

⚠️ **Valores de referência** — revisar contra o painel da Meta antes de
qualquer faturamento real. Moeda é registrada **exatamente como a Meta
reporta** (`currency` junto com o custo). **Sem câmbio fixo USD→BRL.**
O resumo (`getMetaCostSummary`) retorna totais por moeda, nunca misturados.

## Mudança de outubro 2026 (Fase 8)

- **01/10/2026:** mensagens de **service passam a ser cobradas**.
- **Utility templates dentro da janela de atendimento passam a ser cobrados.**
- A **janela de 24h continua existindo como regra de ENVIO** — ela NÃO é
  sinônimo de "mensagem grátis".

Funções separadas (responsabilidades nunca misturadas):

```ts
isCustomerServiceWindowOpen(lastGuestMessageAt)  // ENVIO
isMetaMessageBillable({ category, withinServiceWindow, at })  // COBRANÇA
```

## Fase 19 — getMetaCostSavings corrigido

- `UNBUNDLED_MULTIPLIER = 2.5` **não é verdade financeira** — tudo que dele
  deriva é marcado `estimated: true`.
- Separação explícita e nunca misturada:
  - `actualCost` → soma `source='meta_webhook_pricing'` (custo real Meta)
  - `estimatedCost` → soma `source='send_accepted'` (estimativa)
- Removidos: multiplicador inventado `* 0.5` para utility e câmbio fixo `5.15`.

## Compatibilidade

`recordMetaCost`, `classifyMessageType`, `isWithinServiceWindow`,
`getServiceWindowRemaining`, `getMetaCostSummary`, `getMetaCostSavings` e
`checkMetaBudget` mantêm assinaturas — consumidores existentes
(`webhooks/whatsapp`, `whatsapp-ai-responder`, `cron/weekly-report`,
`ddc/deliveries`, `meta-costs`) não foram quebrados.

## Testes

`tests/meta/meta-rate-card.test.ts` — janela vs cobrança, UNKNOWN, vigências,
moeda; `tests/meta/meta-foundation-certification.test.ts` — sem multiplicadores
inventados, sem câmbio fixo, fontes separadas.
