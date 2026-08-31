# MASTER_IMPLEMENTATION_CHANGELOG

## [Lote 6 — Special Dates + Upsell 7% + HITL do Zélla] - 2026-08-31
- **Commit**: `6e6880b6`
- **Foco**: Implementação do ciclo completo de datas especiais, sugestão inteligente do Zélla com status `pending`, aprovação mandatória do proprietário (HITL), criação de `PriceOverride`, cálculo canônico e puro de 7% de Upsell e integração com ledger de faturamento.
- **Mudanças**:
  - `prisma/schema.prisma`: Adicionados modelos `SpecialDate`, `SpecialDateSuggestion`, `PriceOverride` e relações no `Tenant`.
  - `src/lib/billing/upsell-calculator.ts`: Funções `calculateUpsell` e `calculateMonthlyBilling`.
  - `src/lib/ai/special-dates/hitl-service.ts`: `SpecialDatesHitlService` implementando a lógica soberana de HITL.
  - `src/app/api/ddc/special-dates/route.ts`: Listagem e detecção de oportunidades.
  - `src/app/api/ddc/special-dates/suggestions/[id]/approve/route.ts`: Aprovação pelo proprietário com criação do `PriceOverride`.
  - `src/app/api/ddc/special-dates/suggestions/[id]/reject/route.ts`: Rejeição pelo proprietário sem alteração de tarifa.
  - `src/app/api/ddc/special-dates/overrides/route.ts`: Consulta de tarifas especiais ativas.
  - `src/app/api/v1/reservations/route.ts`: Resolução de preço com overrides e emissão de `UpsellRecord` 7%.
  - `tests/security/lote6-special-dates-upsell-hitl.test.ts`: Suíte de testes validando fluxo completo, rejeição, anti-IDOR e idempotência.
  - `LOTE6_SPECIAL_DATES_UPSELL_IMPLEMENTATION_PLAN.md`: Contrato formal de execução do Lote 6.

## [Lote 5 — Reservations & Concurrency / Zero Double Booking] - 2026-08-31
- **Commit**: `fe3c6dd7`
- **Foco**: Implementação do PostgreSQL Advisory Lock transacional, isolamento serializável com retry, e prevenção determinística de double booking.
- **Mudanças**:
  - `src/lib/db/concurrency.ts`: Utilitários `withAdvisoryLock`, `withSerializableRetry`, `mapConcurrencyError`.
  - `src/app/api/v1/reservations/route.ts`: Integração do `withAdvisoryLock('reservation:${tenantId}:${roomId}')`, ajuste do filtro de diárias e mapeamento de erro `409 Conflict`.
  - `tests/security/lote5-reservation-concurrency.test.ts`: Suíte de concorrência com 2, 10 e 50 requisições simultâneas, datas adjacentes e isolamento multi-tenant.
  - `LOTE5_RESERVATION_CONCURRENCY_IMPLEMENTATION_PLAN.md`: Contrato de execução do Lote 5.

## [Lote 4 — IDOR / Tenant Boundary Exhaustive] - 2026-08-31
- **Commit**: `70fe37e5`
- **Foco**: Hardening de todas as rotas dinâmicas e mutações em `src/app/api/`.
