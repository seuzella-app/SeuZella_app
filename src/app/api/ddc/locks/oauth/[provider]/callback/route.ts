import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { validateLockOAuthState } from '@/lib/locks/oauth-state';
import { exchangeCodeForTokens as ttlockExchange } from '@/lib/locks/providers/ttlock';
import { exchangeCodeForTokens as tuyaExchange } from '@/lib/locks/providers/tuya';
import { exchangeCodeForTokens as igloohomeExchange } from '@/lib/locks/providers/igloohome';
import { exchangeCodeForTokens as nukiExchange } from '@/lib/locks/providers/nuki';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const redirectWithStatus = (status: 'success' | 'error', message: string) => {
    const url = new URL('/ddc', request.url);
    url.searchParams.set('oauth_status', status);
    url.searchParams.set('oauth_provider', provider);
    url.searchParams.set('oauth_message', message);
    url.hash = 'locks';
    const response = NextResponse.redirect(url);
    response.cookies.delete('zella_oauth_state');
    return response;
  };

  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return redirectWithStatus('error', 'UNAUTHORIZED');

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (searchParams.get('error')) return redirectWithStatus('error', 'OAUTH_DENIED');
    if (!code) return redirectWithStatus('error', 'OAUTH_CODE_MISSING');

    const cookieState = request.cookies.get('zella_oauth_state')?.value;
    if (!validateLockOAuthState(state ?? '', cookieState, tenantId, provider)) {
      console.warn('[locks] OAuth state validation failed');
      return redirectWithStatus('error', 'OAUTH_STATE_INVALID');
    }

    try {
      switch (provider) {
        case 'ttlock': await ttlockExchange({ code }); break;
        case 'tuya': await tuyaExchange({ code }); break;
        case 'igloohome': await igloohomeExchange({ code }); break;
        case 'nuki': await nukiExchange({ code }); break;
        default: return redirectWithStatus('error', 'OAUTH_PROVIDER_UNSUPPORTED');
      }
    } catch (error) {
      console.error(`[locks] OAuth token exchange failed for ${provider}:`, error);
      return redirectWithStatus('error', 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    return redirectWithStatus('success', 'LOCK_PROVIDER_CONNECTED');
  } catch (error) {
    console.error('[LOCKS] OAuth callback error:', error);
    return redirectWithStatus('error', 'OAUTH_CALLBACK_FAILED');
  }
}

/** August usa verificação de código enviada pelo próprio provider. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { provider } = await params;
    if (provider !== 'august') return NextResponse.json({ success: false, error: 'PROVIDER_NOT_SUPPORTED' }, { status: 400 });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 16 * 1024) {
      return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }

    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 }); }
    const code = body && typeof body === 'object' && 'code' in body ? String((body as { code?: unknown }).code ?? '') : '';
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ success: false, error: 'INVALID_VERIFICATION_CODE' }, { status: 400 });

    const { verifySession } = await import('@/lib/locks/providers/august');
    await verifySession({ code });
    return NextResponse.json({ success: true, message: 'LOCK_PROVIDER_CONNECTED' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[LOCKS] August verify error:', error);
    return NextResponse.json({ success: false, error: 'OAUTH_VERIFICATION_FAILED' }, { status: 503 });
  }
}
