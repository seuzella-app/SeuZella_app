/**
 * RUN 4 — WAVE 4B: PAT Vault fail-closed (sem chave determinística).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import crypto from 'crypto';
import { encryptPat, decryptPat, serializeEncrypted, deserializeEncrypted } from '@/lib/github/pat-vault';

const KEY_B64 = crypto.randomBytes(32).toString('base64'); // 32 bytes reais

const KEY = 'GITHUB_PAT_MASTER_KEY';

describe('WAVE 4B — pat-vault fail-closed', () => {
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY]; else process.env[KEY] = original;
  });

  it('1. env ausente → encryptPat falha (fail-closed), sem chave determinística', () => {
    delete process.env[KEY];
    expect(() => encryptPat('ghp_test_pat')).toThrow(/GITHUB_PAT_MASTER_KEY/);
  });

  it('2. env vazio → fail-closed', () => {
    process.env[KEY] = '';
    expect(() => encryptPat('ghp_test_pat')).toThrow(/GITHUB_PAT_MASTER_KEY/);
  });

  it('3. chave inválida (não-base64 / tamanho errado) → fail-closed com mensagem sem valor da chave', () => {
    process.env[KEY] = 'chave-curta-invalida'; // decodifica para poucos bytes
    try {
      encryptPat('ghp_test_pat');
      throw new Error('deveria ter falhado');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/32 bytes/);
      expect(msg).not.toContain('chave-curta-invalida');
    }
  });

  it('4. produção sem chave → erro (não há fallback silencioso)', () => {
    delete process.env[KEY];
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => encryptPat('ghp_test_pat')).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('5. desenvolvimento também é fail-closed (sem chave não há vault)', () => {
    delete process.env[KEY];
    vi.stubEnv('NODE_ENV', 'development');
    try {
      expect(() => encryptPat('ghp_test_pat')).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('6. chave válida (32 bytes base64) → round-trip encrypt/decrypt preservado', () => {
    process.env[KEY] = KEY_B64; // 32 bytes base64
    const pat = 'github_pat_11AAAABBBBCCCCDDDDEEEEFFFF';
    const enc = encryptPat(pat);
    expect(enc.iv).toBeTruthy();
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.tag).toBeTruthy();
    const dec = decryptPat(enc);
    expect(dec).toBe(pat);
  });

  it('7. round-trip via serialização JSON (formato de armazenamento preservado)', () => {
    process.env[KEY] = KEY_B64;
    const pat = 'github_pat_11SECRET_SECRET_SECRET_98765';
    const round = deserializeEncrypted(serializeEncrypted(encryptPat(pat)));
    expect(decryptPat(round)).toBe(pat);
  });

  it('8. mesmo plaintext produz IVs diferentes (sem IV determinístico)', () => {
    process.env[KEY] = KEY_B64;
    const a = encryptPat('mesmo-plaintext');
    const b = encryptPat('mesmo-plaintext');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('9. ciphertext adulterado → decrypt falha (auth tag GCM)', () => {
    process.env[KEY] = KEY_B64;
    const enc = encryptPat('dados-sensiveis');
    const tampered = { ...enc, ciphertext: Buffer.from('adulterado-' + 'x'.repeat(30)).toString('base64') };
    expect(() => decryptPat(tampered)).toThrow();
  });

  it('10. nenhuma chave determinística embutida no módulo (fonte auditada)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/github/pat-vault.ts'), 'utf8');
    expect(src).not.toContain('Buffer.alloc(32, 0)');
    expect(src).not.toContain('Buffer.alloc(32,0)');
  });
});
