# Wave 0 → Wave 2 Reconciliation

## Confirmed invariants

1. Production payment providers: Asaas + Mercado Pago. Stripe is out of scope.
2. SaaS billing domain: `Subscription` + `PaymentTransaction`.
3. Guest reservation payment domain: `Reservation` + `reservation_payments` + `Transaction`.
4. Canonical webhook routing must respect `referenceType` before any legacy fallback.
5. Reservation payment idempotency must never require or fabricate a `subscriptionId`.
6. Fiscal provider is independent from payment provider; Asaas is the first NFS-e provider.
7. WhatsApp is a business capability behind Meta Cloud API, not a provider-specific business domain.
8. Realtime state is tenant-scoped and versioned; Redis is the production transport for multi-instance synchronization.

## Current Wave 2 blocker found by reconciliation

The generated Prisma client still requires `subscriptionId` on `PaymentTransaction`. The correct fix is architectural: keep reservation payment idempotency on `reservation_payments` instead of weakening the SaaS billing ledger schema.

## Acceptance rule

Wave 2 cannot merge until the current HEAD reaches Vercel READY and the reservation/subscription payment boundary passes the automated regression suite.
