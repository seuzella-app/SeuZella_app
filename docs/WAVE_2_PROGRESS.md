# Wave 2 — Core Operational Progress

## Baseline

Wave 2 starts from merge commit `dc0f69b7c61dde18fa852d55ca781cf327157ad1`.

## Domain boundary — critical

The project has **two different payment domains** and they must not be conflated:

1. **SaaS Billing (owner/hotelier)**
   - `Subscription`
   - `/api/checkout/*`
   - Production gateways: Asaas + Mercado Pago
   - Mock is development/test only

2. **Guest Reservation Payments (hotel stay)**
   - `Reservation`
   - `Transaction`
   - `reservation_payments`
   - Guest/room/check-in/check-out lifecycle
   - This domain does not reuse SaaS `Subscription` semantics.

## Current implementation status

### C2.0 — SaaS Billing
- **IMPLEMENTED**
- Unified gateway contract for Asaas + Mercado Pago.
- Provider-specific Mercado Pago PIX code removed from SaaS checkout.
- Provider payment ID and gateway metadata persisted.
- Common PIX/Boleto/checkout result contract.
- Regression coverage in payment environment and gateway abstraction tests.

### C2.1 — Guest Reservation Payment
- **IMPLEMENTED — awaiting real sandbox/E2E validation**
- Canonical reservation payment ledger in `reservation_payments`.
- Reservation payment endpoint with tenant isolation.
- Real guest email validation before creating a provider charge.
- Asaas + Mercado Pago gateway references use `referenceType=reservation`.
- Webhooks route reservation vs subscription references without conflating domains.
- PostgreSQL advisory-lock idempotency on provider webhook events.
- `Transaction` created only when provider status becomes `approved`.
- Persistent payment-confirmation notification in the `Notification` table.
- Explicit tenant-safe room → lock assignment.
- Server-side reservation PIN generation path.
- PIN delivery attempts through the existing WhatsApp delivery service.
- Regression test for the system PIN provider registry path.

## Current gates

- CodeRabbit: **PASSING** on PR #10.
- Vercel: **revalidating latest head** after the provider-registry fix.
- Real Asaas/Mercado Pago sandbox validation: **PENDING**.
- Full E2E reservation → payment → webhook → confirmation → PIN: **PENDING**.

## Important limitations kept intentionally

- No provider is selected arbitrarily when a property has multiple locks.
- Lock automation requires an explicit room → lock assignment.
- The system does not mark a reservation as paid from the checkout creation response; only an approved provider webhook creates the completed ledger transaction.
- Production Mock gateway remains forbidden.

## Next sequence

1. Finish Vercel + CodeRabbit gate for PR #10.
2. Run the full reservation payment contract tests and sandbox validation where credentials are available.
3. Merge PR #10 only after the gate is green.
4. Advance to the next operational Wave 2 front, keeping tests, fixes and commits attached to every implementation increment.
