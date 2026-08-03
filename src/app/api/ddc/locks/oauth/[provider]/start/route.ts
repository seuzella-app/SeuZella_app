import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { BRAND_CATALOG, type LockBrand } from '@/lib/locks/types';
import { hasCredentialsConfigured } from '@/lib/locks/providers';
import { getOAuthAuthorizeUrl as ttlockAuth } from '@/lib/locks/providers/ttlock';
import { getOAuthAuthorizeUrl as tuyaAuth } from '@/lib/locks/providers/tuya';
import { getOAuthAuthorizeUrl as igloohomeAuth } from '@/lib/locks/providers/igloohome';
import { getOAuthAuthorizeUrl as nukiAuth } from '@/lib/locks/providers/nuki';

// GET /api/ddc/locks/oauth/[provider]/start — Inicia fluxo OAuth2 do provedor
//
// Gera a URL de autorização do provedor (TTLock/Tuya/Igloohome/Nuki) e
// redireciona o navegador do host para o popup de consentimento.
//
// State encoding: base64url(tenantId:timestamp:randomNonce) — validado no callback
// para prevenir CSRF attacks.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const tenantId = await resolveTenantId();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — faça login como host' },
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

    // Verifica se credenciais estão configuradas no ambiente
    if (!hasCredentialsConfigured(provider as LockBrand)) {
      return NextResponse.json({
        success: false,
        error: `Integração OAuth com ${info.label} ainda não está configurada no Zélla. Use o modo MANUAL: gere o PIN no app oficial ${info.label} e cole no campo abaixo.`,
        fallback: 'manual',
        brand: provider,
        brandLabel: info.label,
        hint: `Para habilitar OAuth, configure as variáveis de ambiente ${provider.toUpperCase()}_CLIENT_ID e ${provider.toUpperCase()}_CLIENT_SECRET no painel da Vercel.`,
      });
    }

    // Gera state anti-CSRF: base64url(tenantId:timestamp:nonce)
    const crypto = await import('crypto');
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(`${tenantId}:${Date.now()}:${nonce}`).toString('base64url');

    // Monta a URL de autorização específica do provedor
    let authUrl: string;
    try {
      switch (provider) {
        case 'ttlock':
          authUrl = ttlockAuth(state);
          break;
        case 'tuya':
          authUrl = tuyaAuth(state);
          break;
        case 'igloohome':
          authUrl = igloohomeAuth(state);
          break;
        case 'nuki':
          authUrl = nukiAuth(state);
          break;
        case 'august':
          // August não usa OAuth URL — usa PIN de verificação por SMS
          return NextResponse.json({
            success: false,
            error: 'August usa fluxo de verificação por SMS, não OAuth popup.',
            hint: 'Use POST /api/ddc/locks/oauth/august/start para iniciar sessão August.',
          });
        default:
          return NextResponse.json(
            { success: false, error: `Provider ${provider} não implementado` },
            { status: 501 },
          );
      }
    } catch (err) {
      console.error(`[locks] OAuth start URL build failed for ${provider}:`, err);
      return NextResponse.json(
        { success: false, error: `Falha ao gerar URL de autorização para ${info.label}` },
        { status: 500 },
      );
    }

    // Salva state no cookie httpOnly para validação no callback
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('zella_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 min para completar OAuth
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('[LOCKS] OAuth start error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start OAuth flow' },
      { status: 500 },
    );
  }
}
