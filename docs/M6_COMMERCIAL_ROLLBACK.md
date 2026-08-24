# M6 — Commercial Rollback Policy

## Triggers
- Critical billing defect.
- Payment reconciliation defect.
- Security incident.
- Widespread loss of operational capability.
- Material fiscal/data integrity issue.

## Action
1. Freeze new tenant onboarding.
2. Protect existing tenant data and access.
3. Identify last known-good production deployment.
4. Reconcile financial and fiscal events before reactivation.
5. Communicate incident and recovery state to affected owners.
6. Resume only after release gate and incident owner approval.

## Invariant
Rollback restores a known-good application state; it does not erase financial, fiscal, audit or tenant history.
