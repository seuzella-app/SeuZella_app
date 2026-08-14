// ============================================================================
// ZÉLLA — Cron: OTA Token Expiry Check (1h)
// ============================================================================
// Verifica OAuth tokens de Booking.com e Airbnb que expiram em < 24h.
// Chama bridgeOtaTokenExpired para cada token próximo da expiração.
// Schedule Vercel: 0 * * * *  (a cada hora cheia)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bridgeOtaTokenExpired } from '@/lib/notifications/bridges';
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

  let processed = 0;
  let alerted = 0;

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // ── Query OAuthToken table for tokens expiring in next 24h ──
    // Schema field name may vary; we try `expiresAt` first.
    let expiringTokens: any[] = [];
    try {
      expiringTokens = await (db as any).oAuthToken?.findMany({
        where: { expiresAt: { lte: horizon, gt: now } },
        select: { id: true, tenantId: true, provider: true, expiresAt: true },
      }) ?? [];
    } catch (dbErr) {
      console.warn('[Cron:ota-token-expiry] OAuthToken table not available — skipping');
    }

    processed = expiringTokens.length;

    for (const token of expiringTokens) {
      try {
        const provider = (token.provider === 'airbnb' ? 'Airbnb' : 'Booking.com') as
          | 'Booking.com'
          | 'Airbnb';
        bridgeOtaTokenExpired({
          niche: provider === 'Airbnb' ? 'airbnb' : 'pousada',
          provider,
          tenantId: token.tenantId,
        });
        alerted++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:ota-token-expiry] bridgeOtaTokenExpired failed for token ${token.id}:`,
          bridgeErr
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      processed,
      alerted,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${alerted} token(s) próximo(s) de expiração notificado(s)`,
    });
  } catch (error) {
    console.error('[Cron:ota-token-expiry] Error:', error);
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
