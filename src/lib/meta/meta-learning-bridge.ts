// ==============================================================================
// ZÉLLA — Meta Learning Bridge
// ==============================================================================
// Integra o contexto Meta ao ConversationLearner existente sem criar um segundo
// pipeline de aprendizagem.
//
// O ConversationLearner continua sendo o DONO da extração/promoção de padrões.
// Este bridge apenas registra outcome/contexto no ConversationLog + telemetria.
// Nenhuma mensagem bruta é promovida por este módulo.
// ==============================================================================

import { db } from '@/lib/db';
import { recordConversationOutcome, ZellmOutcome } from './meta-learning';

function readJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeOutcome(value: unknown): ZellmOutcome {
  if (
    value === 'RESERVATION_SUCCESS' ||
    value === 'LEAD_QUALIFIED' ||
    value === 'HUMAN_HANDOVER' ||
    value === 'NO_OUTCOME' ||
    value === 'FAILURE'
  ) {
    return value;
  }
  return 'NO_OUTCOME';
}

/**
 * Registra somente contexto/outcome explícito. Sem evidência de reserva,
 * qualificação ou handover, permanece NO_OUTCOME e não promove nada.
 */
export async function recordResolvedConversationMetaLearning(
  tenantId: string,
  conversationId: string,
  status: 'resolved' | 'escalated'
): Promise<void> {
  const conversation = await db.conversationLog.findFirst({
    where: { id: conversationId, tenantId },
    select: { metadata: true },
  });
  if (!conversation) return;

  const metadata = readJson(conversation.metadata);
  const zellm = (metadata.zellm as Record<string, unknown> | undefined) ?? {};

  const explicitOutcome = normalizeOutcome(zellm.outcome);
  const outcome: ZellmOutcome =
    status === 'escalated' && explicitOutcome === 'NO_OUTCOME'
      ? 'HUMAN_HANDOVER'
      : explicitOutcome;

  await recordConversationOutcome({
    tenantId,
    conversationId,
    guestId: typeof zellm.guestId === 'string' ? zellm.guestId : null,
    channel:
      zellm.channel === 'INSTAGRAM' || zellm.channel === 'WEB' ? zellm.channel : 'WHATSAPP',
    intent: typeof zellm.intent === 'string' ? zellm.intent : null,
    messageType: typeof zellm.messageType === 'string' ? zellm.messageType : null,
    metaCategory: typeof zellm.metaCategory === 'string' ? zellm.metaCategory : null,
    entryPointType: typeof zellm.entryPointType === 'string' ? zellm.entryPointType : null,
    campaignId: typeof zellm.campaignId === 'string' ? zellm.campaignId : null,
    leadStatus: typeof zellm.leadStatus === 'string' ? zellm.leadStatus : null,
    reservationStatus: typeof zellm.reservationStatus === 'string' ? zellm.reservationStatus : null,
    reservationValue: typeof zellm.reservationValue === 'number' ? zellm.reservationValue : null,
    humanHandover: status === 'escalated' || outcome === 'HUMAN_HANDOVER',
    outcome,
  });
}
