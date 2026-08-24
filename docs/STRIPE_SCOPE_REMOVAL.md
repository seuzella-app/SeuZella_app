# Stripe Scope Removal Record

Stripe was present in the repository from an earlier payment architecture iteration, but it is **not part of the approved Seu Zélla product scope**.

## Approved production gateways

1. Asaas
2. Mercado Pago

Mock is test/development only.

## Required cleanup

- Stripe provider removed from the payment gateway contract/factory.
- Stripe webhook endpoint removed from the application surface.
- Stripe environment variables removed from runtime configuration.
- Stripe excluded from readiness and acceptance criteria.
- Payment webhook canonicalization applies to Asaas and Mercado Pago only.

Historical documentation or generic tooling that mentions Stripe is not part of the product runtime and does not constitute a supported integration.
