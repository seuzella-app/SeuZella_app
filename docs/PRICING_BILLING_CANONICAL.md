# Pricing & Billing Canonical Lifecycle

## Subscription lifecycle
TRIAL -> ACTIVE -> PAST_DUE -> GRACE -> CANCELED

## Required controls
- One canonical plan catalog.
- Gateway provider is implementation detail.
- Subscription state transitions are webhook-driven after provider confirmation.
- Refunds, chargebacks and failed renewals are auditable.
- Customer-facing copy never exposes provider-specific complexity unless needed.

## Payment scope
Production gateways: Asaas and Mercado Pago.
Stripe is not part of the product scope.