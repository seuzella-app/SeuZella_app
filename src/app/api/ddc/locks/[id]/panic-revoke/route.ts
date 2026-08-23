import { NextRequest, NextResponse } from 'next/server';
import { panicRevokeAllPins } from '@/lib/locks/orchestrator';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { emitTenantEvent, buildPushForEvent } from '@/lib/realtime/emit-tenant-event';

// POST /api/ddc/locks/[id]/panic-revoke — Revoga TODOS os PINs ativos (EMERGÊNCIA)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body?.reason ?? 'Pânico acionado pelo host';

    const result = await panicRevokeAllPins(id, reason);

    const panicPayload = {
      deviceId: id,
      pinId: '*',
      bulkRevoke: true,
      revokedCount: result.revokedCount,
      reason,
    };
    void emitTenantEvent(
      tenantId,
      'pin:revoked',
      panicPayload,
      buildPushForEvent('pin:revoked', panicPayload),
    );

    return NextResponse.json({
      success: true,
      data: { revokedCount: result.revokedCount, message: `${result.revokedCount} PIN(s) revogado(s)` },
    });
  } catch (error) {
    console.error('[LOCKS] Error during panic revoke:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to panic-revoke pins' },
      { status: 500 },
    );
  }
}
