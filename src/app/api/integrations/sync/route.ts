import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { syncAllActiveChannels } from '@/lib/integrations/ical-service';
import { verifySyncSecret } from '@/lib/security/webhook-verify';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { getNextAuthSecret } from '@/lib/env';

/**
 * POST /api/integrations/sync
 *
 * SECURITY (Zero Trust V2):
 * - Auth Path 1: Uses timing-safe comparison for X-Sync-Secret header.
 * - Auth Path 2: Cryptographic M2M Token authorization via verifyCronM2MToken.
 * - Auth Path 3: Authenticated NextAuth session with admin/owner/system_admin role.
 * - Rejects any unauthenticated or forged token with 401.
 */
export async function POST(request: NextRequest) {
  try {
    const syncSecretHeader = request.headers.get('x-sync-secret');
    const configuredSecret = process.env.CALENDAR_SYNC_SECRET;

    let isAuthorized = false;

    // Auth Path 1: Timing-safe secret comparison via X-Sync-Secret header
    if (syncSecretHeader && configuredSecret) {
      const verification = verifySyncSecret(syncSecretHeader, configuredSecret);
      if (verification.valid) {
        isAuthorized = true;
      } else {
        console.warn(`[sync-api] REJECTED (X-Sync-Secret): ${verification.reason}`);
        return NextResponse.json(
          { error: 'UNAUTHORIZED', reason: verification.reason },
          { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
        );
      }
    }

    // Auth Path 2: Strict Cryptographic M2M Auth (Bearer JWT)
    if (!isAuthorized) {
      const m2mAuth = await verifyCronM2MToken(request, 'cerebro:write');
      if (m2mAuth.ok) {
        isAuthorized = true;
      }
    }

    // Auth Path 3: NextAuth session (admin/owner/system_admin)
    if (!isAuthorized) {
      try {
        const secret = process.env.NEXTAUTH_SECRET ? getNextAuthSecret() : undefined;
        const token = await getToken({ req: request as any, secret });
        if (token && ['owner', 'admin', 'system_admin'].includes(String(token.role || ''))) {
          isAuthorized = true;
        }
      } catch {
        // Fallthrough to 401
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Autenticação necessária. Envie o header X-Sync-Secret, credencial M2M válida ou realize login administrativo.' },
        { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v1' } }
      );
    }

    const result = await syncAllActiveChannels();

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      details: result.details,
      message: `Sincronização concluída: ${result.synced} reservas importadas, ${result.errors} erros.`,
    }, {
      headers: { 'X-Security-Shield': 'zero-trust-v1' },
    });
  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      {
        status: 500,
        headers: { 'X-Security-Shield': 'zero-trust-v1' },
      }
    );
  }
}