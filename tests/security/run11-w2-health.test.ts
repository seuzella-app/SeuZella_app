import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerCheck,
  readinessPayload,
  readinessHttpStatus,
  setEnvAllowlist,
  getEnvAllowlist,
} from '../../src/lib/infra/health';

/**
 * RUN11-W2 — invariantes de health/readiness (cronograma 11E):
 * status coerente; envs SOMENTE como presença booleana da allowlist;
 * valor de env NUNCA aparece no payload (correção do vazamento de
 * telemetria global dos residuais /api/brain e /api/readiness).
 */

describe('RUN11-W2 health — checks e status', () => {
  it('todos os checks ok => status ok e HTTP 200', async () => {
    registerCheck('db', async () => ({ ok: true }));
    registerCheck('queue', async () => ({ ok: true, detail: 'idle' }));
    const p = await readinessPayload();
    expect(p.status).toBe('ok');
    expect(readinessHttpStatus(p)).toBe(200);
    expect(p.checks.find((c) => c.name === 'db')?.ok).toBe(true);
  });

  it('check com erro (exceção) vira ok:false — status degraded e HTTP 503, sem exceção', async () => {
    registerCheck('boom', async () => {
      throw new Error('detonou');
    });
    const p = await readinessPayload();
    expect(p.status).toBe('degraded');
    expect(readinessHttpStatus(p)).toBe(503);
    const boom = p.checks.find((c) => c.name === 'boom');
    expect(boom?.ok).toBe(false);
    expect(boom?.detail).toBe('check_error');
  });
});

describe('RUN11-W2 health — exposição de env (núcleo do 11E)', () => {
  let backup: Record<string, string | undefined>;
  beforeEach(() => {
    backup = {
      REDIS_URL: process.env.REDIS_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      SZ_TEST_UNKNOWN_ENV: process.env.SZ_TEST_UNKNOWN_ENV,
    };
    setEnvAllowlist(['REDIS_URL', 'DATABASE_URL']);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    setEnvAllowlist(['REDIS_URL', 'DATABASE_URL', 'AI_GATEWAY_TOKEN', 'LLM_API_KEY']);
  });

  it('payload reporta SOMENTE configured:boolean — o valor nunca vaza', async () => {
    process.env.REDIS_URL = 'redis://supersecret:6379/0';
    delete process.env.DATABASE_URL;
    process.env.SZ_TEST_UNKNOWN_ENV = 'qualquer-valor';
    const p = await readinessPayload();
    expect(p.env.REDIS_URL).toEqual({ configured: true });
    expect(p.env.DATABASE_URL).toEqual({ configured: false });
    const flat = JSON.stringify(p);
    expect(flat).not.toContain('redis://supersecret');
    expect(flat).not.toContain('qualquer-valor');
  });

  it('allowlist é whitelist: chave fora dela é AUSENTE do payload (não vira false)', async () => {
    process.env.SZ_TEST_UNKNOWN_ENV = 'qualquer-valor';
    const p = await readinessPayload();
    expect(p.env.SZ_TEST_UNKNOWN_ENV).toBeUndefined();
    expect(getEnvAllowlist()).not.toContain('SZ_TEST_UNKNOWN_ENV');
  });
});
