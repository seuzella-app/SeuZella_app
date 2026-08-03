import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens as ttlockExchange } from '@/lib/locks/providers/ttlock';
import { exchangeCodeForTokens as tuyaExchange } from '@/lib/locks/providers/tuya';
import { exchangeCodeForTokens as igloohomeExchange } from '@/lib/locks/providers/igloohome';
import { exchangeCodeForTokens as nukiExchange } from '@/lib/locks/providers/nuki';

// GET /api/ddc/locks/oauth/[provider]/callback — Callback OAuth2 do provedor
//
// Recebe o `code` do provedor após consentimento do host, troca por tokens
// (access_token + refresh_token) e persiste em LockOAuthAccount com
// criptografia AES-256-GCM (via encryption.ts → oauth-store.ts).
//
// Valida o state anti-CSRF contra o cookie httpOnly setado no /start.
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
    const errorDescription = searchParams.get('error_description');

    // Helper: redireciona de volta para o DDC com status
    const redirectWithStatus = (status: 'success' | 'error', message: string) => {
      const url = new URL('/ddc', request.url);
      url.searchParams.set('oauth_status', status);
      url.searchParams.set('oauth_provider', provider);
      url.searchParams.set('oauth_message', message);
      url.hash = 'locks';
      const res = NextResponse.redirect(url);
      res.cookies.delete('zella_oauth_state');
      return res;
    };

    // 1. Provedor retornou erro (user negou consentimento, etc.)
    if (error) {
      const msg = errorDescription ?? error;
      return redirectWithStatus('error', `${provider}: ${msg}`);
    }

    if (!code) {
      return redirectWithStatus('error', 'Código de autorização ausente');
    }

    // 2. Valida state anti-CSRF
    const cookieState = request.cookies.get('zella_oauth_state')?.value;
    if (!state || !cookieState || state !== cookieState) {
      console.warn('[locks] OAuth state mismatch — possível CSRF');
      return redirectWithStatus('error', 'State inválido — possível CSRF attack');
    }

    // 3. Decodifica state para extrair tenantId (validação extra)
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [stateTenantId] = decoded.split(':');
      if (!stateTenantId) {
        return redirectWithStatus('error', 'State sem tenantId');
      }
    } catch {
      return redirectWithStatus('error', 'State malformado');
    }

    // 4. Troca code por tokens no provedor específico
    try {
      switch (provider) {
        case 'ttlock':
          await ttlockExchange({ code });
          break;
        case 'tuya':
          await tuyaExchange({ code });
          break;
        case 'igloohome':
          await igloohomeExchange({ code });
          break;
        case 'nuki':
          await nukiExchange({ code });
          break;
        case 'august':
          // August não usa este callback — fluxo via PIN SMS
          return redirectWithStatus('error', 'August usa fluxo diferente — POST /oauth/august/start');
        default:
          return redirectWithStatus('error', `Provider ${provider} não suportado`);
      }
    } catch (err) {
      console.error(`[locks] OAuth token exchange failed for ${provider}:`, err);
      return redirectWithStatus(
        'error',
        `Falha ao trocar código por tokens: ${(err as Error).message.slice(0, 150)}`,
      );
    }

    // 5. Sucesso — redireciona de volta para o DDC com hash #locks
    return redirectWithStatus('success', `${provider} conectado com sucesso`);
  } catch (error) {
    console.error('[LOCKS] OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: 'OAuth callback failed' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ddc/locks/oauth/august/verify — Verifica PIN August enviado por SMS.
 *
 * August tem fluxo diferente dos outros: o host inicia sessão com email/senha,
 * recebe um PIN de 6 dígitos por SMS, e precisa digitar esse PIN para validar.
 *
 * Esta rota também é usada pelo callback de OAuth quando o provider é 'august'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    if (provider !== 'august') {
      return NextResponse.json(
        { success: false, error: 'POST só suportado para August' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { code } = body;
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: 'PIN deve ter 6 dígitos' },
        { status: 400 },
      );
    }

    const { verifySession } = await import('@/lib/locks/providers/august');
    await verifySession({ code });

    return NextResponse.json({
      success: true,
      message: 'August conectado com sucesso',
    });
  } catch (error) {
    console.error('[LOCKS] August verify error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
