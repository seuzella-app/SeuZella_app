import { describe, it, expect } from 'vitest';
import { RateLimiter, rateLimitKey } from '../../src/lib/infra/rate-limit';

/**
 * RUN11-W2 — invariantes do rate limiter (cronograma 11B):
 * limites por chave, janela, e principalmente: loja indisponível NUNCA vira
 * proteção falsa (fail-closed por padrão; 'open' só explícito).
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RUN11-W2 rate-limit — comportamento normal', () => {
  it('permite até points e bloqueia além (reason LIMIT_EXCEEDED)', () => {
    const rl = new RateLimiter();
    const policy = { points: 3, windowMs: 60_000 };
    expect(rl.check('k1', policy).allowed).toBe(true);
    expect(rl.check('k1', policy).allowed).toBe(true);
    const third = rl.check('k1', policy);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = rl.check('k1', policy);
    expect(fourth.allowed).toBe(false);
    expect(fourth.reason).toBe('LIMIT_EXCEEDED');
  });

  it('chaves isoladas por tenant/user/ip/route', () => {
    const rl = new RateLimiter();
    const policy = { points: 1, windowMs: 60_000 };
    const a = rateLimitKey({ tenantId: 'A', route: '/api/ai/chat' });
    const b = rateLimitKey({ tenantId: 'B', route: '/api/ai/chat' });
    expect(rl.check(a, policy).allowed).toBe(true);
    expect(rl.check(a, policy).allowed).toBe(false);
    expect(rl.check(b, policy).allowed).toBe(true); // tenant B não herda o limite de A
  });

  it('janela fixa: reset após windowMs', async () => {
    const rl = new RateLimiter();
    const policy = { points: 1, windowMs: 15 };
    const k = 'win';
    expect(rl.check(k, policy).allowed).toBe(true);
    expect(rl.check(k, policy).allowed).toBe(false);
    await sleep(20);
    const after = rl.check(k, policy);
    expect(after.allowed).toBe(true);
    expect(after.reason).toBe('OK');
  });

  it('política inválida (points<=0) é fail-closed mesmo sem degradação', () => {
    const rl = new RateLimiter();
    const d = rl.check('k', { points: 0, windowMs: 1000 });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('STORE_UNAVAILABLE');
  });
});

describe('RUN11-W2 rate-limit — sem proteção falsa (núcleo do 11B)', () => {
  it('modo closed (default): loja indisponível => NEGAR com STORE_UNAVAILABLE', () => {
    const rl = new RateLimiter('closed');
    rl.setStoreUnavailable(true);
    const d = rl.check('k', { points: 10, windowMs: 1000 });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('STORE_UNAVAILABLE');
    rl.setStoreUnavailable(false);
    expect(rl.check('k', { points: 10, windowMs: 1000 }).allowed).toBe(true);
  });

  it('modo open: só com escolha explícita; decisão carrega STORE_UNAVAILABLE (audível)', () => {
    const rl = new RateLimiter('open');
    rl.setStoreUnavailable(true);
    const d = rl.check('k', { points: 10, windowMs: 1000 });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('STORE_UNAVAILABLE');
    expect(d.remaining).toBe(-1);
    expect(rl.stats().failMode).toBe('open');
  });

  it('falha interna da loja durante check degrada e mantém fail-closed', () => {
    const rl = new RateLimiter('closed');
    const original = Date.now;
    (globalThis as { Date: unknown }).Date = class {
      static now(): number {
        throw new Error('clock broken');
      }
    };
    try {
      const d = rl.check('k2', { points: 5, windowMs: 1000 });
      expect(d.allowed).toBe(false);
      expect(d.reason).toBe('STORE_UNAVAILABLE');
      expect(rl.stats().storeUnavailable).toBe(true);
    } finally {
      (globalThis as { Date: unknown }).Date = original;
    }
  });
});
