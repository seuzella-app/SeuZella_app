/**
 * Observability + SRE + Infrastructure — contract tests
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('📊 Observability / SRE Service', () => {
  it('sre-service.ts exports collectObservabilityMetrics', async () => {
    const mod = await import('@/lib/observability/sre-service');
    expect(typeof mod.collectObservabilityMetrics).toBe('function');
  });

  it('exports checkAlertThresholds', async () => {
    const mod = await import('@/lib/observability/sre-service');
    expect(typeof mod.checkAlertThresholds).toBe('function');
  });

  it('collects real DB metrics (tenants, transactions, bookings, locks)', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain('db.tenant.count');
    expect(source).toContain('activeTenants');
    expect(source).toContain('totalTransactions');
    expect(source).toContain('totalBookings');
    expect(source).toContain('totalLockDevices');
    expect(source).toContain('queryLatencyMs');
  });

  it('collects LLM cost from MetaCostLog', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain('metaCostLog');
    expect(source).toContain('costUsd');
    expect(source).toContain('llmCostUsdThisMonth');
  });

  it('collects security findings count', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain('securityFinding');
    expect(source).toContain('criticalFindings');
    expect(source).toContain('highFindings');
  });

  it('collects error metrics (cerebro, webhook, cron failures)', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain('cerebroAnalysisErrors');
    expect(source).toContain('webhookFailures');
    expect(source).toContain('cronFailures');
    expect(source).toContain('last24h');
  });

  it('has alert thresholds for DB down, critical findings, webhook failures, LLM cost', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain('database.available');
    expect(source).toContain('criticalFindings > 0');
    expect(source).toContain('webhookFailures > 5');
    expect(source).toContain('llmCostUsdThisMonth > 15');
    expect(source).toContain('queryLatencyMs');
    expect(source).toContain('500');
  });

  it('determines overall status (healthy/degraded/down)', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).toContain("'healthy'");
    expect(source).toContain("'degraded'");
    expect(source).toContain("'down'");
  });

  it('uses NO OpenAI or Anthropic (100% DB + Redis)', () => {
    const source = read('src/lib/observability/sre-service.ts');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('ANTHROPIC_API_KEY');
  });
});

describe('📊 /api/zcc/observability endpoint', () => {
  it('exists with ZCC auth', () => {
    const source = read('src/app/api/zcc/observability/route.ts');
    expect(source).toContain('verifyZCCAccessOrReject');
    expect(source).toContain('collectObservabilityMetrics');
    expect(source).toContain('checkAlertThresholds');
  });

  it('returns metrics + alerts + alertCount', () => {
    const source = read('src/app/api/zcc/observability/route.ts');
    expect(source).toContain('metrics');
    expect(source).toContain('alerts');
    expect(source).toContain('alertCount');
    expect(source).toContain('criticalAlertCount');
  });
});

describe('📊 /api/cron/sre-alerts endpoint', () => {
  it('exists with verifyCronAuth', () => {
    const source = read('src/app/api/cron/sre-alerts/route.ts');
    expect(source).toContain('verifyCronAuth');
    expect(source).toContain("admin:all");
    expect(source).toContain('collectObservabilityMetrics');
    expect(source).toContain('checkAlertThresholds');
  });

  it('publishes realtime alert for critical/warning findings', () => {
    const source = read('src/app/api/cron/sre-alerts/route.ts');
    expect(source).toContain('publishTenantEvent');
    expect(source).toContain('sre_alert');
    expect(source).toContain('criticalAlerts');
    expect(source).toContain('warningAlerts');
  });
});

describe('📊 /api/zcc/infrastructure endpoint', () => {
  it('exists with ZCC auth', () => {
    expect(existsSync(resolve(root, 'src/app/api/zcc/infrastructure/route.ts'))).toBe(true);
    const source = read('src/app/api/zcc/infrastructure/route.ts');
    expect(source).toContain('verifyZCCAccessOrReject');
  });

  it('returns Vercel deployment info', () => {
    const source = read('src/app/api/zcc/infrastructure/route.ts');
    expect(source).toContain('VERCEL_ENV');
    expect(source).toContain('VERCEL_GIT_COMMIT_SHA');
    expect(source).toContain('VERCEL_REGION');
  });

  it('returns database provider + backup status (RPO/RTO)', () => {
    const source = read('src/app/api/zcc/infrastructure/route.ts');
    expect(source).toContain('supabase');
    expect(source).toContain('neon');
    expect(source).toContain('backupStatus');
    expect(source).toContain('rpo');
    expect(source).toContain('rto');
  });

  it('returns env var configuration status (required vs optional)', () => {
    const source = read('src/app/api/zcc/infrastructure/route.ts');
    expect(source).toContain('requiredEnvVars');
    expect(source).toContain('optionalEnvVars');
    expect(source).toContain('missingRequired');
    expect(source).toContain('missingOptional');
    expect(source).toContain('readiness');
  });

  it('returns Redis + BullMQ + Push status', () => {
    const source = read('src/app/api/zcc/infrastructure/route.ts');
    expect(source).toContain('getActiveTransport');
    expect(source).toContain('isBullMQAvailable');
    expect(source).toContain('isPushEnabled');
  });
});

describe('📊 vercel.json — SRE alerts cron', () => {
  it('has sre-alerts cron at 07:00 UTC (04:00 BRT)', () => {
    const vj = JSON.parse(read('vercel.json'));
    const sreCron = vj.crons.find((c: any) => c.path === '/api/cron/sre-alerts');
    expect(sreCron).toBeDefined();
    expect(sreCron.schedule).toBe('0 7 * * *');
  });
});
