import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('production hardening contracts', () => {
  it('preflight is fail-closed and checks live PostgreSQL/Redis', () => {
    const source = read('src/scripts/production-check.ts');
    expect(source).toContain("await db.$queryRaw`SELECT 1`");
    expect(source).toContain('await redis.ping()');
    expect(source).toContain("process.exitCode = 1");
    expect(source).not.toContain('!!db;');
  });

  it('production queue never reports durable work when Redis is unavailable', () => {
    const source = read('src/lib/queue/bullmq-queue.ts');
    expect(source).toContain("if (isProduction()) {");
    expect(source).toContain("throw new Error('DURABLE_QUEUE_UNAVAILABLE')");
    expect(source).toContain("throw new Error('DURABLE_QUEUE_WRITE_FAILED')");
  });

  it('systemd workers run with a restricted service sandbox', () => {
    const source = read('deploy/systemd/zehla-workers.service');
    expect(source).toContain('NoNewPrivileges=true');
    expect(source).toContain('ProtectSystem=strict');
    expect(source).toContain('ProtectHome=true');
    expect(source).toContain('RestrictSUIDSGID=true');
    expect(source).toContain('MemoryMax=768M');
  });

  it('production compose has no insecure credential defaults', () => {
    const source = read('docker-compose.prod.yml');
    expect(source).toContain('${DB_PASS:?DB_PASS_REQUIRED}');
    expect(source).toContain('${REDIS_PASSWORD:?REDIS_PASSWORD_REQUIRED}');
    expect(source).toContain('sslmode=require');
    expect(source).not.toContain('zehla_secure_prod_pwd');
    expect(source).not.toContain('zehla_redis_secure_pwd');
    expect(source).toContain('no-new-privileges:true');
  });
});
