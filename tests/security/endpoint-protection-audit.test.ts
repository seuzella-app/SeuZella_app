/**
 * Endpoint protection audit.
 *
 * Critical mutation routes must have an explicit authentication/authorization
 * boundary. Webhooks and crons are authenticated by their own protocol/secret
 * helpers, so they are checked separately below.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.cwd());

const CRITICAL_PREFIXES = [
  'src/app/api/ddc/locks',
  'src/app/api/ddc/guests',
  'src/app/api/ddc/bookings',
  'src/app/api/ddc/housekeeping',
  'src/app/api/ddc/airb/properties',
  'src/app/api/ddc/realtime',
  'src/app/api/push',
  'src/app/api/locks/',
  'src/app/api/reservations/',
  'src/app/api/guests/',
  'src/app/api/bookings/',
  'src/app/api/push/',
];

const PUBLIC_EXEMPTIONS = [
  'src/app/api/auth/register',
  'src/app/api/auth/magic-link',
  'src/app/api/landing',
  'src/app/api/telemetry',
  'src/app/api/webhooks',
  'src/app/api/webhook-whatsapp',
  'src/app/api/checkout/webhook',
  'src/app/api/cron',
  'src/app/api/health',
  'src/app/api/push/vapid-public-key',
];

const AUTH_HELPERS = [
  'resolveTenantId',
  'withSecurity',
  'getServerSession',
  'verifyZCCAccessOrReject',
  'verifyCronAuth',
  'requireTenant',
  'requireDDCTenantId',
  'requireTenantId',
  'verifyJwtToken',
  'verifyAsaasWebhook',
  'verifyMercadoPagoWebhook',
  'verifyWhatsAppWebhook',
];

function findRouteFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) findRouteFiles(fullPath, files);
    else if (entry === 'route.ts' || entry === 'route.tsx') files.push(fullPath);
  }
  return files;
}

function isExempt(filePath: string): boolean {
  return PUBLIC_EXEMPTIONS.some((exempt) => filePath.includes(exempt));
}

function isCriticalRoute(filePath: string): boolean {
  return CRITICAL_PREFIXES.some((prefix) => filePath.includes(prefix));
}

function hasMutation(source: string): boolean {
  return /export async function (POST|PUT|DELETE|PATCH)\b/.test(source);
}

function hasAuthHelper(source: string): boolean {
  return AUTH_HELPERS.some((helper) => source.includes(helper));
}

describe('Endpoint protection audit — mutation routes must have auth', () => {
  it('ALL critical mutation routes have an explicit auth helper', () => {
    const allRoutes = findRouteFiles(resolve(root, 'src/app/api'));
    const violations: string[] = [];

    for (const route of allRoutes) {
      if (!isCriticalRoute(route) || isExempt(route)) continue;
      const source = readFileSync(route, 'utf8');
      if (hasMutation(source) && !hasAuthHelper(source)) violations.push(route);
    }

    expect(violations, `Mutation routes missing auth helper:\n${violations.join('\n')}`).toEqual([]);
  });

  it('webhook routes use signature/secret verification', () => {
    const webhookRoutes = [
      'src/app/api/webhooks/asaas/route.ts',
      'src/app/api/webhooks/mercadopago/route.ts',
    ];
    for (const route of webhookRoutes) {
      const source = readFileSync(resolve(root, route), 'utf8');
      expect(source).toMatch(/verify|webhook.*secret|signature|hmac/i);
    }
  });

  it('every mutating cron route uses verifyCronAuth', () => {
    const cronDir = resolve(root, 'src/app/api/cron');
    const cronRoutes = findRouteFiles(cronDir);
    const unverified: string[] = [];

    for (const route of cronRoutes) {
      const source = readFileSync(route, 'utf8');
      if (!hasMutation(source)) continue;
      if (!source.includes('verifyCronAuth')) unverified.push(route);
    }

    expect(unverified, `Mutating cron routes without verifyCronAuth:\n${unverified.join('\n')}`).toEqual([]);
  });

  it('public auth bootstrap routes do not enumerate tenant data', () => {
    const routes = [
      'src/app/api/auth/register/route.ts',
      'src/app/api/auth/magic-link/route.ts',
    ];
    const violations: string[] = [];

    for (const route of routes) {
      const fullPath = resolve(root, route);
      try {
        const source = readFileSync(fullPath, 'utf8');
        if (source.includes('db.tenant.findMany') || source.includes('db.tenant.findFirst')) violations.push(route);
      } catch {
        // A removed endpoint is not a security regression.
      }
    }

    expect(violations, `Public auth route enumerates tenant data:\n${violations.join('\n')}`).toEqual([]);
  });
});
