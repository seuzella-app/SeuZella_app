import { NextResponse } from 'next/server';
import { getVapidPublicKey, isPushEnabled } from '@/lib/push/push-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the VAPID public key (safe to expose — it's PUBLIC).
 * Browser uses this to subscribe via pushManager.subscribe({
 *   applicationServerKey: <VAPID_PUBLIC_KEY>
 * }).
 *
 * If VAPID keys are not configured, returns 503 (push disabled).
 */
export async function GET() {
  if (!isPushEnabled()) {
    return NextResponse.json(
      { error: 'PUSH_DISABLED', reason: 'VAPID_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}
