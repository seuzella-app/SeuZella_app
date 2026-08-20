/**
 * ============================================================================
 * 🔐 SECRET VAULT — Criptografia Simétrica AES-256-GCM Versionada
 * ============================================================================
 *
 * Utilizado para criptografar ApiConfig.apiKey, ApiConfig.apiSecret, OAuth tokens
 * e credenciais de fechaduras/pagamento em repouso no banco de dados.
 *
 * Formato de armazenamento:
 *   v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * ============================================================================
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ZELLA_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'zella_default_secure_vault_master_key_32b!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Criptografa um segredo com AES-256-GCM
 */
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

/**
 * Decriptografa um segredo AES-256-GCM versionado
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';

  // Se o texto não estiver criptografado no padrão v1 (ex: legado), retorna como está
  if (!cipherText.startsWith('v1:')) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) {
      throw new Error('Formato de ciphertext inválido.');
    }

    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    logger.error('[SECRET_VAULT] Falha ao decriptografar segredo:', { error: err?.message });
    throw new Error('Falha na decriptografia do segredo. Chave inválida ou dados corrompidos.');
  }
}

/**
 * Retorna uma representação mascarada segura para exibição em interfaces/APIs
 * Ex: '••••••••8F3A'
 */
export function maskSecret(secret: string): string {
  if (!secret) return '••••••••••••';

  // Se estiver criptografado, decriptografa antes de mascarar
  let plain = secret;
  if (secret.startsWith('v1:')) {
    try {
      plain = decryptSecret(secret);
    } catch {
      plain = 'configured';
    }
  }

  if (plain.length <= 4) {
    return '••••••••';
  }

  const suffix = plain.slice(-4);
  return `••••••••${suffix}`;
}
