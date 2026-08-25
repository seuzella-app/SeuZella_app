import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { runFullSecurityScan, type SecurityFinding } from '@/lib/security/security-scan-service';
import { db, isDatabaseAvailable } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * ZCC Security API — endpoints for the ZéCode security panel
 * ============================================================================
 *
 * GET  /api/zcc/security — list recent findings
 * POST /api/zcc/security/scan — trigger manual scan
 * PATCH /api/zcc/security/finding/[id] — update finding status
 */

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    // Get recent findings from DB (last 7 days)
    let findings: SecurityFinding[] = [];

    if (await isDatabaseAvailable()) {
      const dbFindings = await (db as any).securityFinding?.findMany({
        orderBy: { scannedAt: 'desc' },
        take: 100,
      }).catch(() => []);

      if (dbFindings && dbFindings.length > 0) {
        findings = dbFindings.map((f: any) => ({
          id: f.id,
          scanType: f.scanType,
          title: f.title,
          description: f.description,
          severity: f.severity,
          status: f.status,
          file: f.file || undefined,
          line: f.line || undefined,
          cwe: f.cwe || undefined,
          cvss: f.cvss || undefined,
          exploitPayload: f.exploitPayload || undefined,
          remediation: f.remediation || undefined,
          autoFixAttempted: f.autoFixAttempted || false,
          autoFixPrUrl: f.autoFixPrUrl || undefined,
          scannedAt: f.scannedAt?.toISOString() || '',
          createdAt: f.createdAt?.toISOString() || '',
        }));
      }
    }

    // Summary stats
    const summary = {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      open: findings.filter(f => f.status === 'open').length,
      fixed: findings.filter(f => f.status === 'fixed').length,
      falsePositive: findings.filter(f => f.status === 'false_positive').length,
    };

    return NextResponse.json({
      success: true,
      findings,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'FETCH_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

/**
 * POST — trigger manual scan (ZéCode clicks "Run Scan Now" in ZCC)
 */
export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const result = await runFullSecurityScan();

    return NextResponse.json({
      success: true,
      summary: {
        total: result.totalFound,
        critical: result.criticalCount,
        high: result.highCount,
        mode: result.mode,
        durationMs: result.scanDurationMs,
      },
      findings: result.findings,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'SCAN_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
