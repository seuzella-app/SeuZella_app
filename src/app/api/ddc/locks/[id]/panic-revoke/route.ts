import { NextRequest, NextResponse } from 'next/server';
import { panicRevokeAllPins } from '@/lib/locks/orchestrator';

// POST /api/ddc/locks/[id]/panic-revoke — Revoga TODOS os PINs ativos (EMERGÊNCIA)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body?.reason ?? 'Pânico acionado pelo host';

    const result = await panicRevokeAllPins(id, reason);
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
