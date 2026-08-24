# C2.1 — Guest Reservation Payment Status

## Scope boundary

C2.1 is the **guest reservation payment domain**. It does not reuse SaaS `Subscription` semantics.

- SaaS billing: `Subscription` + `/api/checkout/*`
- Guest payment: `Reservation` + `Transaction` + `reservation_payments`
- Production gateways: **Asaas + Mercado Pago**
- Mock: development/test only
- Stripe: **out of scope**

## Implemented

1. Canonical gateway reference contract: `referenceId` + `referenceType`.
2. Reservation payment ledger with tenant/reservation/provider identity and uniqueness constraints.
3. Reservation payment initiation endpoint under tenant authentication and API security wrapper.
4. Asaas + Mercado Pago adapters use the reservation ID as the provider reference.
5. Canonical webhook dispatcher resolves either Subscription or Reservation reference.
6. Reservation webhook reconciliation is atomic and idempotent by provider event ID.
7. Approved payment creates the financial `Transaction` record.
8. Approved payment creates a durable DB notification for the hotelier.
9. Explicit room→lock assignment was added to `lock_devices`.
10. Server-side reservation PIN generation path was added without relying on a human session.
11. Approved payment now attempts secure PIN programming only when the reservation room has an explicit active lock assignment.
12. If there is no lock assignment or PIN generation fails, payment remains successful and a high/urgent operational notification is created instead of silently failing the booking.
13. Regression contract test protects the subscription/reservation payment boundary.

## Still pending acceptance gates

- Asaas sandbox execution with real credentials.
- Mercado Pago sandbox execution with real credentials.
- Database migration execution against a real PostgreSQL instance.
- Full E2E: reservation → payment creation → provider webhook → transaction → notification → PIN.
- Real WhatsApp delivery validation.
- Real lock provider OAuth/API validation for each supported brand.
- Retry/replay validation against real provider webhook deliveries.

## Stop rule

C2.1 is **not accepted** and PR #10 must not merge until the current Vercel preview is READY and the automated gates are green. Production-like external validation remains a later acceptance gate even after the build is green.
