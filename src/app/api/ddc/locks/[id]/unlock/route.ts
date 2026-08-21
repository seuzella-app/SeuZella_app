/**
 * POST /api/ddc/locks/[id]/unlock
 *
 * Remote unlock is a privileged physical-world action. The route therefore
 * exposes only sanitized errors and delegates tenant/eligibility enforcement
 * to the lock orchestration policy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { remoteUnlock } from '@/lib/locks/orchestrator';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RESERVATION_NOT_ELIGIBLE: 403,
  ACCESS_WINDOW_CLOSED: 403,
  ACCESS_ALREADY_REVOKED: 409,
  PROVIDER_UNAVAILABLE: 503,
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: deviceId } = await params;
    if (!deviceId || deviceId.length > 128) {
      return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });
    }

    const result = await remoteUnlock(deviceId);
    if (!result.success) {
      const code = typeof result.error === 'string' && ERROR_STATUS[result.error]
        ? result.error
        : 'REMOTE_UNLOCK_FAILED';
      return NextResponse.json(
        { success: false, error: code },
        { status: ERROR_STATUS[code] ?? 503 },
      );
    }

    return NextResponse.json(
      { success: true, message: 'REMOTE_UNLOCK_CONFIRMED' },
      { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  } catch (error) {
    console.error('[LOCKS_UNLOCK] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'REMOTE_UNLOCK_FAILED' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  }
}
