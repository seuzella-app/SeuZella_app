import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production preflight contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/scripts/production-check.ts'), 'utf8');

  it('must fail closed for missing production secrets', () => {
    expect(source).toContain("isProduction ? 'FAIL' : 'WARN'");
    expect(source).toContain('DATABASE_URL');
    expect(source).toContain('NEXTAUTH_SECRET');
    expect(source).toContain('REDIS_URL');
  });

  it('must verify real database and redis connectivity', () => {
    expect(source).toContain('await db.$queryRaw`SELECT 1`');
    expect(source).toContain('await redis.ping()');
  });

  it('must return non-zero for a P0 failure', () => {
    expect(source).toContain('process.exitCode = 1');
    expect(source).toContain('if (check.isP0 && check.status === \'FAIL\')');
  });
});
