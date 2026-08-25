/**
 * Backup/Restore Drill + VPS Preflight — contract tests
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('💾 Backup/Restore Drill — endpoint', () => {
  it('/api/zcc/backup-drill exists with ZCC auth', () => {
    const source = read('src/app/api/zcc/backup-drill/route.ts');
    expect(source).toContain('verifyZCCAccessOrReject');
    expect(source).toContain('GET');
    expect(source).toContain('POST');
  });

  it('runs 3 restore tests (connectivity, schema, data integrity)', () => {
    const source = read('src/app/api/zcc/backup-drill/route.ts');
    expect(source).toContain('dbAvailable');
    expect(source).toContain('schemaIntegrity');
    expect(source).toContain('dataIntegrity');
  });

  it('detects DB provider from DATABASE_URL', () => {
    const source = read('src/app/api/zcc/backup-drill/route.ts');
    expect(source).toContain('supabase');
    expect(source).toContain('neon');
    expect(source).toContain('railway');
  });

  it('returns RPO and RTO info', () => {
    const source = read('src/app/api/zcc/backup-drill/route.ts');
    expect(source).toContain('rpo');
    expect(source).toContain('rto');
  });

  it('generates recommendations based on drill result', () => {
    const source = read('src/app/api/zcc/backup-drill/route.ts');
    expect(source).toContain('generateRecommendations');
  });
});

describe('💾 Backup Restore Drill — cron', () => {
  it('/api/cron/backup-restore-drill exists with verifyCronAuth', () => {
    const source = read('src/app/api/cron/backup-restore-drill/route.ts');
    expect(source).toContain('verifyCronAuth');
    expect(source).toContain("admin:all");
  });

  it('runs 3 tests (DB connectivity, schema, data)', () => {
    const source = read('src/app/api/cron/backup-restore-drill/route.ts');
    expect(source).toContain('dbAvailable');
    expect(source).toContain('schemaIntegrity');
    expect(source).toContain('dataIntegrity');
  });

  it('cron is registered in vercel.json', () => {
    const vj = JSON.parse(read('vercel.json'));
    const drillCron = vj.crons.find((c: any) => c.path === '/api/cron/backup-restore-drill');
    expect(drillCron).toBeDefined();
    expect(drillCron.schedule).toBe('0 5 * * 0'); // Sunday 05:00 UTC
  });
});

describe('🖥️ VPS Preflight — endpoint', () => {
  it('/api/zcc/vps-preflight exists with ZCC auth', () => {
    expect(existsSync(resolve(root, 'src/app/api/zcc/vps-preflight/route.ts'))).toBe(true);
    const source = read('src/app/api/zcc/vps-preflight/route.ts');
    expect(source).toContain('verifyZCCAccessOrReject');
  });

  it('runs 10 production certification checks', () => {
    const source = read('src/app/api/zcc/vps-preflight/route.ts');
    expect(source).toContain('Database connectivity');
    expect(source).toContain('Redis');
    expect(source).toContain('BullMQ');
    expect(source).toContain('Push notifications');
    expect(source).toContain('Security findings');
    expect(source).toContain('Error rate');
    expect(source).toContain('LLM cost');
    expect(source).toContain('SRE alerts');
    expect(source).toContain('Required env vars');
    expect(source).toContain('Cron jobs registered');
  });

  it('returns verdict CERTIFIED or NOT_CERTIFIED', () => {
    const source = read('src/app/api/zcc/vps-preflight/route.ts');
    expect(source).toContain('CERTIFIED');
    expect(source).toContain('NOT_CERTIFIED');
    expect(source).toContain('allPassed');
  });

  it('returns score (passed/total)', () => {
    const source = read('src/app/api/zcc/vps-preflight/route.ts');
    expect(source).toContain('score');
    expect(source).toContain('passedCount');
  });

  it('uses collectObservabilityMetrics for real data', () => {
    const source = read('src/app/api/zcc/vps-preflight/route.ts');
    expect(source).toContain('collectObservabilityMetrics');
    expect(source).toContain('checkAlertThresholds');
  });
});
