import { NextRequest, NextResponse } from 'next/server';

// GET /api/ddc/locks/oauth/[provider]/callback — Callback OAuth2 do provedor
//
// Placeholder: quando credenciais OAuth estiverem configuradas, este endpoint
// recebe o code, troca por access_token + refresh_token, e persiste em
// LockOAuthAccount (com criptografia AES-256-GCM via prisma-encryption-middleware).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/ddc?oauth_error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código de autorização ausente' },
        { status: 400 },
      );
    }

    // TODO: quando OAuth estiver implementado, trocar code por tokens aqui
    // e persistir em LockOAuthAccount.

    return NextResponse.json({
      success: false,
      error: `OAuth callback para ${provider} ainda não implementado. Use o modo manual por ora.`,
      state,
    });
  } catch (error) {
    console.error('[LOCKS] OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: 'OAuth callback failed' },
      { status: 500 },
    );
  }
}
