import { NextRequest, NextResponse } from 'next/server';
import { listLockEvents } from '@/lib/locks/orchestrator';

// GET /api/ddc/locks/events — Lista eventos de auditoria LGPD
//
// Query params:
//   deviceId (opcional) — filtra por dispositivo específico
//   limit (opcional, default 50, max 200)
export async function GET(request: NextRequest) {
  try {
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
