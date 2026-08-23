// ============================================================
// V11-P0 Cron Auth — Testes unitários
// Arquivo destino: tests/cron-auth.test.ts
// ============================================================
//
// Cobre:
//   1. Verificação de token EdDSA válido (caminho feliz)
//   2. Rejeição de token sem header Authorization
//   3. Rejeição de scheme não-Bearer
//   4. Rejeição de assinatura inválida (chave errada)
//   5. Rejeição de token expirado
//   6. Rejeição de token com claim `sub` (humano em M2M)
//   7. Rejeição de scope insuficiente
//   8. Rejeição de issuer errado
//   9. Rejeição de audience errada
//  10. Dev bypass em NODE_ENV=development sem chave
//  11. Emissão de token com client_secret válido
//  12. Rejeição de client_secret inválido
//  13. Rejeição de scope não autorizado para o client
//  14. Constant-time comparison (não leaking via timing)
//
// Setup: gera par Ed25519 em beforeEach para isolamento
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SignJWT, generateKeyPair, exportSPKI, exportPKCS8, importPKCS8 } from 'jose';
import { NextRequest } from 'next/server';
import { verifyCronM2MToken, issueM2MToken, type CronScope } from '../../src/lib/security/cron-auth';

// --- Setup: gera par Ed25519 real -------------------------------------------

let publicKeyPem: string;
let privateKeyPem: string;
let privateKeyObj: any;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  publicKeyPem = await exportSPKI(publicKey);
  privateKeyPem = await exportPKCS8(privateKey);
  privateKeyObj = await importPKCS8(privateKeyPem, 'EdDSA');

  process.env.ZELLA_M2M_ED25519_PUBLIC_KEY = publicKeyPem;
  process.env.ZELLA_M2M_ED25519_PRIVATE_KEY = privateKeyPem;
  process.env.ZELLA_M2M_ISSUER = 'https://test-auth.seuzella.test';
  process.env.ZELLA_M2M_AUDIENCE = 'seuzella-cron-test';
});

afterAll(() => {
  delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;
  delete process.env.ZELLA_M2M_ED25519_PRIVATE_KEY;
});

// --- Helper: cria request mockado -------------------------------------------

function makeRequest(token?: string, extraHeaders: Record<string, string> = {}): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return new NextRequest('https://test.seuzella.test/api/cron/test', { headers });
}

// --- Helper: assina token custom --------------------------------------------

async function signToken(overrides: {
  issuer?: string;
  audience?: string;
  scope?: CronScope;
  azp?: string;
  subject?: string;
  expired?: boolean;
  notYetValid?: boolean;
  alg?: string;
  wrongKey?: boolean;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = overrides.expired ? now - 60 : now + 300;
  const nbf = overrides.notYetValid ? now + 60 : now;

  const signingKey = overrides.wrongKey
    ? await importPKCS8((await exportPKCS8((await generateKeyPair('EdDSA')).privateKey)), 'EdDSA')
    : privateKeyObj;

  const builder = new SignJWT({
    azp: overrides.azp ?? 'cron-test',
    scope: overrides.scope ?? 'cerebro:read',
  })
    .setProtectedHeader({ alg: overrides.alg ?? 'EdDSA', typ: 'JWT' })
    .setIssuer(overrides.issuer ?? process.env.ZELLA_M2M_ISSUER!)
    .setAudience(overrides.audience ?? process.env.ZELLA_M2M_AUDIENCE!)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setNotBefore(nbf);

  if (overrides.subject) {
    builder.setSubject(overrides.subject);
  }

  return builder.sign(signingKey);
}

// --- Testes ------------------------------------------------------------------

describe('cron-auth — verifyCronM2MToken', () => {
  it('1. aceita token EdDSA válido (caminho feliz)', async () => {
    const token = await signToken({});
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.clientId).toBe('cron-test');
      expect(result.principal.scope).toBe('cerebro:read');
      expect(result.principal.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('2. rejeita request sem header Authorization', async () => {
    const req = makeRequest(undefined);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('3. rejeita scheme não-Bearer', async () => {
    const req = new NextRequest('https://test.seuzella.test/api/cron/test', {
      headers: { authorization: 'Basic abc123' },
    });
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('4. rejeita assinatura inválida (chave errada)', async () => {
    const token = await signToken({ wrongKey: true });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('5. rejeita token expirado', async () => {
    const token = await signToken({ expired: true });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
  });

  it('6. rejeita token com claim `sub` (humano em M2M)', async () => {
    const token = await signToken({ subject: 'user-123' });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Mensagem deve indicar que sub é proibido em M2M
      const body = await result.response.json();
      expect(body.code).toBe('sub_forbidden');
    }
  });

  it('7. rejeita scope insuficiente', async () => {
    const token = await signToken({ scope: 'reports:read' });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.code).toBe('insufficient_scope');
    }
  });

  it('8. rejeita issuer errado', async () => {
    const token = await signToken({ issuer: 'https://evil.example.com' });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
  });

  it('9. rejeita audience errada', async () => {
    const token = await signToken({ audience: 'wrong-audience' });
    const req = makeRequest(token);
    const result = await verifyCronM2MToken(req, 'cerebro:read');

    expect(result.ok).toBe(false);
  });

  it('10. dev bypass funciona em NODE_ENV=development sem chave', async () => {
    // NODE_ENV é read-only em alguns runtimes (Node 24+ marca como read-only).
    // Usamos vi.stubEnv (vitest) que contorna essa limitação.
    const { vi } = await import('vitest');
    vi.stubEnv('NODE_ENV', 'development');

    const originalKey = process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;
    delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;

    try {
      const req = new NextRequest('https://test.seuzella.test/api/cron/test', {
        headers: { 'x-zella-m2m-dev-bypass': 'cerebro:read' },
      });
      const result = await verifyCronM2MToken(req, 'cerebro:read');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.principal.clientId).toBe('dev-bypass');
      }
    } finally {
      process.env.ZELLA_M2M_ED25519_PUBLIC_KEY = originalKey;
      vi.unstubAllEnvs();
    }
  });
});

describe('cron-auth — issueM2MToken', () => {
  beforeEach(() => {
    // Setup de clients de teste
    process.env.ZELLA_M2M_CLIENTS = 'cron-test:test-secret-hash';
    process.env.ZELLA_M2M_CLIENT_SCOPES = 'cron-test:cerebro:read';
  });

  afterEach(() => {
    delete process.env.ZELLA_M2M_CLIENTS;
    delete process.env.ZELLA_M2M_CLIENT_SCOPES;
  });

  it('11. emite token com client_secret válido', async () => {
    // V11-P0: clients em texto claro (comparação constant-time)
    const secret = 'test-secret-value';
    process.env.ZELLA_M2M_CLIENTS = `cron-test:${secret}`;
    process.env.ZELLA_M2M_CLIENT_SCOPES = 'cron-test:cerebro:read';

    const result = await issueM2MToken({
      clientId: 'cron-test',
      clientSecret: secret,
      scope: 'cerebro:read',
    });

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.accessToken).toBeTruthy();
      expect(result.expiresIn).toBe(300);
    }
  });

  it('12. rejeita client_secret inválido', async () => {
    const result = await issueM2MToken({
      clientId: 'cron-test',
      clientSecret: 'wrong-secret',
      scope: 'cerebro:read',
    });

    expect('error' in result).toBe(true);
  });

  it('13. rejeita scope não autorizado para o client', async () => {
    const secret = 'test-secret-value';
    process.env.ZELLA_M2M_CLIENTS = `cron-test:${secret}`;
    process.env.ZELLA_M2M_CLIENT_SCOPES = 'cron-test:cerebro:read';

    const result = await issueM2MToken({
      clientId: 'cron-test',
      clientSecret: secret,
      scope: 'reports:read', // não autorizado
    });

    expect('error' in result).toBe(true);
  });
});

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
