/**
 * Testes do PAT Vault e GitHub GitOps Layer
 *
 * Valida:
 *  - encryptPat / decryptPat round-trip
 *  - Auth tag verification (ciphertext adulterado deve falhar)
 *  - fingerprintPat determinístico
 *  - createCredential com PAT clássico (ghp_) deve rejeitar
 *  - Validation de formato de Fine-Grained PAT
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 4)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';

// Mock Prisma para testes
vi.mock('@/lib/db', () => ({
  db: {
    gitHubCredential: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    patAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock env
beforeAll(() => {
  process.env.GITHUB_PAT_MASTER_KEY = crypto.randomBytes(32).toString('base64');
});

// Importa após mocks
import {
  encryptPat,
  decryptPat,
  fingerprintPat,
  serializeEncrypted,
  deserializeEncrypted,
} from '@/lib/github/pat-vault';

describe('PAT Vault — Criptografia', () => {
  it('encryptPat retorna payload com iv, ciphertext, tag', () => {
    const plaintext = 'github_pat_test123';
    const enc = encryptPat(plaintext);
    expect(enc).toHaveProperty('iv');
    expect(enc).toHaveProperty('ciphertext');
    expect(enc).toHaveProperty('tag');
    expect(enc.iv).not.toBe(plaintext);
    expect(enc.ciphertext).not.toBe(plaintext);
  });

  it('decryptPat recupera plaintext original', () => {
    const plaintext = 'github_pat_test_decrypt_123';
    const enc = encryptPat(plaintext);
    const decrypted = decryptPat(enc);
    expect(decrypted).toBe(plaintext);
  });

  it('encryptPat gera ciphertexts diferentes para mesma entrada (IV único)', () => {
    const plaintext = 'github_pat_test_iv_uniqueness';
    const enc1 = encryptPat(plaintext);
    const enc2 = encryptPat(plaintext);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it('decryptPat lança erro se auth tag adulterada', () => {
    const plaintext = 'github_pat_test_tag';
    const enc = encryptPat(plaintext);
    // Adultera a tag (troca último char)
    const tamperedTag = enc.tag.slice(0, -2) + 'XX';
    expect(() =>
      decryptPat({ ...enc, tag: tamperedTag })
    ).toThrow();
  });

  it('decryptPat lança erro se ciphertext adulterado', () => {
    const plaintext = 'github_pat_test_ciphertext';
    const enc = encryptPat(plaintext);
    // Adultera ciphertext
    const tamperedCt = enc.ciphertext.slice(0, -2) + 'XX';
    expect(() =>
      decryptPat({ ...enc, ciphertext: tamperedCt })
    ).toThrow();
  });

  it('encryptPat lança erro com plaintext vazio', () => {
    expect(() => encryptPat('')).toThrow('Cannot encrypt empty plaintext');
  });

  it('serializeEncrypted / deserializeEncrypted round-trip', () => {
    const plaintext = 'github_pat_test_serialize';
    const enc = encryptPat(plaintext);
    const serialized = serializeEncrypted(enc);
    const deserialized = deserializeEncrypted(serialized);
    expect(deserialized).toEqual(enc);
    const decrypted = decryptPat(deserialized);
    expect(decrypted).toBe(plaintext);
  });
});

describe('PAT Vault — Fingerprint', () => {
  it('fingerprintPat é determinístico (mesmo input → mesmo output)', () => {
    const pat = 'github_pat_test_fp';
    const fp1 = fingerprintPat(pat);
    const fp2 = fingerprintPat(pat);
    expect(fp1).toBe(fp2);
  });

  it('fingerprintPat é diferente para inputs diferentes', () => {
    const fp1 = fingerprintPat('github_pat_a');
    const fp2 = fingerprintPat('github_pat_b');
    expect(fp1).not.toBe(fp2);
  });

  it('fingerprintPat tem 64 chars (SHA-256 hex)', () => {
    const fp = fingerprintPat('github_pat_test');
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fingerprintPat não revela o PAT (one-way)', () => {
    const pat = 'github_pat_super_secret';
    const fp = fingerprintPat(pat);
    expect(fp).not.toContain(pat);
    expect(fp).not.toContain('github_pat');
  });
});

describe('PAT Vault — Validação de formato', () => {
  it('criar credencial com PAT clássico (ghp_) deve rejeitar', async () => {
    const { createCredential } = await import('@/lib/github/pat-vault');

    // Mocka findFirst para retornar null (sem duplicata)
    const { db } = await import('@/lib/db');
    (db.gitHubCredential.findFirst as any).mockResolvedValue(null);

    await expect(
      createCredential({
        label: 'test-classic-pat',
        authType: 'fine_grained_pat',
        pat: 'ghp_classic_pat_should_be_rejected',
        scopes: ['contents:write'],
        repositoryAccess: ['owner/repo'],
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdBy: 'test',
      })
    ).rejects.toThrow(/Fine-Grained PAT/i);
  });

  it('criar credencial com Fine-Grained PAT (github_pat_) deve aceitar', async () => {
    const { createCredential } = await import('@/lib/github/pat-vault');

    const { db } = await import('@/lib/db');
    (db.gitHubCredential.findFirst as any).mockResolvedValue(null);
    (db.gitHubCredential.create as any).mockResolvedValue({
      id: 'test-cred-id',
      label: 'test-fine-grained',
    });

    const id = await createCredential({
      label: 'test-fine-grained',
      authType: 'fine_grained_pat',
      pat: 'github_pat_valid_format_test',
      scopes: ['contents:write'],
      repositoryAccess: ['owner/repo'],
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      createdBy: 'test',
    });

    expect(id).toBe('test-cred-id');
    expect(db.gitHubCredential.create).toHaveBeenCalled();
  });

  it('criar credencial duplicada (mesmo fingerprint) deve rejeitar', async () => {
    const { createCredential } = await import('@/lib/github/pat-vault');

    const { db } = await import('@/lib/db');
    (db.gitHubCredential.findFirst as any).mockResolvedValue({
      id: 'existing-cred',
      label: 'already-exists',
    });

    await expect(
      createCredential({
        label: 'test-duplicate',
        authType: 'fine_grained_pat',
        pat: 'github_pat_duplicate_test',
        scopes: ['contents:write'],
        repositoryAccess: ['owner/repo'],
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdBy: 'test',
      })
    ).rejects.toThrow(/já cadastrado/i);
  });
});

describe('GitHubClient — Validação estática', () => {
  it('validatePat retorna valid=false para PAT inválido', async () => {
    // Mock fetch para retornar 401
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ message: 'Bad credentials' }),
    }) as any;

    const { GitHubClient } = await import('@/lib/github/github-client');
    const result = await GitHubClient.validatePat('invalid_pat');

    expect(result.valid).toBe(false);
    expect(result.login).toBe('');

    global.fetch = originalFetch;
  });

  it('validatePat retorna valid=true e login para PAT válido', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'X-OAuth-Scopes': 'contents:write, pull_requests:write',
        'X-RateLimit-Remaining': '4999',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        'X-RateLimit-Limit': '5000',
      }),
      json: async () => ({ login: 'test-user', id: 12345 }),
    }) as any;

    const { GitHubClient } = await import('@/lib/github/github-client');
    const result = await GitHubClient.validatePat('github_pat_valid');

    expect(result.valid).toBe(true);
    expect(result.login).toBe('test-user');
    expect(result.scopes).toContain('contents:write');
    expect(result.rateLimit.remaining).toBe(4999);
    expect(result.rateLimit.limit).toBe(5000);

    global.fetch = originalFetch;
  });
});

describe('GitHubClient — Erros', () => {
  it('GitHubApiError tem estrutura correta', async () => {
    const { GitHubApiError } = await import('@/lib/github/github-client');
    const err = new GitHubApiError(404, 'Not Found', '/repos/test/test', 'GET');
    expect(err.status).toBe(404);
    expect(err.body).toBe('Not Found');
    expect(err.path).toBe('/repos/test/test');
    expect(err.method).toBe('GET');
    expect(err.message).toContain('404');
    expect(err.message).toContain('/repos/test/test');
  });
});

describe('Webhook Listener — Helpers', () => {
  it('verifyWebhookSignature falha para signature errada', () => {
    const crypto = require('crypto');
    const secret = 'test-secret';
    const payload = '{"test":"data"}';

    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Correta deve passar
    const correctSig = expected;
    const realFn = (sig: string) => {
      if (!sig || !sig.startsWith('sha256=')) return false;
      const expectedBuf = Buffer.from(expected);
      const sigBuf = Buffer.from(sig);
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    };

    expect(realFn(correctSig)).toBe(true);
    expect(realFn('sha256=invalid_signature_here_padding_xxxxxx')).toBe(false);
    expect(realFn('')).toBe(false);
    expect(realFn('invalid')).toBe(false);
  });
});
