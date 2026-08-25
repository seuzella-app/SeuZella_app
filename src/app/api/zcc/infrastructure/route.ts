import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { isDatabaseAvailable, db } from '@/lib/db';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { isPushEnabled } from '@/lib/push/push-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/zcc/infrastructure
 *
 * Operational readiness information observed from the running deployment.
 * This endpoint intentionally separates provider capability from proof of a
 * successful backup restore. PostgreSQL is the database engine; backup/RPO/RTO
 * claims require an explicitly configured backup provider and real drill data.
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  const transport = getActiveTransport();
  const redisConfigured = transport === 'redis';
  const bullmqAvailable = isBullMQAvailable();
  const pushEnabled = isPushEnabled();
  const databaseUrl = process.env.DATABASE_URL || '';
  const dbProvider = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')
    ? 'postgresql'
    : databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
      ? 'local'
      : 'unknown';

  const vercelInfo = {
    env: process.env.VERCEL_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
    gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown',
    deploymentUrl: process.env.VERCEL_URL || 'unknown',
  };

  let cronCount = 0;
  try {
    const { readFileSync } = await import('node:fs');
    const { resolve: resolvePath } = await import('node:path');
    const vercelJsonPath = resolvePath(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(readFileSync(vercelJsonPath, 'utf8'));
    cronCount = Array.isArray(vercelJson.crons) ? vercelJson.crons.length : 0;
  } catch {
    cronCount = -1;
  }

  const requiredEnvVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL',
    'ZEHLA_MASTER_ADMIN_EMAIL',
    'ZEHLA_MASTER_ADMIN_PASSWORD',
    'ZCC_ADMIN_EMAILS',
    'ALEXA_JWT_SECRET',
    'ENCRYPTION_SECRET',
  ];

  const optionalEnvVars = [
    'REDIS_URL',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'GLM_5_2_API_KEY',
    'ASAAS_API_KEY',
    'MERCADOPAGO_ACCESS_TOKEN',
    'WHATSAPP_TOKEN',
    'META_APP_SECRET',
    'DATABASE_BACKUP_PROVIDER',
    'DATABASE_BACKUP_RPO_HOURS',
    'DATABASE_BACKUP_RTO_MINUTES',
  ];

  const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
  const missingOptional = optionalEnvVars.filter(v => !process.env[v]);

  let activeTenants = 0;
  if (dbAvailable) {
    try {
      activeTenants = await db.tenant.count({ where: { status: 'active', isTestTenant: false } });
    } catch {
      activeTenants = 0;
    }
  }

  const backupProviderConfigured = Boolean(process.env.DATABASE_BACKUP_PROVIDER);
  const restoreTested = false;
  const configuredRpoHours = Number(process.env.DATABASE_BACKUP_RPO_HOURS || '0');
  const configuredRtoMinutes = Number(process.env.DATABASE_BACKUP_RTO_MINUTES || '0');

  const readinessReasons: string[] = [];
  if (missingRequired.length > 0) readinessReasons.push(`${missingRequired.length} required env vars missing`);
  if (!dbAvailable) readinessReasons.push('database unavailable');
  if (dbProvider === 'unknown') readinessReasons.push('database provider not identified as PostgreSQL');
  if (!backupProviderConfigured) readinessReasons.push('backup provider not configured');
  if (!restoreTested) readinessReasons.push('real backup restore not certified');
  if (cronCount < 0) readinessReasons.push('cron configuration could not be inspected');

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    vercel: vercelInfo,
    database: {
      available: dbAvailable,
      provider: dbProvider,
      activeTenants,
      backupStatus: backupProviderConfigured ? 'configured_provider' : 'not_configured',
      backupProvider: process.env.DATABASE_BACKUP_PROVIDER || 'unknown',
      rpo: configuredRpoHours > 0 ? `${configuredRpoHours}h (configured target)` : 'not validated',
      rto: configuredRtoMinutes > 0 ? `${configuredRtoMinutes} min (configured target)` : 'not validated',
      restoreTested,
    },
    redis: {
      configured: redisConfigured,
      transport,
      bullmqAvailable,
    },
    push: {
      enabled: pushEnabled,
      vapidConfigured: !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
    },
    crons: { registered: cronCount },
    environment: {
      requiredConfigured: requiredEnvVars.length - missingRequired.length,
      requiredMissing: missingRequired,
      optionalConfigured: optionalEnvVars.length - missingOptional.length,
      optionalMissing: missingOptional,
    },
    readiness: {
      status: readinessReasons.length === 0 ? 'ready' : 'not_ready',
      requiredMissing: missingRequired.length,
      optionalMissing: missingOptional.length,
      reasons: readinessReasons,
      message: readinessReasons.length === 0
        ? 'Production readiness checks passed'
        : `Not ready: ${readinessReasons.join('; ')}`,
    },
  });
}
