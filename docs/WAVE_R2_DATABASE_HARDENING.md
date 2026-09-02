# Wave R2 — Database, Migrations, RLS e Money

## Baseline

- Base branch: `main`
- Base commit: `9324ffc6b10fac94762fa3cd7ddb2c331fe19b08`
- Execution branch: `wave/r2-database-hardening-f01-f04`
- This wave does not claim runtime PostgreSQL validation.

## Findings confirmed from the repository

1. `prisma/schema.prisma` still contains monetary `Float` fields, including
   `Room.price`, `Booking.totalPrice`, `Reservation.totalPrice`,
   `PaymentTransaction.amount`, subscription proration data and other
   financial/pricing fields. These must be classified before migration.
2. `src/lib/db/tenant-prisma.ts` previously classified relational child models
   without a direct `tenantId` (`PaymentTransaction`, `ConversationMessage`,
   `GuestMessage`, `SwipeUsage`) as direct tenant-scoped models. That contract
   was unsafe because the extension injects `tenantId` into Prisma queries/data.
   They are now removed from the direct list; their isolation remains rooted in
   `Subscription`, `ConversationLog`, `Guest`, and `SwipeTemplate` respectively.
3. `src/lib/payments/idempotency.ts` previously executed the billing handler
   when the durable idempotency delegate was unavailable. That violated the
   exactly-once production invariant. It now fails closed with
   `BILLING_IDEMPOTENCY_UNAVAILABLE`.
4. PostgreSQL RLS context primitives exist (`app.current_tenant_id`), but broad
   tenant-table RLS is intentionally NOT enabled yet. Enabling it before all
   database access paths execute inside a transaction carrying the context
   would break legitimate application paths and create false security.

## F01 — Monetary schema inventory

Run `scripts/production/audit-money-schema.sh` and classify every finding:
- `MONEY_DECIMAL`: currency amount persisted in BRL or another currency.
- `RATE_DECIMAL`: percentage/rate requiring deterministic precision.
- `NON_MONETARY`: Float is legitimate (coordinates, scores, ML metrics, etc.).

No Float monetary field may be added after this baseline.

## F02 — Decimal migration

Use additive migrations first:
1. Add Decimal(18,2) shadow columns for monetary amounts.
2. Add Decimal(9,6) or equivalent only where a rate genuinely requires it.
3. Backfill deterministically from legacy Float using explicit rounding.
4. Add consistency checks between legacy and Decimal columns during the
   transition.
5. Update application writes to the Decimal columns.
6. Update reads/aggregations/exports and payment/ledger calculations.
7. After a verified transition, remove legacy Float columns in a separate
   migration. Never combine destructive column removal with the first backfill.

Rule A remains immutable: `7% × reservationValue` using the canonical monetary
primitive and HALF-UP semantics.

## F03 — Migration safety

- Verify migration directories are strictly ordered.
- Detect duplicate or conflicting table/column operations.
- Ensure every new migration is idempotent where PostgreSQL permits it.
- Keep rollback SQL documented for additive operations.
- Never use `prisma db push` as the production migration mechanism.
- Add a CI/static contract that rejects schema changes introducing new
  monetary Float fields.

## F04 — RLS adoption gate

RLS remains staged until all tenant-root queries are proven to execute with a
transaction-local tenant context. Before enabling broad RLS:
- enumerate every tenant-root table;
- map every read/write path to `withTenantContext` or an equivalent transaction
  wrapper;
- add PostgreSQL integration canaries for allow/deny/create/update/delete;
- prove missing context is fail-closed;
- prove context cannot be changed by untrusted request data;
- only then enable FORCE ROW LEVEL SECURITY where appropriate.

## Current implementation status

- Child-model tenant-extension correction: IMPLEMENTED in this branch.
- Billing idempotency fail-closed correction: IMPLEMENTED in this branch.
- Monetary inventory tool: IMPLEMENTED in this branch.
- Decimal schema migration: NOT YET APPLIED — requires inventory + code impact map.
- Broad RLS: BLOCKED BY ADOPTION PROOF, not by lack of SQL syntax.
- PostgreSQL runtime certification: BLOCKED until real PostgreSQL is available.

## Required validation before merge

`npm run typecheck`
`npm run lint`
`npm run test -- tests/security/wave-r2-database-hardening.test.ts`
`npm run test:all-suites`
`npm run test:v11-all`
`npm run build`

Additionally, execute `scripts/production/audit-money-schema.sh` and preserve
its raw output in the wave evidence.
