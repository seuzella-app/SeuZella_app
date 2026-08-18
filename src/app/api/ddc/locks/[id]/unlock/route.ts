/**
 * POST /api/ddc/locks/[id]/unlock
 * =================================
 *
 * Destrava remotamente uma fechadura (apenas Nuki e August suportam).
 * Registra LockEvent eventType='remote_unlock'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { remoteUnlock } from '@/lib/locks/orchestrator';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceId = params.id;
    const result = await remoteUnlock(deviceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Fechadura destravada remotamente',
    });
  } catch (error: any) {
    console.error('[LOCKS_UNLOCK] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Falha ao destravar' },
      { status: 500 },
    );
  }
}
