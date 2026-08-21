import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { BRAND_CATALOG, type LockBrand } from '@/lib/locks/types';
import { getProviderCapabilities, hasCredentialsConfigured } from '@/lib/locks/providers';
import { createLockOAuthState, LOCK_OAUTH_STATE_TTL_SECONDS } from '@/lib/locks/oauth-state';
import { getOAuthAuthorizeUrl as ttlockAuth } from '@/lib/locks/providers/ttlock';
import { getOAuthAuthorizeUrl as tuyaAuth } from '@/lib/locks/providers/tuya';
import { getOAuthAuthorizeUrl as igloohomeAuth } from '@/lib/locks/providers/igloohome';
import { getOAuthAuthorizeUrl as nukiAuth } from '@/lib/locks/providers/nuki';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const info = BRAND_CATALOG[provider as LockBrand];
    const capabilities = info ? getProviderCapabilities(provider as LockBrand) : null;
    if (!info || !capabilities?.apiAvailable || !capabilities.oauth) {
      return NextResponse.json({ success: false, error: 'OAUTH_PROVIDER_UNSUPPORTED' }, { status: 400 });
    }

    if (!hasCredentialsConfigured(provider as LockBrand)) {
      return NextResponse.json({
        success: false,
        error: 'OAUTH_PROVIDER_NOT_CONFIGURED',
        fallback: 'manual',
        brand: provider,
        brandLabel: info.label,
      }, { status: 503 });
    }

    const state = createLockOAuthState(tenantId, provider);
    let authUrl: string;
    try {
      switch (provider) {
        case 'ttlock': authUrl = ttlockAuth(state); break;
        case 'tuya': authUrl = tuyaAuth(state); break;
        case 'igloohome': authUrl = igloohomeAuth(state); break;
        case 'nuki': authUrl = nukiAuth(state); break;
        default: return NextResponse.json({ success: false, error: 'OAUTH_PROVIDER_UNSUPPORTED' }, { status: 400 });
      }
    } catch (error) {
      console.error(`[locks] OAuth start failed for ${provider}:`, error);
      return NextResponse.json({ success: false, error: 'OAUTH_START_FAILED' }, { status: 503 });
    }

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('zella_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: LOCK_OAUTH_STATE_TTL_SECONDS,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('[LOCKS] OAuth start error:', error);
    return NextResponse.json({ success: false, error: 'OAUTH_START_FAILED' }, { status: 503 });
  }
}
