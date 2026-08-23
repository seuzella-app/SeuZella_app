import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

describe('production authentication canaries', () => {
  it('contains no source-code admin/demo passwords', () => {
    const source = readFileSync(resolve(root, 'src/lib/auth.ts'), 'utf8');
    expect(source).not.toContain("cleanEmail === '123'");
    expect(source).not.toContain("cleanEmail === 'demo@pousada.com.br'");
    expect(source).not.toContain("cleanEmail === 'demo@airbnb.com.br'");
    expect(source).toContain('ZEHLA_MASTER_ADMIN_EMAIL');
    expect(source).toContain('ZEHLA_MASTER_ADMIN_PASSWORD');
  });

  it('does not contain mock Alexa authentication tokens', () => {
    const source = readFileSync(resolve(root, 'src/lib/auth/jwt.ts'), 'utf8');
    expect(source).not.toContain('mock_');
    expect(source).not.toContain('valid_oauth2_token');
    expect(source).not.toContain('tenant_pousada_rosa');
  });

  it('middleware has no source-code admin allowlist in production', () => {
    const source = readFileSync(resolve(root, 'src/middleware.ts'), 'utf8');
    expect(source).not.toContain("'admin@seuzella.com.br'");
    expect(source).not.toContain("'zella@zella.com.br'");
    expect(source).not.toContain("'admin@zehla.com.br'");
    expect(source).not.toContain("'123'");
    // Production must have an empty devAdminFallback
    expect(source).toContain("process.env.NODE_ENV === 'production'");
  });

  it('login page has no demo credential buttons', () => {
    const source = readFileSync(resolve(root, 'src/app/login/page.tsx'), 'utf8');
    expect(source).not.toContain("'demo@pousada.com.br'");
    expect(source).not.toContain("'demo@airbnb.com.br'");
    expect(source).not.toContain("'zella@zella.com.br'");
    expect(source).not.toContain("'123', '123'");
    expect(source).not.toContain('handleQuickDemoLogin');
  });

  it('does not use the legacy @seuzella.com.br corporate domain', () => {
    const corporateFiles = [
      'src/middleware.ts',
      'src/app/login/page.tsx',
      'src/app/api/cron/monthly-billing/route.ts',
      'src/app/api/ddc/billing/invoices/route.ts',
      'src/app/ddc/DDCDashboardContent.tsx',
    ];
    for (const file of corporateFiles) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toContain('@seuzella.com.br');
    }
  });

  it('documents all production auth env vars in .env.example', () => {
    const source = readFileSync(resolve(root, '.env.example'), 'utf8');
    expect(source).toContain('ZEHLA_MASTER_ADMIN_EMAIL');
    expect(source).toContain('ZEHLA_MASTER_ADMIN_PASSWORD');
    expect(source).toContain('ZCC_ADMIN_EMAILS');
    expect(source).toContain('ALEXA_JWT_SECRET');
  });
});
