# Webhook Security Matrix — Wave 1

| Provider | Authenticity | Replay / Idempotency | Tenant Resolution | Response Policy | Status |
|---|---|---|---|---|---|
| Asaas | `asaas-access-token` / HMAC `sha256=` with timing-safe comparison | `providerEventId` + DB advisory lock | Internal subscription -> tenant | 200 only after accepted processing; retryable failures non-2xx | IMPLEMENTED |
| Mercado Pago | `x-signature` HMAC-SHA256 using `data.id`, `x-request-id`, `ts`, `v1` | `providerEventId` + DB advisory lock | Internal subscription -> tenant | 200 after accepted processing | IMPLEMENTED |
| WhatsApp | `x-hub-signature-256` HMAC-SHA256 | Meta `message.id` used as durable queue `jobId` | Phone -> resolved tenant before enqueue | 503 when queue unavailable to trigger retry | IMPLEMENTED |
| GitHub ZCC | `X-Hub-Signature-256` HMAC + IP defense | `X-GitHub-Delivery` | ZCC-only system path | 2xx for accepted/ignored events | IMPLEMENTED; delivery cache remains in-memory defense layer |

## Rules

1. Payment webhooks may mutate subscription/payment state only after provider authentication.
2. Payment tenant identity comes from the internal subscription/payment mapping; gateway metadata is correlation data only.
3. Duplicate provider events must be safe to replay.
4. Unknown events must not cause business-state mutation.
5. Provider failures that should be retried must return non-2xx.
6. Production rate limiting for webhook routes is distributed and fail-closed until Redis/Upstash is configured.
7. Stripe is explicitly out of the production integration set.
