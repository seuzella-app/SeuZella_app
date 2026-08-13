import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { autoReturnCautions } from '@/lib/payments/caution';

/**
 * GET /api/cron/caution-auto-return (a cada hora)
 * Estorna cações 24h após check-out se não houver sinistro.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  const result = await autoReturnCautions();
  return NextResponse.json({ success: true, data: result });
}
