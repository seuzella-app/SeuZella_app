# Backup & Disaster Recovery Runbook

## Scope
PostgreSQL usado pelo Seu Zélla e dados necessários para recuperação operacional.

## Required controls
1. Automated backups enabled at the selected PostgreSQL provider.
2. Defined retention policy documented in the production environment.
3. Restore test executed in an isolated environment.
4. Critical row-count and integrity checks after restore.
5. Application boot against restored database.
6. Production smoke suite executed against restored environment.

## RPO/RTO targets
- RPO target: <= 24h before formal production pilot; tighten after measured backup cadence.
- RTO target: <= 4h for a production pilot incident.

## Restore acceptance
A backup is considered valid only after a restore successfully boots the application and passes health, authentication, tenant-isolation and payment-ledger smoke checks.

## Evidence
Record provider, backup timestamp, restore timestamp, restored environment, migration version, smoke result and operator in an incident/recovery record.
