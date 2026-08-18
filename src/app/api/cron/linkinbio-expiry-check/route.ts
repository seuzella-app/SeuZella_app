// ============================================================================
// ZÉLLA — Cron: Link-in-Bio Expiry Check (Daily 10:00 BRT = 13:00 UTC)
// ============================================================================
// Verifica Link-in-Bio de tenants LITE:
//   - Dia 58-59: dispara notificação motivational com stats de 60 dias
//   - Dia 60+: desativa Link-in-Bio + dispara notificação de oferta R$ 47
// Schedule Vercel: 0 13 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkLinkInBioExpiry } from '@/lib/notifications/linkinbio-addon';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runCheck(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runCheck(request);
}

async function runCheck(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
    // Auth unificada: M2M EdDSA JWT primeiro, fallback CRON_SECRET
  const auth = await verifyCronAuth(request, 'reports:read');
  if (!auth.ok) return auth.response!;

  try {
    const result = await checkLinkInBioExpiry();
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      warnings: result.warnings,
      deactivations: result.deactivations,
      errors: result.errors.slice(0, 5),
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${result.warnings} aviso(s) de expiração, ${result.deactivations} desativação(ões)`,
    });
  } catch (error) {
    console.error('[Cron:linkinbio-expiry-check] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
