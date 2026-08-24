# Provider E2E Checklist

## Asaas — payment
- Sandbox credential configured.
- Customer exists and tenant mapping is internal.
- PIX/checkout charge created.
- Webhook signature accepted.
- Provider event ID persisted.
- Duplicate webhook is deduplicated.
- Reservation payment reaches `approved` only from provider event.
- Financial `Transaction` is created once.
- Notification is persisted.
- Room-to-lock mapping is enforced.

## Mercado Pago — payment
- Sandbox credential configured.
- Payment or checkout created.
- `x-signature` + `x-request-id` + `data.id` validation passes.
- Provider event ID persisted.
- Duplicate notification is deduplicated.
- Reservation or subscription state transition is deterministic.

## Asaas — fiscal
- Fiscal provider configured independently from payment gateway.
- Guest NFS-e payload contains supplier/municipal data required by the provider.
- External reference maps back to the internal reservation/tenant.
- Fiscal status is persisted.
- PDF/XML/number are stored as provider references, not fabricated local values.
- Supplier-to-Zélla document is treated as an inbound vendor document, not as a Zélla-issued guest NFS-e.

## WhatsApp Cloud API
- Meta webhook verification passes.
- `x-hub-signature-256` validation passes.
- Message is tenant-resolved from the business number.
- `providerMessageId` becomes the idempotency key.
- Inbound message reaches the queue.
- Zélla response uses the Cloud API client.
- `wamid` is captured for delivery traceability.
