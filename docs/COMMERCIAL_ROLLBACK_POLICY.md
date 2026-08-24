# Commercial Rollback Policy

A commercial rollout must be reversible without deleting customer data.

## Triggers
- SEV1 incident.
- Material payment reconciliation error.
- Cross-tenant isolation failure.
- Irreversible fiscal corruption.
- Widespread provider outage with no safe fallback.

## Actions
1. Stop new onboarding.
2. Disable affected capability.
3. Preserve evidence and audit logs.
4. Roll back application to last known-good deployment when safe.
5. Reconcile payment/fiscal state before reactivation.
6. Communicate status to affected customers.
