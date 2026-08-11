import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/auth/magic-link
 * Generates a magic link token and stores it in the VerificationToken table.
 * In dev mode, returns the token for UI display.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json(
        { error: 'Serviço indisponível' },
        { status: 503 }
      );
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up any existing tokens for this email
    try {
      await db.verificationToken.deleteMany({
        where: { identifier: email },
      });
    } catch {
      // Table might not have records, that's fine
    }

    // Store the token
    await db.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Build the magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/api/auth/magic-link?token=${token}&email=${encodeURIComponent(email)}`;

    // In dev mode, return the token and URL for UI display
    const isDev = process.env.NODE_ENV === 'development';

    console.log('[Magic Link] Generated for:', email);
    console.log('[Magic Link] Token:', token);
    console.log('[Magic Link] URL:', magicLinkUrl);

    return NextResponse.json({
      success: true,
      message: 'Link mágico enviado para seu e-mail!',
      ...(isDev && {
        devToken: token,
        devUrl: magicLinkUrl,
      }),
    });
  } catch (error) {
    console.error('[Magic Link] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/magic-link?token=xxx&email=xxx
 * Verifies the magic link token and signs the user in.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.redirect(
        new URL('/login?error=invalid-token', request.url)
      );
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.redirect(
        new URL('/login?error=service-unavailable', request.url)
      );
    }

    // Find the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      console.log('[Magic Link] Token not found');
      return NextResponse.redirect(
        new URL('/login?error=token-not-found', request.url)
      );
    }

    // Check if token matches the email
    if (verificationToken.identifier !== email) {
      console.log('[Magic Link] Token email mismatch');
      return NextResponse.redirect(
        new URL('/login?error=invalid-token', request.url)
      );
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      console.log('[Magic Link] Token expired');
      // Clean up expired token
      await db.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      }).catch(() => {});
      return NextResponse.redirect(
        new URL('/login?error=token-expired', request.url)
      );
    }

    // Delete the used token
    await db.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    }).catch(() => {});

    // Find or create a tenant for this email
    let tenant = await db.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      // Auto-create a tenant for magic link users
      tenant = await db.tenant.create({
        data: {
          name: email.split('@')[0],
          email,
          plan: 'lite',
          status: 'active',
          niche: 'pousada',
        },
      });
      console.log('[Magic Link] Created new tenant:', tenant.id);
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const niche = (tenant as any).niche || 'pousada';
    const redirectPath = niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada';

    console.log('[Magic Link] Authenticated:', email, '→ redirecting to', redirectPath);

    // Redirect to login page with magic login flag — the login page will auto-sign-in
    return NextResponse.redirect(
      new URL(`/login?magicLogin=true&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectPath)}`, baseUrl)
    );
  } catch (error) {
    console.error('[Magic Link] Verification error:', error);
    return NextResponse.redirect(
      new URL('/login?error=internal-error', request.url)
    );
  }
}
