# Seu Zélla — Wave 4 M5 Operational Runbook

## Objective
Turn validated contracts into operational evidence before commercial go-live.

## Provider sequence
1. Asaas payment sandbox.
2. Mercado Pago payment sandbox.
3. Asaas NFS-e sandbox/authorized test.
4. WhatsApp Cloud API test recipient.
5. Replay each provider event once to prove idempotency.

## Infrastructure sequence
1. Configure Redis/Upstash.
2. Verify multi-instance transport.
3. Configure VAPID and send one background push.
4. Verify runtime/error telemetry.
5. Execute readiness and production smoke.
6. Record previous production deployment for rollback.

## Evidence rule
Every successful external operation must have a provider reference, internal reference, timestamp, environment, and outcome. Secrets are never stored as evidence.

## Promotion rule
M5 is not granted by unit tests alone. The applicable provider, infrastructure, recovery, and production-smoke evidence must exist and be reproducible.
