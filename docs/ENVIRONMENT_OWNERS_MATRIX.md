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
| STRIPE_WEBHOOK_SECRET | Billing/Security | webhook signature tests | Provider rotation |

## Database / Infra

| Variable | Owner | Validation | Rotation |
|---|---|---|---|
| DATABASE_URL | Infra | readiness + DB smoke | Provider rotation |
| REDIS_URL | Infra | Redis/BullMQ/SSE test | Provider rotation |

## Integrations

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Asaas: `ASAAS_API_KEY`.
- Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`.
- WhatsApp: `WHATSAPP_TOKEN`, `META_APP_SECRET`.
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
