/**
 * ============================================================================
 * 🔐 SECRET VAULT — Criptografia Simétrica AES-256-GCM Versionada
 * ============================================================================
 * Segredos sensíveis são criptografados em repouso. Em produção a chave mestra
 * é obrigatória: nunca existe fallback embutido no código.
 * ============================================================================
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ZELLA_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECRET_VAULT_NOT_CONFIGURED: ZELLA_ENCRYPTION_KEY (or NEXTAUTH_SECRET) is required in production.');
    }
    // Development-only deterministic fallback. This must never be usable in production.
    return crypto.createHash('sha256').update('dev-only-zella-vault-key').digest();
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${CURRENT_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';

  // Legacy plaintext is retained for controlled migration; callers should
  // re-encrypt it before persisting it again. Production never creates new plaintext.
  if (!cipherText.startsWith('v1:')) return cipherText;

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) throw new Error('Formato de ciphertext inválido.');

    const [, ivHex, authTagHex, encryptedHex] = parts;
    if (!/^[0-9a-f]+$/i.test(ivHex) || ivHex.length !== IV_LENGTH * 2) throw new Error('IV inválido.');
    if (!/^[0-9a-f]+$/i.test(authTagHex) || authTagHex.length !== AUTH_TAG_LENGTH * 2) throw new Error('Auth tag inválido.');
    if (!/^[0-9a-f]*$/i.test(encryptedHex)) throw new Error('Ciphertext inválido.');

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    logger.error('[SECRET_VAULT] Falha ao decriptografar segredo:', { error: err?.message });
    throw new Error('Falha na decriptografia do segredo. Chave inválida ou dados corrompidos.');
  }
}

export function maskSecret(secret: string): string {
  if (!secret) return '••••••••••••';

  let plain = secret;
  if (secret.startsWith('v1:')) {
    try { plain = decryptSecret(secret); } catch { plain = 'configured'; }
  }

  if (plain.length <= 4) return '••••••••';
  return `••••••••${plain.slice(-4)}`;
}
