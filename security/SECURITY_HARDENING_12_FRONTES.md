# Security Hardening — 12 Frontes

This marker records the final validation scope for the security-hardening branch.

## 12 fronts
1. Authentication and tenant context
2. ZCC privileged access
3. Agent API tenant isolation and validation
4. CI/CD security gates
5. Distributed rate limiting
6. Asaas/payment webhook hardening
7. Queue/worker tenant isolation
8. SSRF-safe external fetch
9. Production environment/secrets
10. API authorization inventory
11. Webhook replay/idempotency and billing state integrity
12. Observability/PII redaction and production fail-closed behavior

## Acceptance
- No production authentication bypasses.
- Tenant identity is server-derived.
- Privileged ZCC access requires authenticated authorized identity.
- Production security dependencies fail closed.
- External callbacks are authenticated, replay-resistant, tenant-bound and idempotent.
- Workers preserve tenant context.
- External fetches enforce timeout, size, HTTPS, redirect and private-network controls.
- CI security gates fail the pipeline.
- Logs must not expose secrets or sensitive guest credentials.

This file is documentation only and does not replace automated tests.
