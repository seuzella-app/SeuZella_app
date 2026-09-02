import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class EncryptionError extends Error {
  constructor(message = 'Unable to decrypt protected data') {
    super(message);
    this.name = 'EncryptionError';
  }
}

let _devEncryptionSecret: string | null = null;

function deriveSalt(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update('zella-encryption-salt-derivation-v2').digest().slice(0, 16);
}

function getEncryptionSecret(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE?.includes('build')) {
      const buildSecret = crypto.randomBytes(32).toString('hex');
      return crypto.scryptSync(buildSecret, deriveSalt(buildSecret), 32);
    }
    if (process.env.NODE_ENV === 'production') throw new EncryptionError('ENCRYPTION_SECRET is not configured');
    if (!_devEncryptionSecret) {
      _devEncryptionSecret = crypto.randomBytes(32).toString('hex');
      console.warn('[ENCRYPTION] ENCRYPTION_SECRET not set — generated random key for dev mode.');
    }
    return crypto.scryptSync(_devEncryptionSecret, deriveSalt(_devEncryptionSecret), 32);
  }

  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) return Buffer.from(secret, 'hex');
  return crypto.scryptSync(secret, deriveSalt(secret), 32);
}

export function encryptText(text: string): string {
  if (!text) return text;
  const secret = getEncryptionSecret();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts iv:authTag:ciphertext payloads. Plain legacy values that do not
 * contain the protected three-part format remain readable for migrations.
 * A malformed protected payload fails closed instead of becoming an empty
 * string, which would silently convert corruption/key errors into valid data.
 */
export function decryptText(encryptedData: string): string {
  if (!encryptedData) return encryptedData;

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    if (parts.length === 1) return encryptedData;
    throw new EncryptionError('Malformed encrypted payload');
  }

  try {
    const [ivBase64, authTagBase64, encryptedTextBase64] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || !encryptedTextBase64) {
      throw new EncryptionError('Malformed encrypted payload');
    }

    const secret = getEncryptionSecret();
    const decipher = crypto.createDecipheriv(ALGORITHM, secret, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedTextBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError();
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '***';
  if (apiKey.startsWith('sk-')) {
    const prefix = apiKey.substring(0, 5);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}...${suffix}`;
  }
  const prefix = apiKey.substring(0, 4);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}...${suffix}`;
}
