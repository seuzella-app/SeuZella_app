import { randomBytes, timingSafeEqual } from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

type LockOAuthState = {
  tenantId: string;
  provider: string;
  issuedAt: number;
  nonce: string;
};

export function createLockOAuthState(tenantId: string, provider: string): string {
  const payload: LockOAuthState = {
    tenantId,
    provider,
    issuedAt: Date.now(),
    nonce: randomBytes(24).toString('hex'),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function validateLockOAuthState(
  state: string,
  expected: string | undefined,
  expectedTenantId: string,
  expectedProvider: string,
  now = Date.now(),
): boolean {
  if (!state || !expected || state.length !== expected.length) return false;

  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as LockOAuthState;
    if (!payload.tenantId || !payload.provider || !payload.nonce || !Number.isFinite(payload.issuedAt)) return false;
    if (payload.tenantId !== expectedTenantId || payload.provider !== expectedProvider) return false;
    return now >= payload.issuedAt && now - payload.issuedAt <= STATE_TTL_MS;
  } catch {
    return false;
  }
}

export const LOCK_OAUTH_STATE_TTL_SECONDS = STATE_TTL_MS / 1000;
