# Production Environment Matrix

| Capability | Required | Owner | Validation | Evidence |
|---|---|---|---|---|
| Core auth | NEXTAUTH_SECRET/NEXTAUTH_URL | Auth/Infra | readiness + login | deployment |
| Database | DATABASE_URL | Infra | health/readiness | connection + restore |
| Asaas | ASAAS_API_KEY | Billing/Fiscal | provider smoke | event/reference |
| Mercado Pago | MERCADOPAGO_ACCESS_TOKEN | Billing | provider smoke | event/reference |
| WhatsApp | META_ACCESS_TOKEN/META_PHONE_NUMBER_ID/META_APP_SECRET/META_VERIFY_TOKEN | Integrations | webhook + send | wamid |
| Redis | REDIS_URL | Infra | transport test | instance/event |
| Push | VAPID_* | PWA | background push | push receipt |
| Monitoring | Sentry/Vercel | SRE | synthetic error | alert id |

## Rollback
Record the previous READY production deployment before promotion. A promotion is incomplete until the prior deployment is known and reversible.
