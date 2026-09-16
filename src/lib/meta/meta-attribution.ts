// ==============================================================================
// ZÉLLA — Meta Attribution: Click-to-WhatsApp (Fase 9)
// ==============================================================================
// Usa somente evidência explícita do referral recebido da Meta.
// Não transforma source_id em campaign_id sem evidência do payload.
// ==============================================================================

import { db } from '@/lib/db';
import { META_ATTRIBUTION_ENABLED } from './meta-config';
import { MetaReferralEvent } from './meta-types';
import { recordMetaTelemetry } from './meta-events';

function resolveCtmWindowDays(): number {
  const raw = Number(process.env.META_CTM_WINDOW_DAYS);
  if (Number.isInteger(raw) && raw >= 1 && raw <= 30) return raw;
  return 7;
}

export const CTM_ENTRY_POINT_WINDOW_DAYS = 7;
const ctmWindowDays = resolveCtmWindowDays();

export type MetaAttributionConfidence =
  | 'DETERMINISTIC'
  | 'INFERRED'
  | 'UNATTRIBUTED';

export interface MetaEntryPoint {
  entryPointType: 'click_to_whatsapp' | 'organic' | 'unknown';
  entryPointSource: string | null;
  entryPointSourceId: string | null;
  entryPointSourceUrl: string | null;
  entryPointSourceType: string | null;
  entryPointHeadline: string | null;
  entryPointStartedAt: Date;
  entryPointExpiresAt: Date;
}

export function buildEntryPointFromReferral(
  referral: MetaReferralEvent | null,
  now: Date = new Date()
): MetaEntryPoint {
  const startedAt = now;
  const expiresAt = new Date(now.getTime() + ctmWindowDays * 24 * 60 * 60 * 1000);

  if (!referral || (!referral.source && !referral.sourceId)) {
    return {
      entryPointType: 'organic',
      entryPointSource: referral?.source ?? null,
      entryPointSourceId: referral?.sourceId ?? null,
      entryPointSourceUrl: referral?.sourceUrl ?? null,
      entryPointSourceType: referral?.sourceType ?? null,
      entryPointHeadline: referral?.headline ?? null,
      entryPointStartedAt: startedAt,
      entryPointExpiresAt: expiresAt,
    };
  }

  return {
    entryPointType: 'click_to_whatsapp',
    entryPointSource: referral.source,
    entryPointSourceId: referral.sourceId,
    entryPointSourceUrl: referral.sourceUrl,
    entryPointSourceType: referral.sourceType,
    entryPointHeadline: referral.headline,
    entryPointStartedAt: startedAt,
    entryPointExpiresAt: expiresAt,
  };
}

export async function recordMetaAttribution(params: {
  tenantId: string;
  conversationId?: string | null;
  guestPhone?: string | null;
  referral: MetaReferralEvent | null;
  messageId?: string | null;
  leadId?: string | null;
  reservationId?: string | null;
  reservationValue?: number | null;
}): Promise<void> {
  if (!META_ATTRIBUTION_ENABLED) return;

  try {
    const entryPoint = buildEntryPointFromReferral(params.referral);
    const confidence: MetaAttributionConfidence =
      entryPoint.entryPointType === 'click_to_whatsapp' ? 'DETERMINISTIC' : 'UNATTRIBUTED';

    await db.metaAttributionEvent.create({
      data: {
        tenantId: params.tenantId,
        conversationId: params.conversationId ?? null,
        guestPhone: params.guestPhone ?? null,
        messageId: params.messageId ?? null,
        // Referral não fornece campaignId explicitamente. Não inventar um
        // campaignId a partir de sourceId. sourceId fica preservado como
        // entryPointSourceId; adId só é preenchido quando source_type é 'ad'.
        campaignId: null,
        campaignName: null,
        adId: entryPoint.entryPointSourceType === 'ad' ? entryPoint.entryPointSourceId : null,
        entryPointType: entryPoint.entryPointType,
        entryPointSource: entryPoint.entryPointSource,
        entryPointSourceUrl: entryPoint.entryPointSourceUrl,
        entryPointStartedAt: entryPoint.entryPointStartedAt,
        entryPointExpiresAt: entryPoint.entryPointExpiresAt,
        confidence,
        leadId: params.leadId ?? null,
        reservationId: params.reservationId ?? null,
        reservationValue: params.reservationValue ?? null,
        metadata: JSON.stringify({
          sourceId: entryPoint.entryPointSourceId,
          sourceType: entryPoint.entryPointSourceType,
          sourceUrl: entryPoint.entryPointSourceUrl,
          headline: entryPoint.entryPointHeadline,
          body: params.referral?.body ?? null,
        }),
      },
    });

    if (entryPoint.entryPointType === 'click_to_whatsapp') {
      recordMetaTelemetry({
        name: 'meta.attribution.detected',
        tenantId: params.tenantId,
        message: 'Click-to-WhatsApp attribution registrada',
        context: {
          sourceId: entryPoint.entryPointSourceId,
          sourceType: entryPoint.entryPointSourceType,
          confidence,
          messageId: params.messageId ?? null,
        },
      });
    }
  } catch (error) {
    console.error('[meta-attribution] recordMetaAttribution failed (non-fatal):', error);
  }
}

export async function isMetaAcquiredConversation(
  tenantId: string,
  conversationId: string
): Promise<boolean> {
  if (!tenantId || !conversationId) return false;
  try {
    const attr = await db.metaAttributionEvent.findFirst({
      where: {
        tenantId,
        conversationId,
        entryPointType: 'click_to_whatsapp',
        confidence: 'DETERMINISTIC',
        entryPointExpiresAt: { gte: new Date() },
      },
      select: { id: true },
    });
    return attr !== null;
  } catch {
    return false;
  }
}

export interface AttributionLinkCandidate {
  id: string;
  confidence: string;
  entryPointType: string;
  entryPointExpiresAt: Date;
  entryPointStartedAt?: Date;
}

export function pickAttributionForLink(
  events: AttributionLinkCandidate[],
  now: Date = new Date()
): AttributionLinkCandidate | null {
  const eligible = events
    .filter(
      (e) =>
        e.entryPointType === 'click_to_whatsapp' &&
        e.confidence === 'DETERMINISTIC' &&
        e.entryPointExpiresAt.getTime() >= now.getTime()
    )
    .sort(
      (a, b) =>
        (b.entryPointStartedAt?.getTime() ?? 0) -
        (a.entryPointStartedAt?.getTime() ?? 0)
    );
  return eligible[0] ?? null;
}

export async function linkReservationToMetaAttribution(params: {
  tenantId: string;
  guestPhone: string;
  reservationId: string;
  reservationValue?: number | null;
}): Promise<boolean> {
  const { tenantId, guestPhone, reservationId, reservationValue } = params;
  if (!tenantId || !guestPhone || !reservationId) return false;

  try {
    const candidates = await db.metaAttributionEvent.findMany({
      where: {
        tenantId,
        guestPhone,
        reservationId: null,
        entryPointType: 'click_to_whatsapp',
        confidence: 'DETERMINISTIC',
        entryPointExpiresAt: { gte: new Date() },
      },
      orderBy: { entryPointStartedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        confidence: true,
        entryPointType: true,
        entryPointExpiresAt: true,
        entryPointStartedAt: true,
      },
    });

    const target = pickAttributionForLink(candidates);
    if (!target) return false;

    const linked = await db.metaAttributionEvent.updateMany({
      where: { id: target.id, tenantId, reservationId: null },
      data: {
        reservationId,
        reservationValue:
          typeof reservationValue === 'number' && Number.isFinite(reservationValue)
            ? reservationValue
            : null,
        metadata: JSON.stringify({
          linkedAt: new Date().toISOString(),
          linkedBy: 'reservation_pipeline',
        }),
      },
    });

    if (linked.count === 0) return false;

    recordMetaTelemetry({
      name: 'meta.attribution.detected',
      tenantId,
      message: 'Reserva linkada à attribution Click-to-WhatsApp',
      context: { reservationId, reservationValue: reservationValue ?? null },
    });

    return true;
  } catch (error) {
    console.error('[meta-attribution] linkReservationToMetaAttribution failed (non-fatal):', error);
    return false;
  }
}

export async function linkAttributionToConversation(params: {
  tenantId: string;
  messageId: string;
  conversationId: string;
}): Promise<boolean> {
  const { tenantId, messageId, conversationId } = params;
  if (!tenantId || !messageId || !conversationId) return false;

  try {
    const linked = await db.metaAttributionEvent.updateMany({
      where: {
        tenantId,
        messageId,
        conversationId: null,
      },
      data: { conversationId },
    });
    return linked.count > 0;
  } catch (error) {
    console.error('[meta-attribution] linkAttributionToConversation failed (non-fatal):', error);
    return false;
  }
}
