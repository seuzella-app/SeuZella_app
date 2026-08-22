import { jwtVerify } from 'jose';

export interface VerifiedJwtSession {
  userId: string;
  tenantId: string;
  scope?: string;
  email?: string;
}

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
    const tenantId = payload.tenantId;
    if (typeof userId !== 'string' || typeof tenantId !== 'string' || !tenantId) return null;

    return {
      userId,
      tenantId,
      scope: typeof payload.scope === 'string' ? payload.scope : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
