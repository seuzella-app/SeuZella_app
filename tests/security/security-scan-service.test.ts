/**
 * Security Scan Service + ZCC Panel — contract tests
 *
 * Validates:
 *   1. security-scan-service.ts exports runFullSecurityScan + generateAutoFix
 *   2. Uses GLM 5.2 (not OpenAI/Anthropic)
 *   3. Cron endpoint exists with verifyCronAuth
 *   4. ZCC security API endpoint exists with ZCC auth
 *   5. SecurityPanel component is wired in ZCC shell
 *   6. SecurityFinding Prisma model exists
 *   7. vercel.json has security-scan cron at 06:00 UTC (03:00 BRT)
 *   8. vercel.json does NOT have orphan caution-auto-return
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Security Scan Service — GLM 5.2 integration', () => {
  it('security-scan-service.ts exports runFullSecurityScan', async () => {
    const mod = await import('@/lib/security/security-scan-service');
    expect(typeof mod.runFullSecurityScan).toBe('function');
  });

  it('exports generateAutoFix', async () => {
    const mod = await import('@/lib/security/security-scan-service');
    expect(typeof mod.generateAutoFix).toBe('function');
  });

  it('uses GLM 5.2 config (NOT OpenAI/Anthropic)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('GLM_5_2_API_KEY');
    expect(source).toContain('GLM_BASE_URL');
    expect(source).toContain('GLM_MODEL');
    expect(source).toContain('callOpenAICompatible');
    // Must NOT reference OpenAI or Anthropic API keys
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('ANTHROPIC_API_KEY');
  });

  it('has 3 scan types: SAST, Pentest, Secret scan', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('runSastScan');
    expect(source).toContain('runPentestScan');
    expect(source).toContain('runSecretScan');
  });

  it('publishes alerts for critical/high findings', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('publishTenantEvent');
    expect(source).toContain("severity === 'critical'");
    expect(source).toContain("severity === 'high'");
    expect(source).toContain('security_alert');
  });

  it('has auto-fix prompt that generates patches', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('AUTOFIX_PROMPT');
    expect(source).toContain('SECURITY FIX');
    expect(source).toContain('generateAutoFix');
  });

  it('has mock mode fallback (no GLM key required)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('mock');
    expect(source).toContain('isLive');
    expect(source).toContain('CEREBRO_LIVE_MODE');
  });
});

describe('Cron endpoint — /api/cron/security-scan', () => {
  it('exists with verifyCronAuth', () => {
    const source = read('src/app/api/cron/security-scan/route.ts');
    expect(source).toContain('verifyCronAuth');
    expect(source).toContain("admin:all");
    expect(source).toContain('runFullSecurityScan');
  });

  it('has maxDuration 300 (5 min)', () => {
    const source = read('src/app/api/cron/security-scan/route.ts');
    expect(source).toContain('maxDuration');
    expect(source).toContain('300');
  });
});

describe('ZCC Security API — /api/zcc/security', () => {
  it('exists with ZCC auth (verifyZCCAccessOrReject)', () => {
    const source = read('src/app/api/zcc/security/route.ts');
    expect(source).toContain('verifyZCCAccessOrReject');
    expect(source).toContain('GET');
    expect(source).toContain('POST');
  });

  it('GET returns findings + summary', () => {
    const source = read('src/app/api/zcc/security/route.ts');
    expect(source).toContain('findings');
    expect(source).toContain('summary');
    expect(source).toContain('critical');
    expect(source).toContain('high');
  });

  it('POST triggers manual scan', () => {
    const source = read('src/app/api/zcc/security/route.ts');
    expect(source).toContain('runFullSecurityScan');
  });
});

describe('ZCC Security Panel — component wired', () => {
  it('security-panel.tsx exists', () => {
    expect(existsSync(resolve(root, 'src/components/zcc/panels/security-panel.tsx'))).toBe(true);
  });

  it('zcc-shell.tsx imports SecurityPanel', () => {
    const source = read('src/components/zcc/zcc-shell.tsx');
    expect(source).toContain('SecurityPanel');
    expect(source).toContain('security-panel');
  });

  it('zcc-shell.tsx renders SecurityPanel for "security" tab', () => {
    const source = read('src/components/zcc/zcc-shell.tsx');
    expect(source).toContain('tab === "security"');
    expect(source).toContain('<SecurityPanel');
  });

  it('ZccTabId includes "security"', () => {
    const source = read('src/lib/zcc/types.ts');
    expect(source).toContain('"security"');
  });
});

describe('Prisma — SecurityFinding model', () => {
  it('model exists in schema.prisma', () => {
    const source = read('prisma/schema.prisma');
    expect(source).toContain('model SecurityFinding');
    expect(source).toContain('scanType');
    expect(source).toContain('severity');
    expect(source).toContain('status');
    expect(source).toContain('@@map("security_findings")');
  });

  it('migration SQL exists', () => {
    expect(existsSync(
      resolve(root, 'prisma/migrations/20260901000004_add_security_findings/migration.sql')
    )).toBe(true);
  });
});

describe('vercel.json — cron configuration', () => {
  it('has security-scan cron at 06:00 UTC (03:00 BRT madrugada)', () => {
    const vj = JSON.parse(read('vercel.json'));
    const securityCron = vj.crons.find((c: any) => c.path === '/api/cron/security-scan');
    expect(securityCron).toBeDefined();
    expect(securityCron.schedule).toBe('0 6 * * *');
  });

  it('does NOT have orphan caution-auto-return cron (removed P0.2)', () => {
    const vj = JSON.parse(read('vercel.json'));
    const cautionCron = vj.crons.find((c: any) => c.path === '/api/cron/caution-auto-return');
    expect(cautionCron).toBeUndefined();
  });
});
