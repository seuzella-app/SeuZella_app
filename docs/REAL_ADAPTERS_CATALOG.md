# REAL ADAPTERS CATALOG — Onda 0

The current `src/adapters/real/index.ts` contains eight explicit deferred adapters:

| Adapter | Current state | Destination rule |
|---|---|---|
| GoogleAds | Stub / throws | FUTURE unless CORE Product Scope promotes it |
| MetaAds | Stub / throws | FUTURE unless CORE Product Scope promotes it |
| Payment | Stub / throws | Do not implement blindly; existing Asaas/Mercado Pago payment core is authoritative |
| CRM | Stub / throws | FUTURE unless commercial CRM becomes CORE |
| WhatsApp | Stub / throws | Existing Meta Cloud API webhook/send path is current core; stub should not be mistaken for production integration |
| Analytics | Stub / throws | SUPPORTING/FUTURE; native observability may cover current need |
| Email | Stub / throws | Existing EMAIL_SEND queue is current implementation; classify stub as FUTURE adapter |
| Maps | Stub / throws | FUTURE unless geospatial product flow depends on it |

## Rule

No stub is promoted to production merely because the interface exists. The adapter is implemented only when the Core Product Scope Matrix identifies it as CORE and a real provider contract, secret management, integration test, failure behavior and rollback plan exist.

## Important distinction

These stubs are architectural placeholders, not automatically production blockers. Their status is decided by product scope, not by the number of stub files.
