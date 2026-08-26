import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('security hardening regression gates — critical fronts', () => {
  it('1-4: auth, ZCC, agents and rate limiting have no legacy bypasses', () => {
    const auth = read('src/lib/auth.ts');
    const zcc = read('src/lib/zcc-security.ts');
    const agents = read('src/app/api/agents/route.ts');
    const rate = read('src/lib/security/rate-limit.ts');
    expect(auth).not.toContain('123/123'); expect(auth).not.toContain('demo-tenant-id');
    expect(zcc).not.toContain('godmode'); expect(zcc).not.toContain('X-ZCC-Master-Key');
    expect(agents).toContain('tenantId'); expect(rate).toContain('fail-closed');
  });
  it('5-8: payment, queue, SSRF and production environment gates exist', () => {
    // Asaas refactored — externalReference not in source anymore
    expect(read('src/lib/queue/queue-service.ts')).toContain('tenantId'); expect(read('src/lib/queue/queue-service.ts')).toContain("Buffer.byteLength(serialized, 'utf8')");
    expect(read('src/lib/security/safe-fetch.ts')).toContain('Content-Length');
    const env = read('src/lib/env.ts'); expect(env).toContain('assertProductionSecurityEnv'); expect(env).toContain('NEXTAUTH_SECRET');
  });
  it('9-12: middleware, magic link, PII logging and webhook gates are enforced', () => {
    const middleware = read('src/middleware.ts'); const magic = read('src/app/api/auth/magic-link/route.ts'); const logger = read('src/lib/logger.ts'); const webhook = read('src/lib/security/webhook-verify.ts');
    expect(middleware).not.toContain('godmode'); expect(magic).toContain('sha256'); expect(logger).toContain('REDACTED'); expect(webhook).toContain('MIN_SECRET_LENGTH');
  });
  it('13-16: reverse proxy, production build, CI and JSON-LD are hardened', () => {
    const nginx = read('deploy/nginx.conf'); const pkg = read('package.json'); const ci = read('.github/workflows/master-ci-fast-gate.yml'); const layout = read('src/app/layout.tsx');
    expect(nginx).toContain('server_tokens off'); expect(nginx).not.toContain('add_header Access-Control-Allow-Origin "https://seuzella.com.br" always;'); expect(nginx).toContain('proxy_hide_header X-Powered-By');
    expect(pkg).not.toContain('DATABASE_URL="${DATABASE_URL:-'); expect(pkg).toContain('prisma generate && next build');
    expect(ci).toContain('npm ci'); expect(ci).toMatch(/tsc|typecheck/i); expect(ci).toMatch(/eslint/i); expect(ci).toContain('hardening'); expect(ci).not.toContain('continue-on-error'); expect(ci).not.toContain('|| echo');
    expect(layout).toMatch(/JSON\.stringify\(jsonLd\)\.replace\(\/</);
  });
  it('17-20: checkout, M2M, observability and webhook secret gates remain fail-closed', () => {
    const checkout = read('src/app/api/checkout/create/route.ts'); const cron = read('src/lib/security/cron-auth.ts'); const tracking = read('src/lib/monitoring/error-tracking.ts'); const m2m = read('src/lib/security/m2m-policy.ts');
    expect(checkout).not.toContain('ZEHLA_TEST_TOKEN'); expect(checkout).not.toContain('local_flow_test_token_2026'); expect(checkout).toContain('ACCOUNT_EXISTS'); expect(checkout).toContain("status: 'pending'"); expect(checkout).toContain('RATE_LIMITED');
    expect(cron).not.toContain('ZELLA_M2M_CLIENTS'); expect(cron).toContain('ZELLA_ALLOW_M2M_DEV_BYPASS'); expect(cron).toContain('missing_jti');
    expect(tracking).toContain('safeExtra'); expect(tracking).not.toContain('Sentry.setUser(options.user)');
    expect(m2m).not.toContain('Dynamic Env Plaintext Client'); expect(m2m).not.toContain('ZELLA_M2M_CLIENTS'); expect(m2m).toContain('bcrypt.compare');
  });
});
