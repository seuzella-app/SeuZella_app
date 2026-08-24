# Pilot Acceptance Scorecard

A pilot property is accepted only when all critical dimensions are evidenced.

| Dimension | Required evidence |
|---|---|
| Availability | no unresolved SEV1 |
| Tenant isolation | cross-tenant denial verified |
| Payments | at least one successful sandbox/live-controlled flow |
| Webhooks | duplicate event safely ignored |
| Reservation | state transitions reproducible |
| WhatsApp | inbound and outbound trace available when enabled |
| Locks | room-to-lock mapping and PIN lifecycle verified when enabled |
| Realtime | desktop/mobile mutation observed |
| Fiscal | fiscal path verified when enabled |
| Support | owner and incident path confirmed |
