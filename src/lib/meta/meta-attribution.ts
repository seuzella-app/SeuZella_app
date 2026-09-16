// ==============================================================================
// ZÉLLA — Meta Attribution: Click-to-WhatsApp (Fase 9)
// ==============================================================================
// O webhook já recebe `referral` — usamos essa informação para atribuir
// campanha → anúncio → entry point → conversa → lead → reserva.
//
// IMPORTANTE: NÃO hardcodar a janela de 7 dias sem armazenar a origem.
// Guardamos entryPointType / entryPointStartedAt / entryPointExpiresAt
// para o Growth OS saber exatamente quais conversas vieram de aquisição Meta.
// ==============================================================================

import { db } from '@/lib/db';
import { META_ATTRIBUTION_ENABLED } from './meta-config';
import { MetaReferralEvent } from './meta-types';
import { recordMetaTelemetry } from './meta-events';

/**
 * Janela padrão de entrada Click-to-Message (Meta) — 7 dias.
 *
 * HARDENING (auditoria FASE 7): o valor NÃO é mais um constante cego — é o
 * DEFAULT configurável via env META_CTM_WINDOW_DAYS (1–30). A autoridade
 * real da janela é a Meta (varia por placement/programação do anúncio);
 * quando o payload/endpoint oficial passar a informação, ela deve sobrepor
 * este default. O valor aplicado fica armazenado por evento em
 * entryPointExpiresAt — nenhuma análise deve hardcodar 7 dias.
 */
function resolveCtmWindowDays(): number {
  const raw = Number(process.env.META_CTM_WINDOW_DAYS);
  if (Number.isInteger(raw) && raw >= 1 && raw <= 30) return raw;
  return 7;
}

export const CTM_ENTRY_POINT_WINDOW_DAYS = 7; // default documentado (compat)
const ctmWindowDays = resolveCtmWindowDays();

export type MetaAttributionConfidence =
  | 'DETERMINISTIC' // referral presente no payload da Meta
  | 'INFERRED' // deduzido por heurística (ex: campanha conhecida)
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

/**
 * Registra o evento de atribuição (campaign → ad → entry point → conversation).
 * Persiste em MetaAttributionEvent para o Growth OS consumir depois.
 * Fire-and-forget: falha de atribuição NUNCA quebra a conversa.
 */
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
        campaignId: entryPoint.entryPointSourceId,
        campaignName: entryPoint.entryPointHeadline,
        adId: entryPoint.entryPointSourceId,
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
          sourceType: entryPoint.entryPointSourceType,
          headline: entryPoint.entryPointHeadline,
          body: null,
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
          confidence,
          messageId: params.messageId ?? null,
        },
      });
    }
  } catch (error) {
    console.error('[meta-attribution] recordMetaAttribution failed (non-fatal):', error);
  }
}

/** Consulta: conversa veio de aquisição Meta e o entry point ainda está válido? */
export async function isMetaAcquiredConversation(conversationId: string): Promise<boolean> {
  try {
    const attr = await db.metaAttributionEvent.findFirst({
      where: {
        conversationId,
        entryPointType: 'click_to_whatsapp',
        entryPointExpiresAt: { gte: new Date() },
      },
      select: { id: true },
    });
    return attr !== null;
  } catch {
    return false;
  }
}

// ── FASE 7 — Fechamento da cadeia: RESERVA → ATTRIBUTION ─────────────────────
// A conversa Meta-acquired nasce com MetaAttributionEvent (conversationId +
// guestPhone), mas a RESERVA costuma ser criada depois (ex.: /api/v1/reservations).
// Sem o link explícito, reservationId/reservationValue ficam NULL para sempre e
// a receita nunca é atribuível à campanha. Este helper fecha a ligação —
// NUNCA inferindo: só linka attribution DETERMINISTIC com entry point vigente.

export interface AttributionLinkCandidate {
  id: string;
  confidence: string;
  entryPointType: string;
  entryPointExpiresAt: Date;
}

/**
 * Seleção PURA (unit-testável) do evento de atribuição a ser linkado à reserva:
 *  - somente click_to_whatsapp (origem comprovada — DETERMINISTIC);
 *  - entry point ainda dentro da janela vigente;
 *  - ainda sem reserva linkada;
 *  - mais recente primeiro.
 */
export function pickAttributionForLink(
  events: AttributionLinkCandidate[],
  now: Date = new Date()
): AttributionLinkCandidate | null {
  const eligible = events.filter(
    (e) =>
      e.entryPointType === 'click_to_whatsapp' &&
      e.confidence === 'DETERMINISTIC' &&
      e.entryPointExpiresAt.getTime() >= now.getTime()
  );
  if (eligible.length === 0) return null;
  return eligible[0] ?? null;
}

/**
 * Linka uma reserva ao evento de atribuição Meta do hóspede (FASE 7).
 * Fire-and-forget seguro: retorna false em qualquer falha — a reserva JÁ foi
 * persistida e NUNCA pode quebrar por causa de atribuição.
 *
 * Regras: sem inferência. Se não há referral Meta comprovado e vigente para o
 * telefone do hóspede, a reserva permanece UNATTRIBUTED.
 */
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
        reservationId: null, // só eventos ainda não linkados
        entryPointType: 'click_to_whatsapp',
      },
      orderBy: { entryPointStartedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        confidence: true,
        entryPointType: true,
        entryPointExpiresAt: true,
      },
    });

    const target = pickAttributionForLink(candidates);
    if (!target) return false; // sem evidência Meta — permanece UNATTRIBUTED

    // HARDENING (auditoria FASE 4): update SEMPRE com guard de tenant —
    // o id sozinho não prova pertencimento; tenantId vem do caller autenticado.
    const linked = await db.metaAttributionEvent.updateMany({
      where: { id: target.id, tenantId },
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

    if (linked.count === 0) return false; // tenant mismatch — não linka

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

// ── Onda correção/hardening — fechamento ATTRIBUTION → CONVERSATION ─────────
// A auditoria confirmou: o webhook grava MetaAttributionEvent ANTES de criar
// a ConversationLog (mensagem inbound é buffered → processada depois), então
// conversationId ficava NULL para sempre. Assim que o pipeline expõe o id da
// conversa, este helper fecha o vínculo por (tenantId, messageId) — sem
// inferência: só o evento de atribuição do MESMO messageId da MESMA conversa.

/**
 * Linka a attribution registrada para `messageId` à conversa criada depois.
 * Fire-and-forget seguro: false em qualquer falha — NUNCA quebra o pipeline.
 * Não sobrescreve um conversationId já existente (idempotente).
 */
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
        conversationId: null, // idempotente: não sobrescreve vínculo existente
      },
      data: { conversationId },
    });
    return linked.count > 0;
  } catch (error) {
    console.error('[meta-attribution] linkAttributionToConversation failed (non-fatal):', error);
    return false;
  }
}
