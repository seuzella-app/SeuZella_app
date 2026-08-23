import { NextRequest, NextResponse } from 'next/server';
import { listLockEvents } from '@/lib/locks/orchestrator';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/ddc/locks/events — Lista eventos de auditoria LGPD
//
// Query params:
//   deviceId (opcional) — filtra por dispositivo específico
//   limit (opcional, default 50, max 200)
export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

    const events = await listLockEvents(deviceId, limit);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('[LOCKS] Error listing events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list lock events' },
      { status: 500 },
    );
  }
}
