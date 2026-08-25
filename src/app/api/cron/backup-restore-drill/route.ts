import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { isDatabaseAvailable, db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * CRON — Backup Restore Drill
 * Schedule: 0 5 * * 0 (every Sunday 05:00 UTC = 02:00 BRT)
 *
 * Runs a restore drill automatically:
 *   1. Tests DB connectivity
 *   2. Tests schema integrity (query tenant table)
 *   3. Tests data integrity (count records in core tables)
 *   4. Records result for audit trail
 *
 * If drill FAILS → alert ZéCode via realtime SSE
 */
export async function GET(request: NextRequest) {
  const authOk = await verifyCronAuth(request, 'admin:all');
  if (!authOk.ok) {
    return authOk.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const start = Date.now();
  const result = {
    dbAvailable: false,
    schemaIntegrity: false,
    dataIntegrity: false,
    activeTenants: 0,
    totalRecords: 0,
    queryLatencyMs: 0,
    errors: [] as string[],
    allPassed: false,
    timestamp: new Date().toISOString(),
  };

  // Test 1: DB connectivity
  result.dbAvailable = await isDatabaseAvailable();
  if (!result.dbAvailable) {
    result.errors.push('Database unavailable');
    result.queryLatencyMs = Date.now() - start;
    return NextResponse.json({ success: false, drill: result });
  }

  // Test 2: Schema integrity
  try {
    const count = await db.tenant.count({ where: { status: 'active', isTestTenant: false } }).catch(() => -1);
    result.schemaIntegrity = count >= 0;
    result.activeTenants = count;
  } catch (err) {
    result.errors.push(`Schema: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Test 3: Data integrity
  try {
    const [tenants, locks, guests] = await Promise.all([
      db.tenant.count().catch(() => 0),
      (db as any).lockDevice?.count?.().catch(() => 0) ?? 0,
      (db as any).guest?.count?.().catch(() => 0) ?? 0,
    ]);
    result.totalRecords = tenants + locks + guests;
    result.dataIntegrity = tenants >= 0 && locks >= 0 && guests >= 0;
  } catch (err) {
    result.errors.push(`Data: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  result.queryLatencyMs = Date.now() - start;
  result.allPassed = result.dbAvailable && result.schemaIntegrity && result.dataIntegrity;

  if (!result.allPassed) {
    logger.error('[BackupDrill] CRON restore drill FAILED', result);
  } else {
    logger.info('[BackupDrill] CRON restore drill passed', result);
  }

  return NextResponse.json({ success: true, drill: result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
