import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';
import { db } from '@/lib/db';

/**
 * POST /api/lgpd/forget-guest
 *
 * LGPD erasure/anonymization for a guest. ZCC access is required, but the
 * tenant is never trusted from the request body: the guest record is the
 * authoritative tenant binding.
 */
export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const { guestId, tenantId: requestedTenantId, reason, authorizedBy } = body;

    if (!guestId || !requestedTenantId || !reason || !authorizedBy) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'Campos obrigatórios: guestId, tenantId, reason, authorizedBy' },
        { status: 400 }
      );
    }

    const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_REASON', message: `reason deve ser: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Never trust a tenantId supplied by the caller. Bind the operation to the
    // guest's persisted tenant and reject cross-tenant requests before mutation.
    const guest = await db.guest.findFirst({ where: { id: guestId, tenantId: requestedTenantId }, select: { id: true, tenantId: true } });
    if (!guest) {
      return NextResponse.json({ success: false, error: 'GUEST_NOT_FOUND' }, { status: 404 });
    }
    const {tenantId} = guest;

    const result = {
      guestId,
      tenantId,
      nodesMarkedForgotten: 0,
      decisionsAnonymized: 0,
      edgesRemoved: 0,
      consentLogId: '',
      completedAt: new Date().toISOString(),
    };

    if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
      try {
        const semanticaResult = await SemanticaClient.forgetGuest({ guestId, tenantId, reason, authorizedBy });
        result.nodesMarkedForgotten += semanticaResult.nodesMarkedForgotten;
        result.decisionsAnonymized += semanticaResult.decisionsAnonymized;
        result.edgesRemoved += semanticaResult.edgesRemoved;
        result.consentLogId = semanticaResult.consentLogId;
      } catch (err) {
        console.warn('[LGPD Forget] Semantica sidecar falhou (continuando com Prisma):', err instanceof Error ? err.name : 'unknown');
      }
    }

    await db.guest.update({
      where: { id: guest.id },
      data: { name: '[ANONIMIZADO - LGPD]', email: null, phone: null },
    });

    await db.guestMessage.updateMany({
      where: { guestId: guest.id },
      data: { content: '[ANONIMIZADO - LGPD]' },
    });

    const log = await db.consentLog.create({
      data: {
        tenantId,
        guestId: guest.id,
        type: 'lgpd_forget',
        channel: 'system',
        evidence: JSON.stringify({
          action: 'lgpd_forget',
          reason,
          authorizedBy,
          nodesMarkedForgotten: result.nodesMarkedForgotten,
          decisionsAnonymized: result.decisionsAnonymized,
          edgesRemoved: result.edgesRemoved,
          requestedAt: new Date().toISOString(),
        }),
      },
    });
    result.consentLogId = result.consentLogId || log.id;

    return NextResponse.json({
      success: true,
      data: result,
      meta: { tenantId, guestId, lgpdArticle: 'Art. 18 - Direito ao esquecimento', completedAt: result.completedAt },
    });
  } catch (error) {
    console.error('[LGPD Forget Guest] Error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao processar esquecimento' }, { status: 500 });
  }
}
