import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createFNRHRecord, updateFNRHData, verifyAndReleaseLock, extractGuestDataFromMessage, generateFNRHCollectionMessage } from '@/lib/fnrh';

/**
 * POST /api/ddc/guest-registration — Cria FNRH pendente
 * PATCH /api/ddc/guest-registration — Atualiza dados coletados
 * GET /api/ddc/guest-registration?tenantId=xxx&guestId=xxx — Verifica status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const guestId = searchParams.get('guestId');

  if (!tenantId || !guestId) return NextResponse.json({ success: false, error: 'MISSING_PARAMS' }, { status: 400 });

  try {
    if (db && (db as any).guestRegistration) {
      const record = await (db as any).guestRegistration.findFirst({
        where: { tenantId, guestId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ success: true, data: record ? JSON.parse(record.data || '{}') : null });
    }
    return NextResponse.json({ success: true, data: null, meta: { source: 'fallback' } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, guestId, reservationId } = body;
    if (!tenantId || !guestId) return NextResponse.json({ success: false, error: 'MISSING_PARAMS' }, { status: 400 });

    const fnrh = await createFNRHRecord({ tenantId, guestId, reservationId });
    const message = generateFNRHCollectionMessage();
    return NextResponse.json({ success: true, data: { fnrh, message } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fnrhId, data, tenantId, guestId, reservationId } = body;

    // Se tem mensagem, extrai dados
    let extractedData = data;
    if (body.message) {
      extractedData = { ...data, ...extractGuestDataFromMessage(body.message) };
    }

    const updated = await updateFNRHData(fnrhId, extractedData);
    if (!updated) return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    // Se completou, verifica liberação de fechadura
    if (updated.status === 'completed') {
      const release = await verifyAndReleaseLock({ tenantId, guestId, reservationId });
      return NextResponse.json({ success: true, data: { fnrh: updated, lockReleased: release.released, reason: release.reason } });
    }

    return NextResponse.json({ success: true, data: { fnrh: updated } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
