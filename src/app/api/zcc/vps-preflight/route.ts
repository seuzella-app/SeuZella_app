import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { isDatabaseAvailable } from '@/lib/db';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { isPushEnabled } from '@/lib/push/push-service';
import { collectObservabilityMetrics, checkAlertThresholds } from '@/lib/observability/sre-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/zcc/vps-preflight
 *
 * VPS Production Certification — checks if the system is ready for
 * production traffic on VPS.
 *
 * Checks:
 *   1. Database connectivity + latency
 *   2. Redis configured (multi-instance SSE)
 *   3. BullMQ available (durable queue)
 *   4. Push notifications configured (VAPID)
 *   5. Security findings (0 critical/high open)
 *   6. Error rate (webhook/cron failures < threshold)
 *   7. LLM cost within budget (< $20/month)
 *   8. Env vars (all required configured)
 *   9. SRE alerts (0 critical alerts active)
 *   10. Cron health (all crons registered)
 *
 * Returns: { passed: boolean, checks: [], missing: [] }
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const missing: string[] = [];

  // 1. Database
  const dbAvailable = await isDatabaseAvailable();
  checks.push({
    name: 'Database connectivity',
    passed: dbAvailable,
    detail: dbAvailable ? 'Connected' : 'DATABASE_URL not configured or unreachable',
  });
  if (!dbAvailable) missing.push('DATABASE_URL');

  // 2. Redis
  const redisConfigured = getActiveTransport() === 'redis';
  checks.push({
    name: 'Redis (multi-instance SSE)',
    passed: redisConfigured,
    detail: redisConfigured ? 'Redis active' : 'Using in-memory fallback — set REDIS_URL',
  });
  if (!redisConfigured) missing.push('REDIS_URL');

  // 3. BullMQ
  const bullmqAvailable = isBullMQAvailable();
  checks.push({
    name: 'BullMQ durable queue',
    passed: bullmqAvailable,
    detail: bullmqAvailable ? 'Workers ready' : 'BullMQ unavailable — requires Redis',
  });

  // 4. Push
  const pushEnabled = isPushEnabled();
  checks.push({
    name: 'Push notifications (VAPID)',
    passed: pushEnabled,
    detail: pushEnabled ? 'VAPID configured' : 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set',
  });
  if (!pushEnabled) missing.push('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY');

  // 5. Security findings (from observability metrics)
  try {
    const metrics = await collectObservabilityMetrics();
    checks.push({
      name: 'Security findings (0 critical)',
      passed: metrics.security.criticalFindings === 0,
      detail: `${metrics.security.criticalFindings} critical, ${metrics.security.highFindings} high open`,
    });

    // 6. Error rate
    checks.push({
      name: 'Error rate (webhook < 5, cerebro < 10)',
      passed: metrics.errors.webhookFailures < 5 && metrics.errors.cerebroAnalysisErrors < 10,
      detail: `${metrics.errors.webhookFailures} webhook fails, ${metrics.errors.cerebroAnalysisErrors} cerebro errors (24h)`,
    });

    // 7. LLM cost
    checks.push({
      name: 'LLM cost within budget (< $20)',
      passed: metrics.costs.llmCostUsdThisMonth < 20,
      detail: `$${metrics.costs.llmCostUsdThisMonth.toFixed(2)} this month (budget $20)`,
    });

    // 8. SRE alerts
    const alerts = checkAlertThresholds(metrics);
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    checks.push({
      name: 'SRE alerts (0 critical)',
      passed: criticalAlerts.length === 0,
      detail: `${criticalAlerts.length} critical, ${alerts.filter(a => a.level === 'warning').length} warning`,
    });
  } catch {
    checks.push({ name: 'Observability metrics', passed: false, detail: 'Failed to collect' });
  }

  // 9. Env vars
  const requiredEnvs = [
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'DATABASE_URL',
    'ZEHLA_MASTER_ADMIN_EMAIL', 'ZEHLA_MASTER_ADMIN_PASSWORD',
    'ZCC_ADMIN_EMAILS', 'ALEXA_JWT_SECRET', 'ENCRYPTION_SECRET',
  ];
  const missingEnvs = requiredEnvs.filter(v => !process.env[v]);
  checks.push({
    name: 'Required env vars (8/8)',
    passed: missingEnvs.length === 0,
    detail: missingEnvs.length === 0 ? 'All configured' : `Missing: ${missingEnvs.join(', ')}`,
  });
  if (missingEnvs.length > 0) missing.push(...missingEnvs);

  // 10. Cron health
  let cronCount = 0;
  try {
    const { readFileSync } = await import('node:fs');
    const { resolve: resolvePath } = await import('node:path');
    const vj = JSON.parse(readFileSync(resolvePath(process.cwd(), 'vercel.json'), 'utf8'));
    cronCount = (vj.crons || []).length;
  } catch {}
  checks.push({
    name: 'Cron jobs registered',
    passed: cronCount >= 25,
    detail: `${cronCount} crons registered (target >= 25)`,
  });

  // Overall verdict
  const allPassed = checks.every(c => c.passed);
  const passedCount = checks.filter(c => c.passed).length;

  return NextResponse.json({
    success: true,
    verdict: allPassed ? 'CERTIFIED' : 'NOT_CERTIFIED',
    passed: allPassed,
    score: `${passedCount}/${checks.length}`,
    checks,
    missing,
    timestamp: new Date().toISOString(),
  });
}
