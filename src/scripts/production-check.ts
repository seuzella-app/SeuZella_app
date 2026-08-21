/**
 * ZÉLLA PRODUCTION PREFLIGHT — P0 GO/NO-GO
 * Fail-closed checks for the real production dependencies.
 */

import { db } from '../lib/db';
import { getRedisConnection } from '../lib/queue/bullmq-queue';
import { encryptSecret, decryptSecret } from '../lib/security/secret-vault';
import { checkSystemHealth } from '../lib/monitoring/health';

interface CheckItem {
  id: string;
  name: string;
  category: 'ENV' | 'DATABASE' | 'REDIS' | 'SECRETS' | 'HEALTH';
  isP0: boolean;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

function push(checks: CheckItem[], item: CheckItem): void {
  checks.push(item);
}

async function runProductionPreflight(): Promise<void> {
  const checks: CheckItem[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  const hasCanonicalUrl = Boolean(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL);
  push(checks, {
    id: 'ENV-01',
    name: 'Canonical production URL',
    category: 'ENV',
    isP0: true,
    status: hasCanonicalUrl ? 'PASS' : isProduction ? 'FAIL' : 'WARN',
    details: hasCanonicalUrl ? 'Canonical application URL configured.' : 'NEXTAUTH_URL or NEXT_PUBLIC_APP_URL is missing.',
  });

  const requiredProductionSecrets = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'REDIS_URL',
  ];
  const missingSecrets = isProduction
    ? requiredProductionSecrets.filter((name) => !process.env[name]?.trim())
    : [];
  push(checks, {
    id: 'ENV-02',
    name: 'Required production secrets',
    category: 'ENV',
    isP0: true,
    status: missingSecrets.length === 0 ? 'PASS' : 'FAIL',
    details: missingSecrets.length === 0 ? 'Required production secrets are present.' : `Missing required secrets: ${missingSecrets.join(', ')}`,
  });

  try {
    await db.$queryRaw`SELECT 1`;
    push(checks, {
      id: 'DB-01',
      name: 'PostgreSQL connectivity',
      category: 'DATABASE',
      isP0: true,
      status: 'PASS',
      details: 'PostgreSQL answered SELECT 1 through Prisma.',
    });
  } catch (error: unknown) {
    push(checks, {
      id: 'DB-01',
      name: 'PostgreSQL connectivity',
      category: 'DATABASE',
      isP0: true,
      status: 'FAIL',
      details: error instanceof Error ? 'PostgreSQL connectivity check failed.' : 'PostgreSQL connectivity check failed.',
    });
  }

  try {
    const redis = getRedisConnection();
    await redis.ping();
    push(checks, {
      id: 'REDIS-01',
      name: 'Redis connectivity',
      category: 'REDIS',
      isP0: true,
      status: 'PASS',
      details: 'Redis answered PING.',
    });
  } catch (error: unknown) {
    push(checks, {
      id: 'REDIS-01',
      name: 'Redis connectivity',
      category: 'REDIS',
      isP0: true,
      status: 'FAIL',
      details: error instanceof Error ? 'Redis connectivity check failed.' : 'Redis connectivity check failed.',
    });
  }

  try {
    const testSecret = 'zella_preflight_secret_validation_string_123';
    const encrypted = encryptSecret(testSecret);
    const decrypted = decryptSecret(encrypted);
    const vaultOk = decrypted === testSecret && encrypted.startsWith('v1:');
    push(checks, {
      id: 'SEC-01',
      name: 'Secret Vault round-trip',
      category: 'SECRETS',
      isP0: true,
      status: vaultOk ? 'PASS' : 'FAIL',
      details: vaultOk ? 'Secret Vault round-trip succeeded.' : 'Secret Vault round-trip failed.',
    });
  } catch {
    push(checks, {
      id: 'SEC-01',
      name: 'Secret Vault round-trip',
      category: 'SECRETS',
      isP0: true,
      status: 'FAIL',
      details: 'Secret Vault validation failed.',
    });
  }

  try {
    const health = await checkSystemHealth();
    const healthStatus = health.status === 'healthy' ? 'PASS' : isProduction ? 'FAIL' : 'WARN';
    push(checks, {
      id: 'HEALTH-01',
      name: 'System health',
      category: 'HEALTH',
      isP0: true,
      status: healthStatus,
      details: `System status: ${health.status}.`,
    });
  } catch {
    push(checks, {
      id: 'HEALTH-01',
      name: 'System health',
      category: 'HEALTH',
      isP0: true,
      status: 'FAIL',
      details: 'Health probe failed.',
    });
  }

  let hasP0Failure = false;
  for (const check of checks) {
    const icon = check.status === 'PASS' ? 'PASS' : check.status === 'WARN' ? 'WARN' : 'FAIL';
    console.log(`${check.id} | ${check.category} | ${check.isP0 ? 'P0' : 'P1'} | ${icon} | ${check.details}`);
    if (check.isP0 && check.status === 'FAIL') hasP0Failure = true;
  }

  if (hasP0Failure) {
    console.error('NO-GO: one or more P0 production checks failed.');
    process.exitCode = 1;
    return;
  }

  console.log('GO: all P0 production checks passed.');
}

runProductionPreflight().catch(() => {
  console.error('NO-GO: production preflight terminated unexpectedly.');
  process.exitCode = 1;
});
