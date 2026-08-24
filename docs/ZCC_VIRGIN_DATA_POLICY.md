# ZCC — Virgin Environment Data Policy

## Purpose
The first-pilot environment must prove that ZCC is populated by real product events rather than fixtures or optimistic estimates.

## Rules
- Business tenant counters come from PostgreSQL `Tenant` records.
- Guest counters come from persisted `Guest` records.
- Conversation counters come from `ConversationLog`, `ConversationMessage`, `GuestMessage` or other canonical persisted conversation records.
- Payment counters come from persisted payment/transaction records.
- Fiscal counters come from persisted fiscal provider records/events.
- WhatsApp connectivity must be derived from the tenant's real provider configuration and/or an explicit connection audit event.
- Lock/PIN activation must be derived from an explicit operational state or audit event.
- AI activity metrics must come from persisted AI activity/agent telemetry.
- When the source is unavailable, the UI/API must return `unknown`, `0` where mathematically appropriate, or an explicit unavailable state.
- Never use hardcoded business tenants, fabricated progress percentages, synthetic guest conversations or estimated conversion numbers as operational truth.

## Fire-test acceptance
Before the first tenant exists, ZCC must show an empty business state. After the first manual registration, only that tenant should appear. Each subsequent card, metric and activity should be traceable to a persisted source record or an explicit provider event.
