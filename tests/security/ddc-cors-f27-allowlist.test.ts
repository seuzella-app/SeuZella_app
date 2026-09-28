/**
 * F27 CORS — Allowlist de origens para SSE/DDC (sem wildcard)
 * ============================================================================
 * Contrato:
 *   - 'Access-Control-Allow-Origin: *' NÃO existe mais nas rotas DDC
 *   - Origin desconhecida NUNCA é refletida (sem header ACAO)
 *   - Origin na allowlist → ACAO = origem específica
 *   - Dev: localhost/127.0.0.1 em qualquer porta são permitidos
 *   - Nenhum domínio inventado: apenas envs existentes + seuzella.com.br
 *     (fallback já usado pelo live-feed antes desta onda)
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildSseCorsHeaders, getAllowedOrigins, isOriginAllowed } from '../../src/lib/security/origin-allowlist';

const TENANT_STATE_SRC = readFileSync(join(__dirname, '..', '..', 'src', 'app', 'api', 'ddc', 'realtime', 'tenant-state', 'route.ts'), 'utf-8');
const LIVE_FEED_SRC = readFileSync(join(__dirname, '..', '..', 'src', 'app', 'api', 'ddc', 'live-feed', 'route.ts'), 'utf-8');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
// tsc marca NODE_ENV como read-only; alias tipado permite manipulação em testes.
const testEnv = process.env as Record<string, string | undefined>;

function fakeReq(origin?: string): { headers: { get(name: string): string | null } } {
  return { headers: { get: (n: string) => (n.toLowerCase() === 'origin' && origin ? origin : null) } };
}

describe('F27 CORS — SAST das rotas DDC', () => {
  it('tenant-state não emite wildcard e usa o helper centralizado', () => {
    expect(TENANT_STATE_SRC).not.toContain("'Access-Control-Allow-Origin': '*'");
    expect(TENANT_STATE_SRC).not.toContain('"Access-Control-Allow-Origin": "*"');
    expect(TENANT_STATE_SRC).toContain('buildSseCorsHeaders');
  });

  it('live-feed usa o helper centralizado (sem fallback espalhado)', () => {
    expect(LIVE_FEED_SRC).toContain('buildSseCorsHeaders');
    expect(LIVE_FEED_SRC).not.toContain("'https://seuzella.com.br'");
  });
});

describe('F27 CORS — comportamento da allowlist', () => {
  beforeEach(() => {
    testEnv.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.seuzella.com.br';
  });

  afterEach(() => {
    testEnv.NODE_ENV = ORIGINAL_NODE_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;
  });

  it('produção: Origin permitida → ACAO = origem específica (nunca *)', () => {
    const headers = buildSseCorsHeaders(fakeReq('https://app.seuzella.com.br'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.seuzella.com.br');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
  });

  it('produção: Origin desconhecida (evil.com) → SEM header ACAO', () => {
    const headers = buildSseCorsHeaders(fakeReq('https://evil.com'));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('produção: Origin malformada → SEM header ACAO (não reflete)', () => {
    const headers = buildSseCorsHeaders(fakeReq('not-a-real-origin'));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('same-origin (sem Origin header) → permitido sem ACAO', () => {
    const headers = buildSseCorsHeaders(fakeReq());
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers['Access-Control-Allow-Headers']).toContain('Last-Event-ID');
  });

  it('allowlist preserva Last-Event-ID para reconexão SSE', () => {
    const headers = buildSseCorsHeaders(fakeReq('https://app.seuzella.com.br'));
    expect(headers['Access-Control-Allow-Headers']).toBe('Last-Event-ID');
  });

  it('dev: localhost em qualquer porta é permitido', () => {
    testEnv.NODE_ENV = 'development';
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3001')).toBe(true);
    expect(isOriginAllowed('https://evil.com')).toBe(false);
  });

  it('getAllowedOrigins inclui VERCEL_URL sem protocolo e normaliza', () => {
    process.env.VERCEL_URL = 'my-deployment.vercel.app';
    const origins = getAllowedOrigins();
    expect(origins).toContain('https://my-deployment.vercel.app');
    expect(origins).toContain('https://app.seuzella.com.br');
    expect(origins).not.toContain('*');
  });

  it('nenhuma configuração produz wildcard', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;
    const headers = buildSseCorsHeaders(fakeReq('https://evil.com'));
    expect(Object.values(headers)).not.toContain('*');
  });
});
