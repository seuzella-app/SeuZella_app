import { NextRequest, NextResponse } from 'next/server';
import { revokePin } from '@/lib/locks/orchestrator';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { emitTenantEvent, buildPushForEvent } from '@/lib/realtime/emit-tenant-event';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { id, pinId } = await params;
    if (!id || !pinId || id.length > 128 || pinId.length > 128) {
      return NextResponse.json({ success: false, error: 'INVALID_PIN_REFERENCE' }, { status: 400 });
    }

    const limit = await apiRatelimit.limit(`lock:pin-revoke:${tenantId}:${id}`);
    if (!limit.success) {
      const response = NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });
      response.headers.set('Retry-After', String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))));
      return response;
    }

    const { searchParams } = new URL(request.url);
    const reasonParam = searchParams.get('reason');
    const reason = reasonParam && reasonParam.length <= 300 ? reasonParam : 'Revogado pelo host';
    const ok = await revokePin(pinId, reason);
    if (!ok) return NextResponse.json({ success: false, error: 'PIN_NOT_FOUND' }, { status: 404 });

    const revokePayload = { deviceId: id, pinId, reason };
    void emitTenantEvent(tenantId, 'pin:revoked', revokePayload, buildPushForEvent('pin:revoked', revokePayload));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LOCKS] Error revoking pin:', error);
    return NextResponse.json({ success: false, error: 'PIN_REVOKE_FAILED' }, { status: 500 });
  }
}
