# Zélla Production Go-Live Runbook

## Gate 1 — Application

- `npm ci`
- `npm run typecheck`
- `npm run test`
- `npm run test:sast`
- `npm run production:check`
- `npm run build`

All gates must exit 0.

## Gate 2 — Database

1. Confirm a current backup exists.
2. Confirm the migration set is reviewed.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma validate`.
5. Verify tenant-scoped reads/writes with a non-production smoke tenant.

## Gate 3 — Workers and Redis

1. Confirm Redis persistence and authentication.
2. Install `deploy/systemd/zehla-workers.service`.
3. `sudo systemctl daemon-reload`.
4. `sudo systemctl enable --now zehla-workers`.
5. Verify worker logs and queue depth.
6. Verify failed jobs and DLQ handling.

## Gate 4 — Payments and Webhooks

- Use sandbox/test credentials first.
- Send one signed Asaas webhook and one Mercado Pago webhook.
- Confirm idempotency.
- Confirm tenant association.
- Confirm no provider secret appears in logs.

## Gate 5 — Smart Locks / Alexa

- Use a test property only.
- Verify OAuth/account linking.
- Verify discovery returns only tenant-owned locks.
- Verify lock/unlock authorization.
- Verify unlock PIN policy.
- Verify audit event creation.

## Gate 6 — Rollback

Before deployment, record the current application image/commit and database migration state.

If smoke tests fail:

1. Stop new traffic.
2. Preserve logs and request IDs.
3. Roll application back to the previous known-good commit/image.
4. Do not run destructive database rollback commands automatically.
5. Restore the database only through the approved backup procedure.

## Go / No-Go

Go only when every P0 gate is green and the rollback point is documented.
