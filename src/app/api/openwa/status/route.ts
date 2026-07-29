import { NextRequest, NextResponse } from 'next/server';
import { getOpenWASessionStatus } from '@/lib/openwa-client';

/**
 * GET `/api/openwa/status`
 * Retorna o status atual do gateway OpenWA e QR code se pendente de pareamento.
 */
export async function GET(request: NextRequest) {
  try {
    const session = request.nextUrl.searchParams.get('session') || undefined;
    const statusData = await getOpenWASessionStatus(session);

    return NextResponse.json({
      success: true,
      provider: 'OpenWA',
      ...statusData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        provider: 'OpenWA',
        status: 'OFFLINE',
        error: error instanceof Error ? error.message : 'Failed to query OpenWA status',
      },
      { status: 500 }
    );
  }
}
