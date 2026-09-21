import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  guardRequest,
  auditRouteEvent,
  clientIp,
  hashIp,
} from '../../src/lib/infra/wiring';
import { getRateLimiter } from '../../src/lib/infra/rate-limit';

/**
 * RUN11-W3 — suíte de fiação (cronograma W3):
 *   1) guardRequest: libera sob a política; bloqueia 429 no flood;
 *      degrada fail-closed 503 com a loja indisponível (modo closed).
 *   2) auditRouteEvent: redação por CHAVE e por VALOR na trilha.
 *   3) Presença da fiação nos pontos cirúrgicos desta onda
 *      (anti-regressão): readiness (payload W2), brain (guard),
 *      checkout/webhook (guard + trilha).
 * In-process, sem DB e sem rede (mesma doutrina das suítes W2).
 */

function req(ip: string): Request {
  return new Request('https://sz.test/api/x', { headers: { 'x-forwarded-for': ip } });
}

const POLICY = { points: 3, windowMs: 60_000 };

describe('RUN11-W3 guardRequest — rate limit fail-closed', () => {
  it('libera requisições dentro da política', () => {
    getRateLimiter().setStoreUnavailable(false);
    expect(guardRequest(req('1.1.1.1'), 'free', POLICY)).toBeNull();
    expect(guardRequest(req('1.1.1.1'), 'free', POLICY)).toBeNull();
  });

  it('bloqueia com 429 no excesso (LIMIT_EXCEEDED) e emite Retry-After', () => {
    getRateLimiter().setStoreUnavailable(false);
    for (let i = 0; i < POLICY.points; i++) {
      guardRequest(req('2.2.2.2'), 'flood', POLICY);
    }
    const denied = guardRequest(req('2.2.2.2'), 'flood', POLICY);
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(429);
    expect(denied!.headers.get('Retry-After')).toBeTruthy();
  });

  it('degrada fail-closed com 503 quando a loja está indisponível (modo closed)', async () => {
    const rl = getRateLimiter();
    rl.setStoreUnavailable(true);
    try {
      const r = guardRequest(req('3.3.3.3'), 'degraded', POLICY);
      expect(r).not.toBeNull();
      expect(r!.status).toBe(503);
      const body = (await r!.json()) as { reason?: string; error?: string };
      expect(body.reason).toBe('STORE_UNAVAILABLE');
      expect(body.error).toBe('RATE_LIMITED');
    } finally {
      rl.setStoreUnavailable(false);
    }
  });
});

describe('RUN11-W3 auditRouteEvent — redação na trilha', () => {
  it('redige por CHAVE e por VALOR e garante correlationId', () => {
    const line = auditRouteEvent({
      who: 'suite',
      what: 'redaction.check',
      resource: 'test',
      result: 'OK',
      meta: {
        apiKey: 'sk-ABCDEFGHIJKLMNOPQRSTUV',
        note: 'token eyJabc123def456ghi789',
      },
    });
    expect(line).toContain('[REDACTED:key]');
    expect(line).toContain('[REDACTED:jwt-like]');
    expect(line).not.toContain('sk-ABCDEFGHIJKLMNOPQRSTUV');
    expect(line).not.toContain('eyJabc123def456ghi789');
    const obj = JSON.parse(line) as { correlationId?: string; ts?: string };
    expect(obj.correlationId).toBeTruthy();
    expect(obj.ts).toBeTruthy();
  });

  it('IP nunca vai cru para a trilha (só prefixo do hash)', () => {
    expect(clientIp(req('9.9.9.9, 10.0.0.1'))).toBe('9.9.9.9');
    const h = hashIp('9.9.9.9');
    expect(h).toHaveLength(12);
    expect(h).not.toContain('9.9.9.9');
  });
});

describe('RUN11-W3 fiação cirúrgica presente (anti-regressão)', () => {
  const ROOT = process.cwd();
  const src = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

  it('readiness expõe o payload W2 da infra (11E)', () => {
    const s = src('src/app/api/readiness/route.ts');
    expect(s).toContain('@/lib/infra/health');
    expect(s).toContain('infra: await infraReadinessPayload()');
  });

  it('brain protegido por guardRequest', () => {
    const s = src('src/app/api/brain/route.ts');
    expect(s).toContain('@/lib/infra/wiring');
    expect(s).toContain("guardRequest(request, 'brain.post'");
  });

  it('checkout/webhook com guardRequest + trilha de auditoria', () => {
    const s = src('src/app/api/checkout/webhook/route.ts');
    expect(s).toContain('@/lib/infra/wiring');
    expect(s).toContain("guardRequest(request, 'checkout.webhook'");
    expect(s).toContain('checkout.webhook.received');
  });
});
