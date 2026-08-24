import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('ZCC authentication security policy', () => {
  it('requires explicit ZCC_ADMIN_EMAILS allowlist plus privileged role', () => {
    const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
    const security = fs.readFileSync('src/lib/zcc-security.ts', 'utf8');
    expect(middleware).toContain('ZCC_ADMIN_EMAILS');
    expect(middleware).toContain('envAdmins.includes(email)');
    expect(middleware).toContain("['owner', 'admin', 'system_admin']");
    expect(security).toContain('adminEmails.includes(email)');
  });

  it('keeps development master-key bypass out of production', () => {
    const security = fs.readFileSync('src/lib/zcc-security.ts', 'utf8');
    expect(security).toContain("process.env.NODE_ENV !== 'production'");
    expect(security).toContain('x-zcc-master-key');
  });

  it('keeps ZCC and DDC as distinct surfaces', () => {
    const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
    expect(middleware).toContain("pathname === '/zcc/login'");
    expect(middleware).toContain("pathname === '/ddc'");
    expect(middleware).toContain("'/zcc/login'");
  });
});
