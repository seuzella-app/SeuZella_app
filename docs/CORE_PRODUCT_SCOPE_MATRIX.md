# CORE PRODUCT SCOPE MATRIX — Seu Zélla

## CORE — bloqueia M6

- ZCC admin authentication and control plane.
- DDC Pousada Desktop/Mobile.
- DDC Airbnb Desktop/Mobile, enquanto Airbnb estiver no produto comercial inicial.
- Tenant isolation and RBAC.
- Reservation/booking lifecycle.
- Billing/payment lifecycle for at least one production gateway and the configured alternatives intended for launch.
- Secure webhooks and idempotency.
- WhatsApp guest communication path using the supported official provider.
- Realtime Mobile ↔ Desktop synchronization.
- Smart lock lifecycle for the brands explicitly included in the commercial offer.
- Cérebro orchestration, timeout, fallback and budget control.
- LGPD technical controls.
- ZCC operational health/readiness views.

## SUPPORTING — M5 required, not a separate commercial feature

- PostgreSQL resilience.
- Redis/BullMQ.
- Push notifications when enabled by product.
- SRE monitoring and alerting.
- Backup/restore.
- DLQ and cron operations.
- Cost collection and finance telemetry.

## OPTIONAL — does not block initial M6

- Additional lock brands outside the launch matrix.
- Google OAuth.
- Web Push if the initial customer rollout does not require it.
- Alexa, if the commercial launch does not advertise Alexa as a supported integration.
- Google Home/Matter/Zigbee.
- Advanced marketing adapters (Google Ads/Meta Ads).
- CRM external adapters.
- Maps adapter.

## EXPERIMENTAL — no M6 blocker

- Experimental adapter implementations not selected by product scope.
- Research-only GraphRAG/ML branches not required by the launch flow.

## LEGACY — remove when encountered

- Deprecated OpenWA paths.
- Removed Caução PIX functionality and its orphaned cron registration.
- Demo authentication bypasses.
- Dead routes and stale mocks that contradict production flows.

## Decision rule

A module is CORE only when the launch proposition, customer journey or safety/security boundary depends on it. Presence in the repository is not enough to make it an M6 blocker.
