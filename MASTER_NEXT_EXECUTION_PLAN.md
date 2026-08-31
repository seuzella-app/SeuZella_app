# MASTER_NEXT_EXECUTION_PLAN

**Data**: 2026-08-31  
**Status Atual**: Pronto para início do **LOTE 5**  
**Worktree Base**: `70fe37e5`

---

## 1. Plano de Ação por Tarefa

| ID | Domínio / Tarefa | Solução Técnica | Arquivos Envolvidos | Teste / Validação | Gate | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **L5.1** | **Reservations / Concurrency** | Integrar `src/lib/db/concurrency.ts` com `withAdvisoryLock` e retry serializável | `src/lib/db/concurrency.ts`, `src/app/api/v1/reservations/route.ts` | `tests/concurrency/reservation-overlap-adversarial.test.ts` | Vitest + tsc | `READY_FOR_EXECUTION` |
| **L5.2** | **PostgreSQL Double Booking Lock** | Adicionar migration `no_overlap` com `btree_gist` e EXCLUDE constraint | `prisma/schema.prisma`, `prisma/migrations/` | Postgres exclusion / conflict 23P01 | Vitest + Prisma | `READY_FOR_EXECUTION` |
| **L6.1** | **Special Dates Schema & HITL** | Adicionar modelos `SpecialDate`, `SpecialDateSuggestion`, `PriceOverride` | `prisma/schema.prisma`, `src/lib/ai/special-dates/` | `tests/cerebro/brain-hitl-gate.test.ts` | Vitest + tsc | `PLANNED` |
| **L6.2** | **Upsell Calculator (7% Regra Canônica)** | Adicionar `src/lib/billing/upsell-calculator.ts` (7% em datas especiais) | `src/lib/billing/upsell-calculator.ts`, `src/app/api/yield/` | `tests/billing/upsell-concept-correct.test.ts` | Vitest + tsc | `PLANNED` |
| **L7.1** | **Parceiro Zélla (100 vagas / R$ 247)** | Integrar `src/lib/partner/partner-program.ts` e claims com expiração | `src/lib/partner/partner-program.ts`, `src/app/parceiro/` | `tests/partner/partner-program-limits.test.ts` | Vitest + tsc | `PLANNED` |
| **L8.1** | **Landing Page & Copy do Zelador** | Atualizar copy para identidade "Zelador da Pousada", 7% Upsell e Parceiro | `src/app/page.tsx`, `src/config/plans.ts` | `npm run build` | Build + Visual | `PLANNED` |
| **L9.1** | **E2E Synthetic Fixtures** | Integrar `seed-synthetic.ts` para Pousadas Mar Azul, Encanto e Sol | `scripts/seed-synthetic.ts`, `tests/e2e/` | Suíte E2E | Vitest E2E | `PLANNED` |
| **L10.1** | **Hostinger MVK4 VPS Preflight** | Validar scripts de deploy, Nginx e systemd para VPS | `deploy/hostinger/`, `scripts/` | Script dry-run | Script Check | `PLANNED` |

---

## 2. Paralelização por Tracks
- **Track A (Database & Concurrency)**: L5.1, L5.2
- **Track B (Upsell & Special Dates HITL)**: L6.1, L6.2
- **Track C (Parceiro Zélla & Plans)**: L7.1, L8.1
- **Track D (E2E & Synthetic Testing)**: L9.1
- **Track E (VPS Readiness)**: L10.1
