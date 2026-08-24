# Payment Scope Correction — Wave 1

**Decision:** Stripe is explicitly out of the Seu Zélla production scope.

**Supported production gateways:**
- Asaas
- Mercado Pago

**Development-only:** Mock gateway.

This correction supersedes any earlier Wave 0 reference to Stripe as a production gateway. The implementation contract, readiness checks, webhook acceptance tests, E2E payment matrix and Go-Live Billing criteria must use Asaas/Mercado Pago only.
