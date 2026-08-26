import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd();

describe('magic authentication regression', () => {
  it('does not expose an email-only password mutation endpoint', () => {
    expect(existsSync(`${root}/src/app/api/auth/magic-verify/route.ts`)).toBe(false);
  });

  it('uses the tokenized reset-password flow', () => {
    const source = readFileSync(`${root}/src/app/api/auth/reset-password/route.ts`, 'utf8');
    expect(source).toContain('password_reset_tokens');
    expect(source).toContain('token_hash');
    expect(source).toContain('used_at');
    expect(source).toContain('expires_at');
  });

  it('magic-link consumes a one-time verification token before issuing a reset token', () => {
    const source = readFileSync(`${root}/src/app/api/auth/magic-link/route.ts`, 'utf8');
    expect(source).toContain('verificationToken');
    expect(source).toContain('crypto.randomBytes(32)');
    expect(source).toContain('/reset-password?token=');
  });
});
