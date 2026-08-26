/**
 * Security Validators — contract tests
 *
 * Validates that all 4 validator scripts exist and have the correct structure.
 * These are source-level contracts (not behavioral) — the actual validation
 * runs when the server is live (via security-validators/run-all.py).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

describe('Security Validators — structure contract', () => {
  const validators = [
    { name: 'cross-tenant-access', tests: ['anonymous', 'tenant_a_own', 'tenant_a_cross_tenant', 'tenant_b_own'] },
    { name: 'webhook-bypass', tests: ['asaas', 'mercadopago', 'stripe', 'whatsapp'] },
    { name: 'alexa-jwt-bypass', tests: ['no_token', 'alg_none', 'missing_jti', 'missing_iat', 'expired', 'missing_tenantId', 'missing_scope'] },
    { name: 'payment-idempotency', tests: ['first_webhook', 'duplicate_webhook', 'cross_tenant_payment'] },
  ];

  for (const validator of validators) {
    it(`${validator.name} has validation.md + validate.py`, () => {
      const mdPath = resolve(root, `security-validators/${validator.name}/validation.md`);
      const pyPath = resolve(root, `security-validators/${validator.name}/validate.py`);
      expect(existsSync(mdPath), `${validator.name}/validation.md must exist`).toBe(true);
      expect(existsSync(pyPath), `${validator.name}/validate.py must exist`).toBe(true);
    });

    it(`${validator.name} validate.py has --output arg and main()`, () => {
      const source = readFileSync(
        resolve(root, `security-validators/${validator.name}/validate.py`),
        'utf8',
      );
      expect(source).toContain('--output');
      expect(source).toContain('def main');
      expect(source).toContain('sys.exit');
      expect(source).toContain('evidence');
    });
  }

  it('run-all.py orchestrates all 4 validators', () => {
    const source = readFileSync(
      resolve(root, 'security-validators/run-all.py'),
      'utf8',
    );
    expect(source).toContain('cross-tenant-access');
    expect(source).toContain('webhook-bypass');
    expect(source).toContain('alexa-jwt-bypass');
    expect(source).toContain('payment-idempotency');
  });
});

describe('Security infrastructure — CI/CD + Docker contracts', () => {
  it('.github/workflows/security-scan.yml exists with codex-security', () => {
    const source = readFileSync(
      resolve(root, '.github/workflows/security-scan.yml'),
      'utf8',
    );
    expect(source).toMatch(/codex|security/i);
    expect(source).toContain('codex-security scan');
    expect(source).toContain('upload-sarif');
    expect(source).toContain('security-events: write');
    expect(source).toMatch(/pull-requests|security-events/i);
  });

  it('.github/dependabot.yml exists with npm + github-actions ecosystems', () => {
    const source = readFileSync(
      resolve(root, '.github/dependabot.yml'),
      'utf8',
    );
    expect(source).toContain('package-ecosystem: "npm"');
    expect(source).toContain('package-ecosystem: "github-actions"');
    expect(source).toContain('security');
  });

  it('docker/seuzella-seccomp.json exists with defaultAction ERRNO', () => {
    const source = readFileSync(
      resolve(root, 'docker/seuzella-seccomp.json'),
      'utf8',
    );
    const parsed = JSON.parse(source);
    expect(parsed.defaultAction).toBe('SCMP_ACT_ERRNO');
    expect(parsed.syscalls).toBeDefined();
    expect(parsed.syscalls.length).toBeGreaterThan(0);
    // Must allow common Node.js syscalls
    const allowed = parsed.syscalls[0].names;
    expect(allowed).toContain('epoll_wait');
    expect(allowed).toContain('futex');
    expect(allowed).toContain('openat');
    expect(allowed).toContain('socket');
  });

  it('docker/seuzella.apparmor exists with deny rules for proc/sysrq', () => {
    const source = readFileSync(
      resolve(root, 'docker/seuzella.apparmor'),
      'utf8',
    );
    expect(source).toContain('deny @{PROC}/sysrq-trigger');
    expect(source).toContain('deny @{PROC}/kcore');
    expect(source).toContain('deny mount');
    expect(source).toContain('network inet');
  });

  it('package.json has security:scan scripts', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    );
    expect(pkg.scripts['security:scan']).toBeDefined();
    expect(pkg.scripts['security:scan:deep']).toBeDefined();
    expect(pkg.scripts['security:validate']).toBeDefined();
    expect(pkg.scripts['security:validators']).toBeDefined();
    expect(pkg.devDependencies['@openai/codex-security']).toBeDefined();
  });
});
