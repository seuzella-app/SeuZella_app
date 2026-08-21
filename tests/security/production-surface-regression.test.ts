import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('production surface regression contracts', () => {
  it('debug agent is authenticated and tenant scoped', () => {
    const source = read('src/app/api/debug-agent/route.ts');
    expect(source).toContain('withAuth(handler)');
    expect(source).toContain('tenantId: session.tenantId');
    expect(source).toContain('select: {');
    expect(source).not.toContain('error instanceof Error ? error.message');
  });

  it('lead seed route is unavailable in production', () => {
    const source = read('src/app/api/leads/seed/route.ts');
    expect(source).toContain("process.env.NODE_ENV === 'production'");
    expect(source).toContain("NOT_AVAILABLE_IN_PRODUCTION");
    expect(source).toContain('getAuthSession(req)');
  });

  it('downloads require authentication and fail closed on rate-limit infrastructure errors', () => {
    const source = read('src/app/api/download/[filename]/route.ts');
    expect(source).toContain('getAuthSession(request)');
    expect(source).toContain("download:${session!.tenantId}");
    expect(source).toContain("RATE_LIMIT_UNAVAILABLE");
    expect(source).toContain("Cache-Control': 'private, no-store'");
  });

  it('API key endpoints never return ciphertext or accept arbitrary provider values', () => {
    const source = read('src/app/api/config/keys/route.ts');
    expect(source).toContain('ALLOWED_PROVIDERS');
    expect(source).toContain('configured: Boolean(config.apiKey)');
    expect(source).not.toContain('apiSecret: maskApiKey');
    expect(source).not.toContain('...body');
    expect(source).toContain("Cache-Control': 'private, no-store'");
  });
});
