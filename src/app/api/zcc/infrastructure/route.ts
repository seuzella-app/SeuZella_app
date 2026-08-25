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
 * Operational readiness information for the ZCC. This endpoint reports facts
 * that can be observed from the running deployment; it deliberately does not
 * claim that a backup has been restored unless a real restore drill recorded it.
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  const transport = getActiveTransport();
  const redisConfigured = transport === 'redis';
  const bullmqAvailable = isBullMQAvailable();
  const pushEnabled = isPushEnabled();

  const dbProvider = process.env.DATABASE_URL?.includes('supabase') ? 'supabase'
    : process.env.DATABASE_URL?.includes('neon') ? 'neon'
    : process.env.DATABASE_URL?.includes('railway') ? 'railway'
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
    // Unknown is safer than inventing a count.
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
  ];

  const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
  const missingOptional = optionalEnvVars.filter(v => !process.env[v]);

  let activeTenants = 0;
  if (dbAvailable) {
    try {
      activeTenants = await db.tenant.count({ where: { status: 'active', isTestTenant: false } });
    } catch {
      // Keep the value conservative and expose DB availability separately.
      activeTenants = 0;
    }
  }

  // Provider-managed backups are a capability statement, not proof of a tested restore.
  const providerBackupAvailable = dbProvider !== 'unknown';
  const restoreTested = false;
  const rpoStatus = providerBackupAvailable ? 'provider-managed; verify retention policy' : 'not configured';
  const rtoStatus = restoreTested ? 'validated by restore drill' : 'not validated';

  const readinessReasons: string[] = [];
  if (missingRequired.length > 0) readinessReasons.push(`${missingRequired.length} required env vars missing`);
  if (!dbAvailable) readinessReasons.push('database unavailable');
  if (!providerBackupAvailable) readinessReasons.push('database backup provider not identified');
  if (!restoreTested) readinessReasons.push('backup restore drill not validated');
  if (cronCount < 0) readinessReasons.push('cron configuration could not be inspected');

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    vercel: vercelInfo,
    database: {
      available: dbAvailable,
      provider: dbProvider,
      activeTenants,
      backupStatus: rpoStatus,
      rpo: rpoStatus,
      rto: rtoStatus,
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
    crons: {
      registered: cronCount,
    },
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
