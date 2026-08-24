import { NextRequest, NextResponse } from 'next/server';
import { panicRevokeAllPins } from '@/lib/locks/orchestrator';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { emitTenantEvent, buildPushForEvent } from '@/lib/realtime/emit-tenant-event';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ error: 'INVALID_DEVICE_ID' }, { status: 400 });

    const limit = await apiRatelimit.limit(`lock:panic:${tenantId}:${id}`);
    if (!limit.success) {
      const response = NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });
      response.headers.set('Retry-After', String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))));
      return response;
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' && body.reason.trim().length <= 300
      ? body.reason.trim()
      : 'Pânico acionado pelo host';

    const result = await panicRevokeAllPins(id, reason);
    const panicPayload = { deviceId: id, pinId: '*', bulkRevoke: true, revokedCount: result.revokedCount, reason };
    void emitTenantEvent(tenantId, 'pin:revoked', panicPayload, buildPushForEvent('pin:revoked', panicPayload));

    return NextResponse.json({ success: true, data: { revokedCount: result.revokedCount, message: `${result.revokedCount} PIN(s) revogado(s)` } });
  } catch (error) {
    console.error('[LOCKS] Error during panic revoke:', error);
    return NextResponse.json({ success: false, error: 'PANIC_REVOKE_FAILED' }, { status: 500 });
  }
}
