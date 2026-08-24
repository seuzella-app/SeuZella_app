# M6 — Pilot Tenant Activation Contract

A pilot tenant is activated only when identity, property, billing, channels, realtime and recovery evidence are recorded.

## Required evidence
- ZCC admin approval.
- Tenant owner identity and contact verified.
- Property, rooms and room-to-lock mappings validated.
- Billing gateway configured: Asaas or Mercado Pago.
- WhatsApp business number verified when enabled.
- Fiscal configuration recorded when NFS-e is enabled.
- Backup/restore baseline attached.
- Support owner assigned.
- Rollback owner assigned.

## Activation rule
`PILOT_ACTIVE` is not allowed without all mandatory evidence for the selected product scope.
