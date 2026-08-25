import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { db, isDatabaseAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET/POST /api/zcc/backup-drill
 *
 * IMPORTANT: this endpoint performs a DATABASE INTEGRITY DRILL only.
 * It does NOT restore a physical backup and must never be presented as proof
 * of backup recoverability. A real restore certification requires an isolated
 * PostgreSQL target, a real backup artifact, restore execution and RTO/RPO
 * measurement.
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbUrl = process.env.DATABASE_URL || '';
  const provider = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    ? 'postgresql'
    : dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
      ? 'local'
      : 'unknown';

  const integrity = await runDatabaseIntegrityDrill();
  const backupProviderConfigured = Boolean(process.env.DATABASE_BACKUP_PROVIDER);
  const configuredRpoHours = Number(process.env.DATABASE_BACKUP_RPO_HOURS || '0');
  const configuredRtoMinutes = Number(process.env.DATABASE_BACKUP_RTO_MINUTES || '0');

  const backupConfig = {
    provider,
    backupProviderConfigured,
    backupCapability: backupProviderConfigured ? 'configured_provider' : 'unknown',
    rpo: configuredRpoHours > 0 ? `${configuredRpoHours}h (configured target)` : 'not validated',
    rto: configuredRtoMinutes > 0 ? `${configuredRtoMinutes} min (configured target)` : 'not validated',
    restoreCertified: false,
    lastIntegrityDrillAt: integrity.timestamp,
    lastIntegrityDrillPassed: integrity.allPassed,
  };

  return NextResponse.json({
    success: true,
    backup: backupConfig,
    integrityDrill: integrity,
    recommendations: generateRecommendations(integrity, provider, backupProviderConfigured),
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const integrity = await runDatabaseIntegrityDrill();

  return NextResponse.json({
    success: true,
    restoreCertified: false,
    integrityDrill: integrity,
    timestamp: new Date().toISOString(),
  });
}

interface DatabaseIntegrityDrillResult {
  dbAvailable: boolean;
  schemaIntegrity: boolean;
  dataIntegrity: boolean;
  activeTenantsCount: number;
  totalModelsChecked: number;
  queryLatencyMs: number;
  errors: string[];
  allPassed: boolean;
  timestamp: string;
}

async function runDatabaseIntegrityDrill(): Promise<DatabaseIntegrityDrillResult> {
  const result: DatabaseIntegrityDrillResult = {
    dbAvailable: false,
    schemaIntegrity: false,
    dataIntegrity: false,
    activeTenantsCount: 0,
    totalModelsChecked: 0,
    queryLatencyMs: 0,
    errors: [],
    allPassed: false,
    timestamp: new Date().toISOString(),
  };

  const start = Date.now();

  result.dbAvailable = await isDatabaseAvailable();
  if (!result.dbAvailable) {
    result.errors.push('Database is unavailable — integrity could not be verified');
    result.queryLatencyMs = Date.now() - start;
    return result;
  }

  try {
    const tenantCount = await db.tenant.count({ where: { status: 'active', isTestTenant: false } }).catch(() => -1);
    result.schemaIntegrity = tenantCount >= 0;
    result.activeTenantsCount = tenantCount;
    if (!result.schemaIntegrity) result.errors.push('Core tenant table is not queryable');
  } catch (err) {
    result.errors.push(`Schema integrity error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  try {
    const [tenants, locks, guests, bookings] = await Promise.all([
      db.tenant.count().catch(() => -1),
      (db as any).lockDevice?.count?.().catch(() => -1) ?? -1,
      (db as any).guest?.count?.().catch(() => -1) ?? -1,
      (db as any).booking?.count?.().catch(() => -1) ?? -1,
    ]);
    result.dataIntegrity = [tenants, locks, guests, bookings].every((count) => count >= 0);
    result.totalModelsChecked = 4;
    if (!result.dataIntegrity) result.errors.push('One or more core data integrity checks failed');
  } catch (err) {
    result.errors.push(`Data integrity error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  result.queryLatencyMs = Date.now() - start;
  result.allPassed = result.dbAvailable && result.schemaIntegrity && result.dataIntegrity;

  logger.info('[BackupDrill] Database integrity drill completed', {
    allPassed: result.allPassed,
    latencyMs: result.queryLatencyMs,
    activeTenants: result.activeTenantsCount,
    errors: result.errors,
  });

  return result;
}

function generateRecommendations(
  drill: DatabaseIntegrityDrillResult,
  provider: string,
  backupProviderConfigured: boolean,
): string[] {
  const recs: string[] = [];

  if (!drill.dbAvailable) recs.push('CRITICAL: Database unavailable — investigate connectivity before production use');
  if (!drill.schemaIntegrity) recs.push('WARNING: Schema integrity check failed — validate Prisma migrations');
  if (drill.queryLatencyMs > 1000) recs.push(`WARNING: DB query latency ${drill.queryLatencyMs}ms — investigate connection pool or slow queries`);
  if (provider === 'unknown') recs.push('WARNING: DATABASE_URL provider could not be identified as PostgreSQL');
  if (!backupProviderConfigured) recs.push('WARNING: No DATABASE_BACKUP_PROVIDER is configured; backup retention and restore capability are not certified');
  if (drill.allPassed) recs.push('OK: Database integrity drill passed — operational data is accessible and queryable');

  return recs;
}
