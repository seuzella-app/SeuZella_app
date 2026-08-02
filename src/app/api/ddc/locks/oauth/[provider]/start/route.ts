import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { BRAND_CATALOG, type LockBrand } from '@/lib/locks/types';

// GET /api/ddc/locks/oauth/[provider]/start — Inicia fluxo OAuth2 do provedor
//
// Por ora, retorna instrução para o host configurar manualmente — a integração
// OAuth real depende de credenciais do provedor (TTLOCK_CLIENT_ID, etc.) que
// ainda não foram provisionadas. Quando estiverem, este endpoint redireciona
// para a URL de autorização do provedor.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const tenantId = await resolveTenantId();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const info = BRAND_CATALOG[provider as LockBrand];
    if (!info || !info.apiAvailable) {
      return NextResponse.json(
        { success: false, error: `Provider ${provider} não suporta OAuth` },
        { status: 400 },
      );
    }

    const envKey = `${provider.toUpperCase()}_CLIENT_ID`;
    const clientId = process.env[envKey];

    if (!clientId) {
      // Sem credenciais — orienta o host a usar modo manual
      return NextResponse.json({
        success: false,
        error: `Integração OAuth com ${info.label} ainda não está configurada no Zélla. Use o modo MANUAL: gere o PIN no app oficial ${info.label} e cole no campo abaixo.`,
        fallback: 'manual',
        brand: provider,
        brandLabel: info.label,
      });
    }

    // Quando credenciais existirem, redireciona para OAuth do provedor
    // const redirectUri = `${process.env.NEXTAUTH_URL}/api/ddc/locks/oauth/${provider}/callback`;
    // const state = Buffer.from(`${tenantId}:${Date.now()}`).toString('base64url');
    // const authUrl = buildOAuthUrl(provider, clientId, redirectUri, state);
    // return NextResponse.redirect(authUrl);

    return NextResponse.json({
      success: false,
      error: 'OAuth endpoint em implementação',
    });
  } catch (error) {
    console.error('[LOCKS] OAuth start error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start OAuth flow' },
      { status: 500 },
    );
  }
}
