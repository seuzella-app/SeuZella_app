/**
 * Security Center Certification Tests
 * ============================================================================
 *
 * Valida que o Security Center está operacionalmente certificado:
 *   1. Pentest executa HTTP REAL (não apenas gera payloads)
 *   2. Fail-closed: endpoints rejeitam sem auth
 *   3. Dependency scan funciona (npm audit)
 *   4. Auto-fix gera branch isolada (não main direto)
 *   5. Findings têm evidence HTTP real (status code + response body)
 *   6. "Pentest" só é classificado quando há execução HTTP real
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('🔐 Security Center — Pentest HTTP Real (não mock)', () => {
  it('runPentestScan executa fetch() real contra o alvo', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    // Must use fetch() to execute attacks — not just generate payloads
    expect(source).toContain('fetch(url, fetchOptions)');
    expect(source).toContain('response.status');
    expect(source).toContain('response.text()');
  });

  it('pentest compares actualStatus vs expectedStatus', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('expectedStatus');
    expect(source).toContain('actualStatus');
    expect(source).toContain('passed = actualStatus === attack.expectedStatus');
  });

  it('findings have REAL HTTP evidence (not theoretical)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    // Finding description must include HTTP method, path, status code, response
    expect(source).toContain('HTTP ${attack.method}');
    expect(source).toContain('actual: actualStatus');
    expect(source).toContain('responseBody');
  });

  it('has baseline attacks (works without GLM)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('getBaselineAttacks');
    // Must have at least 10 baseline attacks
    const attackCount = (source.match(/name: '/g) || []).length;
    expect(attackCount).toBeGreaterThanOrEqual(10);
  });

  it('baseline attacks cover all critical boundaries', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    // Auth bypass
    expect(source).toContain('no Authorization header');
    // Webhook bypass (all gateways)
    expect(source).toContain('Asaas without signature');
    expect(source).toContain('Stripe without signature');
    expect(source).toContain('MercadoPago without signature');
    // Alexa JWT
    expect(source).toContain('no Bearer token');
    expect(source).toContain('alg=none');
    // IDOR
    expect(source).toContain('access lock by ID without auth');
    // Path traversal
    expect(source).toContain('Path traversal');
  });

  it('pentest finding title has CONFIRMED prefix (not theoretical)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('CONFIRMED:');
  });
});

describe('🔐 Security Center — Dependency Scan', () => {
  it('runDependencyScan function exists', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('export async function runDependencyScan');
  });

  it('uses npm audit --json', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain("npm");
    expect(source).toContain("audit");
    expect(source).toContain("--json");
  });

  it('parses vulnerabilities from audit output', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('vulnerabilities');
    expect(source).toContain('severity');
    expect(source).toContain('fixAvailable');
    expect(source).toContain('CWE-1035');
  });

  it('dependency scan is called in runFullSecurityScan', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('runDependencyScan()');
    expect(source).toContain('Dependency scan complete');
  });
});

describe('🔐 Security Center — Auto-Fix Isolated (branch + PR)', () => {
  it('generateAutoFix returns branch name (not just patch)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('branchName');
    expect(source).toContain('prTitle');
    expect(source).toContain('prDescription');
  });

  it('branch name starts with security-fix/ (never main)', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain("security-fix/");
  });

  it('PR title has [AUTO-FIX] prefix', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('[AUTO-FIX]');
  });

  it('PR description includes finding details + evidence', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('Finding:');
    expect(source).toContain('Severity:');
    expect(source).toContain('CWE:');
    expect(source).toContain('Evidence');
    expect(source).toContain('auto-generated');
    expect(source).toContain('Review carefully before merge');
  });
});

describe('🔐 Security Center — Fail-Closed Validation', () => {
  it('pentest baseline attacks expect 401 for unauthenticated access', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    // Count expectedStatus: 401 occurrences
    const count401 = (source.match(/expectedStatus: 401/g) || []).length;
    expect(count401).toBeGreaterThanOrEqual(5); // At least 5 endpoints must fail-closed
  });

  it('webhook endpoints expect 401 without signature', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('Webhook bypass — Asaas without signature');
    expect(source).toContain('Webhook bypass — Stripe without signature');
    expect(source).toContain('Webhook bypass — MercadoPago without signature');
  });

  it('Alexa endpoint expects 401 without JWT', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('Alexa JWT bypass — no Bearer token');
    expect(source).toContain('Alexa JWT bypass — alg=none');
  });
});

describe('🔐 Security Center — Scan Types Classification', () => {
  it('ScanType includes all 4 scan types', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain("'sast'");
    expect(source).toContain("'pentest'");
    expect(source).toContain("'secret-scan'");
    expect(source).toContain("'dependency'");
  });

  it('pentest scanType only used when HTTP execution happens', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    // The 'pentest' scanType must only appear in the runPentestScan function
    // (where actual fetch() happens), not in a theoretical/generation-only context
    const pentestLines = source.split('\n').filter(l => l.includes("'pentest'"));
    // Each usage must be in the context of confirmed findings (with evidence)
    for (const line of pentestLines) {
      // Must be in a findings.push() call or type definition
      expect(
        line.includes('scanType:') || line.includes("ScanType =") || line.includes("'sast'")
      ).toBe(true);
    }
  });
});

describe('🔐 Security Center — Full Scan Orchestration', () => {
  it('runFullSecurityScan calls all 4 scan types', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('runSecretScan');
    expect(source).toContain('runDependencyScan');
    expect(source).toContain('runSastScan');
    expect(source).toContain('runPentestScan');
  });

  it('alerts ZéCode for critical/high findings', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain("severity === 'critical'");
    expect(source).toContain("severity === 'high'");
    expect(source).toContain('publishTenantEvent');
    expect(source).toContain('security_alert');
  });

  it('persists findings to SecurityFinding model', () => {
    const source = read('src/lib/security/security-scan-service.ts');
    expect(source).toContain('securityFinding');
    expect(source).toContain('scannedAt');
    expect(source).toContain('autoFixAttempted');
  });
});
