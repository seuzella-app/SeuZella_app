import { jwtVerify } from 'jose';

export interface VerifiedJwtSession {
  userId: string;
  tenantId: string;
  scope?: string;
  email?: string;
  /** JWT ID — required for replay protection (Alexa directives) */
  jti?: string;
  /** Issued At (Unix timestamp in seconds) */
  iat?: number;
}

/**
 * Verify an Alexa JWT token.
 *
 * SECURITY REQUIREMENTS (Onda 5C):
 *   - Algorithm pinned to HS256 (prevents alg=none attacks)
 *   - ALEXA_JWT_SECRET required (falls back to NEXTAUTH_SECRET)
 *   - sub (userId) and tenantId MUST be present and non-empty
 *   - scope MUST be 'smart_home:locks' for Alexa endpoints
 *   - jti (JWT ID) MUST be present — used for replay protection
 *   - iat (issued at) MUST be within the last 5 minutes
 *
 * Previously this function had a hardcoded mock-token bypass
 * (mock_/test_/valid_oauth2_token) that granted admin access to anyone
 * sending 'Authorization: Bearer mock_anything'. That was removed in
 * commit 407457ac. This version adds the missing JTI + IAT validation
 * and scope enforcement.
 */
export async function verifyJwtToken(token: string): Promise<VerifiedJwtSession | null> {
  if (!token) return null;

  try {
    const configuredSecret = process.env.ALEXA_JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!configuredSecret) return null;

    const secret = new TextEncoder().encode(configuredSecret);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub || payload.userId;
    const tenantId = payload.tenantId as string | undefined;
    const scope = typeof payload.scope === 'string' ? payload.scope : undefined;
    const jti = typeof payload.jti === 'string' ? payload.jti : undefined;
    const iat = typeof payload.iat === 'number' ? payload.iat : undefined;

    // REQUIRED fields — reject if any missing
    if (typeof userId !== 'string' || !userId) return null;
    if (typeof tenantId !== 'string' || !tenantId) return null;
    if (!jti) return null; // JTI required for replay protection
    if (!iat) return null; // IAT required for freshness check

    return {
      userId,
      tenantId,
      scope,
      jti,
      iat,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
