# DRE FINANCIAL DOMAIN SPEC — Onda 0

## Objetivo

Substituir constantes financeiras por um domínio operacional auditável. O DRE não deve assumir uma taxa tributária universal nem usar custos de infraestrutura como números fixos.

## Entidades previstas

- `OperationalCost`: custos recorrentes/fixos, fornecedor, categoria, competência, moeda, valor, ativo.
- `InfraCostLog`: custos de Vercel, Redis, DB, storage e demais infraestrutura por período.
- `MarketingCostLog`: investimento de aquisição por canal/campanha/período.
- `WhatsAppCostLog`: custos de mensagens e bundles por tenant/período.
- `ExchangeRate` ou util equivalente: moeda, fonte, taxa, timestamp e validade.

## DRE

`Receita Bruta - Gateway Fees - Impostos - COGS LLM - COGS WhatsApp - COGS Infra - Refunds/Chargebacks - OPEX = Resultado Líquido`.

## Tributação

O regime tributário é parametrizável por:

- `taxModel`
- `taxRegime`
- `effectiveRate`
- `validFrom`
- `validTo`
- fonte/observação da regra

Nenhuma alíquota como 6% deve ser tratada como verdade universal no código.

## Multi-tenant

DRE global é função do ZCC; DRE do tenant precisa estar escopado. Custos compartilhados devem ter regra explícita de rateio ou permanecer como custo global.

## Critérios de aceite

- Não existem hardcodes financeiros de OPEX/FX/imposto no cálculo principal.
- Todas as linhas do DRE possuem fonte de dados identificável.
- Um mesmo custo não pode ser contabilizado duas vezes.
- Refund/chargeback reduz receita conforme state da transação.
- Relatório global e relatório por tenant reconciliam.
- Margem e resultado são reproduzíveis para um período fechado.
