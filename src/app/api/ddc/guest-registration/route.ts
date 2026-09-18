import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createFNRHRecord, updateFNRHData, verifyAndReleaseLock, extractGuestDataFromMessage, generateFNRHCollectionMessage } from '@/lib/fnrh';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/ddc/guest-registration — Cria FNRH pendente
 * PATCH /api/ddc/guest-registration — Atualiza dados coletados
 * GET /api/ddc/guest-registration?guestId=xxx — Verifica status
 *
 * Wave B IDOR fix: tenantId now derived from session, NOT from query param.
 * RUN 6 tenant authority fix: POST e PATCH agora exigem sessão (o GET já
 * exigia). O tenant da sessão é a autoridade; o tenantId do cliente é aceito
 * apenas se coincidir. PATCH deriva tenant/guest do REGISTRO no DB — nunca
 * do body — para a liberação de fechadura (lockRelease não pode ser
 * controlada pelo cliente).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) return NextResponse.json({ success: false, error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  if (!guestId) return NextResponse.json({ success: false, error: 'MISSING_PARAMS' }, { status: 400 });

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
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const sessionTenantId = (session.user as any).tenantId;
  if (!sessionTenantId) return NextResponse.json({ success: false, error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });

  try {
    const body = await request.json();
    const { tenantId, guestId, reservationId } = body;
    if (!guestId) return NextResponse.json({ success: false, error: 'MISSING_PARAMS' }, { status: 400 });
    if (tenantId && tenantId !== sessionTenantId) {
      return NextResponse.json({ success: false, error: 'TENANT_MISMATCH' }, { status: 403 });
    }

    // RUN 6 — resource ownership: guestId e reservationId precisam pertencer
    // ao tenant da sessão (nunca criar FNRH sobre recursos de outro tenant).
    const ownedGuest = await db.guest.findFirst({ where: { id: guestId, tenantId: sessionTenantId }, select: { id: true } });
    if (!ownedGuest) return NextResponse.json({ success: false, error: 'GUEST_NOT_FOUND' }, { status: 404 });
    if (reservationId) {
      const ownedReservation = await db.reservation.findFirst({ where: { id: reservationId, tenantId: sessionTenantId }, select: { id: true } });
      if (!ownedReservation) return NextResponse.json({ success: false, error: 'RESERVATION_NOT_FOUND' }, { status: 404 });
    }

    const fnrh = await createFNRHRecord({ tenantId: sessionTenantId, guestId, reservationId });
    const message = generateFNRHCollectionMessage();
    return NextResponse.json({ success: true, data: { fnrh, message } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const sessionTenantId = (session.user as any).tenantId;
  if (!sessionTenantId) return NextResponse.json({ success: false, error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });

  try {
    const body = await request.json();
    const { fnrhId, data, tenantId } = body;
    if (tenantId && tenantId !== sessionTenantId) {
      return NextResponse.json({ success: false, error: 'TENANT_MISMATCH' }, { status: 403 });
    }

    // Se tem mensagem, extrai dados
    let extractedData = data;
    if (body.message) {
      extractedData = { ...data, ...extractGuestDataFromMessage(body.message) };
    }

    // RUN 6 — a busca do registro é escopada ao tenant da sessão (404
    // indistinguível para registro de outro tenant).
    const updated = await updateFNRHData(fnrhId, extractedData, sessionTenantId);
    if (!updated) return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    // Se completou, verifica liberação de fechadura — identidade derivada
    // do REGISTRO persistido, nunca do body do cliente.
    if (updated.status === 'completed') {
      const release = await verifyAndReleaseLock({
        tenantId: sessionTenantId,
        guestId: updated.guestId,
        reservationId: updated.reservationId,
      });
      return NextResponse.json({ success: true, data: { fnrh: updated, lockReleased: release.released, reason: release.reason } });
    }

    return NextResponse.json({ success: true, data: { fnrh: updated } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
