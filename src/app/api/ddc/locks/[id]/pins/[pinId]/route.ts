import { NextRequest, NextResponse } from 'next/server';
import { revokePin } from '@/lib/locks/orchestrator';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// DELETE /api/ddc/locks/[id]/pins/[pinId] — Revoga um PIN específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { pinId } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') ?? 'Revogado pelo host';

    const ok = await revokePin(pinId, reason);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'PIN não encontrado' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LOCKS] Error revoking pin:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to revoke pin' },
      { status: 500 },
    );
  }
}
