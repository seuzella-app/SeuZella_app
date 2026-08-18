// =============================================================================
// 🔐 SEU ZÉLLA — Gerador criptográfico de PINs
// =============================================================================
// Implementa dois algoritmos REAIS (não a fórmula fake Math.random do teste
// antigo):
//
// 1. PIN aleatório criptográfico — para marcas MANUAIS (Intelbras, Yale,
//    Papaiz, Philco, Samsung). O host cola esse PIN no app do fabricante.
//
// 2. PIN derivado de TOTP — para futura integração Igloohome offline.
//    Igloohome não aceita PINs arbitrários; eles usam o algoritmo do
//    fabricante. Por ora, deixamos a função pronta para quando o adapter
//    Igloohome for implementado.
//
// CRÍTICO: usar randomInt (Node.js) — NUNCA Math.random() para PINs.
// Math.random não é CSPRNG e foi a causa do mock "849201" previsível.
// =============================================================================

import { createHmac, timingSafeEqual, randomInt } from 'crypto';

/** Tamanho padrão do PIN (6 dígitos — padrão de mercado). */
const DEFAULT_PIN_LENGTH = 6;

/** Tamanho máximo suportado (8 dígitos — Yale e Samsung usam). */
const MAX_PIN_LENGTH = 8;

/** Tamanho mínimo suportado (4 dígitos — alguns modelos antigos). */
const MIN_PIN_LENGTH = 4;

/**
 * Gera um PIN numérico criptograficamente seguro.
 *
 * Usa randomInt (CSPRNG) — distribuição uniforme garantida.
 * Retorna string de `length` dígitos (padrão 6).
 *
 * @param length Tamanho do PIN (4-8, default 6)
 * @param suffix Sufixo opcional (ex: "#" para TTLock — alguns modelos exigem)
 */
export function generateRandomPin(length: number = DEFAULT_PIN_LENGTH, suffix: string = ''): string {
  if (length < MIN_PIN_LENGTH || length > MAX_PIN_LENGTH) {
    throw new Error(`PIN length must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH}, got ${length}`);
  }

  const pin = Array.from({ length }, () => randomInt(0, 10)).join('');
  return `${pin}${suffix}`;
}

/**
 * Gera um PIN alfanumérico (para marcas que aceitam letras).
 * Usa charset 0-9 + A-Z (sem caracteres ambíguos: 0/O, 1/I).
 */
export function generateAlphanumericPin(length: number = 6): string {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars (sem ambíguos)
  const pin = Array.from({ length }, () => charset[randomInt(0, charset.length)]).join('');
  return pin;
}

/**
 * Gera um PIN TOTP (Time-Based One-Time Password) — RFC 6238.
 *
 * USO: Para futura integração com Igloohome offline PIN.
 * Igloohome aceita PINs offline gerados por algoritmo do fabricante.
 * A API Igloohome abstrai isso, MAS se precisarmos gerar manualmente,
 * usamos este TOTP padrão com a chave secreta do dispositivo.
 *
 * @param secret Chave secreta compartilhada (base32 ou hex)
 * @param window Janela de tempo em segundos (default 30 — RFC 6238)
 * @param digits Número de dígitos (6 ou 8)
 * @param timestamp Momento de referência (default: agora)
 */
export function generateTOTP(
  secret: string,
  window: number = 30,
  digits: number = 6,
  timestamp: number = Date.now(),
): string {
  const counter = Math.floor(timestamp / 1000 / window);
  const buffer = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  buffer.writeBigUInt64BE(BigInt(counter));

  // Decode secret (assume hex; if base32, decode first)
  let key: Buffer;
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0) {
    key = Buffer.from(secret, 'hex');
  } else {
    // Base32 decode (RFC 4648)
    key = base32Decode(secret);
  }

  const hmac = createHmac('sha1', key).update(buffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verifica um PIN TOTP em uma janela de tolerância (±1 window).
 * Usa timingSafeEqual para evitar timing attacks.
 */
export function verifyTOTP(
  secret: string,
  token: string,
  window: number = 30,
  digits: number = 6,
  tolerance: number = 1,
): boolean {
  const now = Date.now();
  for (let i = -tolerance; i <= tolerance; i++) {
    const candidate = generateTOTP(secret, window, digits, now + i * window * 1000);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(token))) {
      return true;
    }
  }
  return false;
}

/** Decodifica string Base32 (RFC 4648) — para chaves TOTP. */
function base32Decode(input: string): Buffer {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const sanitized = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of sanitized) {
    const idx = charset.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 char: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/**
 * Calcula o status derivado de um PIN baseado nas datas.
 * Esta é a fonte da verdade — DB apenas armazena datas, status é derivado.
 */
export function derivePinStatus(params: {
  validFrom: Date;
  validTo: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
}): 'scheduled' | 'active' | 'used' | 'expired' | 'revoked' {
  const now = new Date();

  if (params.revokedAt) return 'revoked';
  if (params.usedAt) return 'used';
  if (now < params.validFrom) return 'scheduled';
  if (now > params.validTo) return 'expired';
  return 'active';
}

/**
 * Calcula a janela padrão de validade de um PIN.
 * Convenção Zélla: 14:00 do check-in → 11:00 do check-out.
 *
 * @param checkInDate Data de check-in (YYYY-MM-DD)
 * @param checkOutDate Data de check-out (YYYY-MM-DD)
 * @param checkInTime Horário de check-in (HH:mm, default 14:00)
 * @param checkOutTime Horário de check-out (HH:mm, default 11:00)
 */
export function calculatePinValidityWindow(
  checkInDate: string,
  checkOutDate: string,
  checkInTime: string = '14:00',
  checkOutTime: string = '11:00',
): { validFrom: Date; validTo: Date } {
  const validFrom = new Date(`${checkInDate}T${checkInTime}:00`);
  const validTo = new Date(`${checkOutDate}T${checkOutTime}:00`);

  if (validTo <= validFrom) {
    throw new Error(
      `Invalid PIN window: validTo (${validTo.toISOString()}) must be after validFrom (${validFrom.toISOString()})`,
    );
  }

  return { validFrom, validTo };
}

/**
 * Gera um PIN emergencial de 15 minutos — para o Protocolo de Exceção 1
 * (hóspede esqueceu pertence após check-out).
 */
export function generateEmergencyPin(): { pin: string; validFrom: Date; validTo: Date } {
  const now = new Date();
  const validTo = new Date(now.getTime() + 15 * 60 * 1000); // +15 min
  return {
    pin: generateRandomPin(6, '#'),
    validFrom: now,
    validTo,
  };
}
