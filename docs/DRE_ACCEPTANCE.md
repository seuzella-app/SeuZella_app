# DRE Operational Acceptance

## Principles
The DRE must distinguish measured revenue, variable costs and configured accounting assumptions. No provider fee, tax rate, FX rate or fixed OPEX may be treated as a universal legal/business constant.

## Required sources
- Subscription revenue from persisted billing records.
- Reservation/payment revenue from persisted transactions.
- Gateway fees from provider transactions or configured fee schedules.
- LLM costs from usage/cost records.
- WhatsApp/Meta costs from measured provider data when available.
- Redis/database/storage/Vercel costs from infrastructure cost records or explicitly configured estimates.
- Marketing/CAC from a dedicated marketing-cost source, not LLM spend as a proxy.
- Tax regime and effective rate from configurable financial settings owned by the business/accounting operator.
- FX rate from a recorded source with effective timestamp.

## Acceptance
For every period, the DRE can reproduce its totals from stored source records and configuration snapshots. A changed tax or FX setting affects only periods where that setting is effective; historical reports remain reproducible.
