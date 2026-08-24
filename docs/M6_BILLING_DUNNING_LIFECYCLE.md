# M6 — Billing and Dunning Lifecycle

## Canonical state machine
`TRIAL -> ACTIVE -> PAYMENT_DUE -> RETRYING -> GRACE_PERIOD -> SUSPENDED -> CANCELED`

## Rules
- Provider events are the source of payment confirmation.
- Retries are idempotent.
- Grace period duration is configurable by product policy.
- Suspension must not delete customer data.
- Reactivation requires a valid payment state and audit record.
- The provider remains replaceable; the owner sees only the business status.

## Required evidence
Initial charge, renewal, failed charge, retry, grace-period notification, suspension and reactivation.
