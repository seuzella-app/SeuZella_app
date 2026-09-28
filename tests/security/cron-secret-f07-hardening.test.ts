/**
 * F07 — Cron Secret Hardening (query ?secret= removido)
 * ============================================================================
 * Contrato OBRIGATÓRIO pós-F07:
 *   1. Authorization: Bearer <CRON_SECRET> válido  → permitido
 *   2. x-internal-token: <CRON_SECRET> válido      → permitido
 *   3. Query ?secret=<CRON_SECRET>                 → REJEITADO (401) — mesmo correto
 *   4. Produção sem CRON_SECRET                    → REJEITADO (503, fail-closed)
 *   5. Secret incorreto                            → REJEITADO (401)
 *   6. Dev sem CRON_SECRET                         → dev-bypass (teste manual)
 *   7. Nenhum caminho loga o valor do secret
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCronSecret } from '../../src/lib/security/cron-secret';

const SECRET = 'f07-test-cron-secret-9f8e7d6c5b4a';

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
// tsc marca NODE_ENV como read-only; alias tipado permite manipulação em testes.
const testEnv = process.env as Record<string, string | undefined>;

describe('F07 — verifyCronSecret sem query string', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    testEnv.NODE_ENV = 'production';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    testEnv.NODE_ENV = ORIGINAL_NODE_ENV;
    vi.restoreAllMocks();
  });

  it('1. Bearer válido → permitido (source bearer)', () => {
    const res = verifyCronSecret(makeReq('https://app.test/api/cron/x', { authorization: `Bearer ${SECRET}` }));
    expect(res.ok).toBe(true);
    expect(res.source).toBe('bearer');
  });

  it('2. x-internal-token válido → permitido (source header)', () => {
    const res = verifyCronSecret(makeReq('https://app.test/api/cron/x', { 'x-internal-token': SECRET }));
    expect(res.ok).toBe(true);
    expect(res.source).toBe('header');
  });

  it('3. query ?secret= correto → REJEITADO (regressão F07)', () => {
    const res = verifyCronSecret(makeReq(`https://app.test/api/cron/x?secret=${SECRET}`));
    expect(res.ok).toBe(false);
    expect(res.response?.status).toBe(401);
  });

  it('4. produção sem CRON_SECRET → fail-closed 503', () => {
    delete process.env.CRON_SECRET;
    const res = verifyCronSecret(makeReq('https://app.test/api/cron/x'));
    expect(res.ok).toBe(false);
    expect(res.response?.status).toBe(503);
  });

  it('5. secret incorreto → 401', () => {
    const res = verifyCronSecret(makeReq('https://app.test/api/cron/x', { authorization: 'Bearer wrong-secret-value' }));
    expect(res.ok).toBe(false);
    expect(res.response?.status).toBe(401);
  });

  it('6. dev sem CRON_SECRET → dev-bypass permitido', () => {
    delete process.env.CRON_SECRET;
    testEnv.NODE_ENV = 'development';
    const res = verifyCronSecret(makeReq('https://app.test/api/cron/x'));
    expect(res.ok).toBe(true);
    expect(res.source).toBe('dev-bypass');
  });

  it('7. rejeição NÃO loga o valor do secret', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Caminho com secret correto via query (rejeitado) e via header errado
    verifyCronSecret(makeReq(`https://app.test/api/cron/x?secret=${SECRET}`));
    verifyCronSecret(makeReq('https://app.test/api/cron/x', { authorization: `Bearer ${SECRET}-wrong` }));
    const allOutput = [...errSpy.mock.calls, ...logSpy.mock.calls, ...warnSpy.mock.calls].flat().join(' ');
    expect(allOutput).not.toContain(SECRET);
  });
});
