# M6 — Go / No-Go Decision Record

## GO requires
- 8 real pilot properties accepted under the pilot scorecard.
- No unresolved SEV1 incident in the observation window.
- Production payment reconciliation green for Asaas and Mercado Pago.
- Tenant isolation canaries green.
- Backup/restore evidence current.
- Monitoring and incident response operational.
- LGPD operational checklist complete.
- Billing lifecycle tested through renewal/failure/suspension/reactivation.
- Support SLA owner and coverage confirmed.
- Pricing, contract, onboarding and rollback materials published.

## NO-GO triggers
Any unresolved P0, unproven critical provider dependency, payment/fiscal integrity issue, cross-tenant exposure, failed rollback, or missing pilot evidence.

## Decision rule
The system may be technically mature without being commercially ready. `M6_GO` is a business decision backed by the evidence above, not a proxy for code coverage.
