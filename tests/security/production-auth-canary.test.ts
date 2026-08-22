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
});
