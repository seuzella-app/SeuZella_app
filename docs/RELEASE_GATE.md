# Release Gate — Seu Zélla

A branch is eligible for merge only when all applicable gates are green.

## Gate order
1. TypeScript: `npx tsc --noEmit` — zero errors.
2. Unit/integration/security tests — green.
3. E2E suite — no unexpected skips for the target environment.
4. Build — `npx prisma generate && next build` succeeds.
5. Vercel deployment — READY/SUCCESS.
6. Production health — `/api/health` healthy.
7. Readiness — required checks ready for the current maturity level.
8. Tenant isolation canaries — cross-tenant access denied.
9. Rollback path — previous production deployment identified and reversible.

## Stop rules
Do not merge with an unresolved P0, a failed build, a failed security gate, or an undocumented operational dependency.
