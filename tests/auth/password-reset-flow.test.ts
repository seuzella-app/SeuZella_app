import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('ZCC password reset flow contracts', () => {
  it('stores only a SHA-256 token hash and expires tokens', () => {
    const route = read('src/app/api/auth/forgot-password/route.ts');
    expect(route).toContain('randomBytes(32)');
    expect(route).toContain("createHash('sha256')");
    expect(route).toContain('30 * 60 * 1000');
    expect(route).not.toContain('devUrl');
  });

  it('returns a generic response to prevent account enumeration', () => {
    const route = read('src/app/api/auth/forgot-password/route.ts');
    expect(route).toContain('GENERIC_RESPONSE');
    expect(route).toContain('if (!tenant) return NextResponse.json(GENERIC_RESPONSE)');
  });

  it('requires a strong password and consumes reset tokens once', () => {
    const route = read('src/app/api/auth/reset-password/route.ts');
    expect(route).toContain('password.length >= 12');
    expect(route).toContain('bcrypt.hash(password, 12)');
    expect(route).toContain('used_at');
    expect(route).toContain('CURRENT_TIMESTAMP');
  });

  it('bootstraps only the configured ZCC admin email', () => {
    const route = read('src/app/api/auth/forgot-password/route.ts');
    expect(route).toContain('ZCC_ADMIN_EMAILS');
    expect(route).toContain('marciocau14@gmail.com');
    expect(route).toContain("role: 'system_admin'");
  });

  it('provides dedicated user-facing forgot and reset pages', () => {
    expect(fs.existsSync(path.join(root, 'src/app/forgot-password/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/app/reset-password/page.tsx'))).toBe(true);
  });
});
