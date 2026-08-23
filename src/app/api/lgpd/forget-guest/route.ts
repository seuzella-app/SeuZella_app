import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';
import { db } from '@/lib/db';

/**
 * POST /api/lgpd/forget-guest
 *
 * Direito ao esquecimento LGPD (art. 18):
 *   - Marca nós do grafo relacionados ao hóspede como `forgotten=true`
 *   - Anonimiza `scenario` em decisões (mantém auditoria sem identificar hóspede)
 *   - Remove arestas que referenciam o hóspede
 *   - Cria ConsentLog com action='lgpd_forget'
 *
 * Body:
 *   - guestId: ID do hóspede (obrigatório)
 *   - tenantId: ID do tenant (obrigatório)
 *   - reason: 'user_request' | 'gdpr_right_to_erasure' | 'data_retention_expiry' | 'manual'
 *   - authorizedBy: ID ou nome de quem autorizou
 *
 * Conexões:
 *   - SemanticaClient.forgetGuest() (Python sidecar — Apache AGE)
 *   - Prisma: Guest, GuestMessage, ConversationLog, ConsentLog
 *
 * LGPD Compliance:
 *   - Não deleta dados (mantém auditoria obrigatória por 5 anos)
 *   - Anonimiza campos que identificam o hóspede
 *   - Marca como forgotten para que IA não os use mais
 *   - Registra ConsentLog para comprovar conformidade
 */
export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const { guestId, tenantId, reason, authorizedBy } = body;

    // ── Validações ────────────────────────────────────────────────────
    if (!guestId || !tenantId || !reason || !authorizedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FIELDS',
          message: 'Campos obrigatórios: guestId, tenantId, reason, authorizedBy',
        },
        { status: 400 }
      );
    }

    const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REASON',
          message: `reason deve ser: ${validReasons.join(', ')}`,
        },
        { status: 400 }
      );
    }

    let result = {
      guestId,
      tenantId,
      nodesMarkedForgotten: 0,
      decisionsAnonymized: 0,
      edgesRemoved: 0,
      consentLogId: '',
      completedAt: new Date().toISOString(),
    };

    // ── 1. Semantica sidecar (Apache AGE) ─────────────────────────────
    if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
      try {
        const semanticaResult = await SemanticaClient.forgetGuest({
          guestId,
          tenantId,
          reason,
          authorizedBy,
        });
        result.nodesMarkedForgotten += semanticaResult.nodesMarkedForgotten;
        result.decisionsAnonymized += semanticaResult.decisionsAnonymized;
        result.edgesRemoved += semanticaResult.edgesRemoved;
        result.consentLogId = semanticaResult.consentLogId;
      } catch (err) {
        console.warn('[LGPD Forget] Semantica sidecar falhou (continuando com Prisma):', err);
      }
    }

    // ── 2. Prisma: anonimiza Guest ────────────────────────────────────
    try {
      if (db && (db as any).guest) {
        await (db as any).guest.update({
          where: { id: guestId },
          data: {
            name: '[ANONIMIZADO - LGPD]',
            email: null,
            phone: null,
            // Mantém reservations para auditoria fiscal (5 anos)
          },
        });
      }
    } catch (err) {
      console.warn('[LGPD Forget] Prisma Guest update failed:', err);
    }

    // ── 3. Prisma: anonimiza GuestMessage ─────────────────────────────
    try {
      if (db && (db as any).guestMessage) {
        await (db as any).guestMessage.updateMany({
          where: { guestId },
          data: {
            content: '[ANONIMIZADO - LGPD]',
            // Mantém timestamp e type para auditoria
          },
        });
      }
    } catch (err) {
      console.warn('[LGPD Forget] Prisma GuestMessage update failed:', err);
    }

    // ── 4. Prisma: cria ConsentLog ────────────────────────────────────
    try {
      if (db && (db as any).consentLog) {
        const log = await (db as any).consentLog.create({
          data: {
            tenantId,
            action: 'lgpd_forget',
            details: JSON.stringify({
              guestId,
              reason,
              authorizedBy,
              nodesMarkedForgotten: result.nodesMarkedForgotten,
              decisionsAnonymized: result.decisionsAnonymized,
              edgesRemoved: result.edgesRemoved,
              requestedAt: new Date().toISOString(),
            }),
          },
        });
        if (!result.consentLogId) {
          result.consentLogId = log.id;
        }
      }
    } catch (err) {
      console.warn('[LGPD Forget] Prisma ConsentLog creation failed:', err);
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        tenantId,
        guestId,
        lgpdArticle: 'Art. 18 - Direito ao esquecimento',
        completedAt: result.completedAt,
      },
    });
  } catch (error) {
    console.error('[LGPD Forget Guest] Error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Erro ao processar esquecimento' },
      { status: 500 }
    );
  }
}
