# ENVIRONMENT OWNERS MATRIX — Seu Zélla

## Core

| Variable | Owner | Validation | Rotation |
|---|---|---|---|
| NEXTAUTH_SECRET | Auth | readiness | Manual |
| NEXTAUTH_URL | Infra | readiness | N/A |
| ZEHLA_MASTER_ADMIN_EMAIL | Auth | readiness + login | Manual |
| ZEHLA_MASTER_ADMIN_PASSWORD | Auth | production login | Manual |
| ZCC_ADMIN_EMAILS | Auth | readiness + ZCC smoke | Manual |

## Security

| Variable | Owner | Validation | Rotation |
|---|---|---|---|
| ALEXA_JWT_SECRET | Security | Alexa auth suite | Secret rotation |
| ENCRYPTION_SECRET | Security | crypto/secret tests | Secret rotation |
| CACHE_SIGNING_SECRET | Security | production security suite | Secret rotation |

## Database / Infra

| Variable | Owner | Validation | Rotation |
|---|---|---|---|
| DATABASE_URL | Infra | readiness + DB smoke | Provider rotation |
| UPSTASH_REDIS_REST_URL | Infra | Redis/rate-limit/BullMQ/SSE test | Provider rotation |
| UPSTASH_REDIS_REST_TOKEN | Infra | Redis/rate-limit/BullMQ/SSE test | Provider rotation |

## Integrations — Payments

| Provider | Variables | Validation |
|---|---|---|
| Asaas | `ASAAS_ACCESS_TOKEN`, `ASAAS_ENVIRONMENT`, `ASAAS_WEBHOOK_SECRET` | create payment + webhook auth + idempotency |
| Mercado Pago | `MP_ACCESS_TOKEN`, `PAYMENT_WEBHOOK_SECRET` or `MP_WEBHOOK_SECRET` | create payment + x-signature HMAC + idempotency |
| Mock | none | dev/test only |

**Stripe is not an approved integration and has no production environment variables.**

## Integrations — Other

- WhatsApp: `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`.
- LLM: provider API keys, including GLM when enabled.
- Locks: provider Client ID/Secret pairs only when the brand is in CORE scope.
- Email delivery: provider-specific key when the corresponding email path is enabled.

## Optional

- VAPID public/private key + subject.
- Google OAuth client ID/secret.

## Security rules

1. Secrets never enter repository files.
2. Readiness reports names/booleans, never secret values.
3. Production secrets use Vercel encrypted environment storage.
4. Every integration has an owner and rotation procedure before M5.
5. Secret rotation must have rollback/dual-secret strategy where provider supports it.
