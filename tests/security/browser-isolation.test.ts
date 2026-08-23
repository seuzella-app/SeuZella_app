import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('browser isolation security headers', () => {
  const config = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');

  it('denies framing and plugin content', () => {
    expect(config).toContain('X-Frame-Options');
    expect(config).toContain('value: "DENY"');
    expect(config).toContain("object-src 'none'");
  });

  it('enforces transport and cross-origin isolation headers', () => {
    expect(config).toContain('Strict-Transport-Security');
    expect(config).toContain('max-age=31536000');
    expect(config).toContain('Cross-Origin-Opener-Policy');
    expect(config).toContain('Cross-Origin-Resource-Policy');
  });

  it('prevents browser caching of API responses', () => {
    expect(config).toContain('source: "/api/:path*"');
    expect(config).toContain('no-store, max-age=0');
  });
});
