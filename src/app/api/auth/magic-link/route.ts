import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import crypto from 'crypto';

function hashMagicToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBaseUrl(): string {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (process.env.NODE_ENV === 'production' && !baseUrl) throw new Error('NEXTAUTH_URL is required in production');
  return baseUrl || 'http://localhost:3000';
}

/** POST /api/auth/magic-link — creates a single-use, short-lived magic link. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    if (!(await isDatabaseAvailable())) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    const tokenHash = hashMagicToken(token);

    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({ data: { identifier: email, token: tokenHash, expires } });

    const magicLinkUrl = `${getBaseUrl()}/api/auth/magic-link?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const isDev = process.env.NODE_ENV === 'development';

    // Never log the raw token or full magic URL: either contains a bearer credential.
    console.info('[Magic Link] Token generated', { email: '[REDACTED]', expiresAt: expires.toISOString() });

    return NextResponse.json({
      success: true,
      message: 'Link mágico enviado para seu e-mail!',
      ...(isDev && { devToken: token, devUrl: magicLinkUrl }),
    });
  } catch (error) {
    console.error('[Magic Link] Error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** GET /api/auth/magic-link — verifies and consumes the single-use token. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email')?.trim().toLowerCase();
    if (!token || !email || token.length !== 64) return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
    if (!(await isDatabaseAvailable())) return NextResponse.redirect(new URL('/login?error=service-unavailable', request.url));

    const verificationToken = await db.verificationToken.findUnique({ where: { token: hashMagicToken(token) } });
    if (!verificationToken || verificationToken.identifier !== email) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
    }
    if (verificationToken.expires < new Date()) {
      await db.verificationToken.delete({ where: { identifier_token: { identifier: email, token: verificationToken.token } } }).catch(() => undefined);
      return NextResponse.redirect(new URL('/login?error=token-expired', request.url));
    }

    // Consume before redirecting. A second request cannot reuse the same bearer token.
    await db.verificationToken.delete({ where: { identifier_token: { identifier: email, token: verificationToken.token } } });

    let tenant = await db.tenant.findUnique({ where: { email } });
    if (!tenant) {
      tenant = await db.tenant.create({ data: { name: email.split('@')[0], email, plan: 'lite', status: 'active', niche: 'pousada' } });
    }
    if (tenant.status !== 'active') return NextResponse.redirect(new URL('/login?error=account-inactive', request.url));

    const baseUrl = getBaseUrl();
    const niche = tenant.niche || 'pousada';
    const redirectPath = niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada';
    return NextResponse.redirect(new URL(`/login?magicLogin=true&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectPath)}`, baseUrl));
  } catch (error) {
    console.error('[Magic Link] Verification error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.redirect(new URL('/login?error=internal-error', request.url));
  }
}
