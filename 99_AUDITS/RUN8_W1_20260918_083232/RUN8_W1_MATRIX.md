# RUN8-W1 — MATRIZ DE EVIDÊNCIAS (PostgreSQL / Prisma / Reservas)

Data: 2026-09-18 11:32:32 | leitura pura, nada modificado

## Totais
- models: 127 | enums: 2 | models de reserva: 3 (Reservation, Booking, BookingSyncConfig)
- migrations: 22 | lock: postgresql | latest: 20260916140000_meta_tables_rls_wave13_pattern
- $transaction: 17 ocorrências em 11 arquivos
- overlap EXCLUDE em migrations: PRESENT

## Findings
- [P1] 8B — prisma db push presente em scripts npm (8B: migrar para migrate deploy) :: package.json#db:push
- [P2] 8B — DATABASE_URL ausente nos .env verificados (nomes apenas) :: 

## Candidatos a state machine de reserva (8E, revisão no W2)
- src/__tests__/webhooks/booking-com-reviews.test.ts
- src/app/api/ddc/booking-sync/route.ts
- src/app/api/webhooks/booking-com/reviews/route.ts
- src/lib/payments/process-reservation-webhook.ts

## Próximo passo
- RUN8-W2: patches 8A-8E sobre estas evidências (sem db push; migrate deploy only).
