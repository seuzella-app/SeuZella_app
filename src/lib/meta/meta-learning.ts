// ==============================================================================
// ZÉLLA — ZéLLM Learning Contract: Meta → Cérebro (Fase 14 / 15 / 16 / 17)
// ==============================================================================
// ZéLLM NÃO é um novo modelo autônomo. É a camada cognitiva APRENDIDA do
// Cérebro Zélla: produz artefatos de aprendizado a partir do resultado real
// das conversas (conversão, handover humano, reserva) — nunca com mensagem
// bruta automática.
//
// CONTRATO DE APRENDIZAGEM (Fase 15):
//   capture → sanitize → validate → score → promote
// Somente padrões COMPROVADOS são promovidos. Anti-patterns NUNCA.
//
// Enriquecimento Meta (Fase 17): canal, source, campaign, entryPoint, intent,
// metaCategory, outcome → o ZéLLM aprende "qual resposta CONVERTE melhor",
// não apenas "qual resposta parece boa".
// ==============================================================================

import { db } from '@/lib/db';
import { META_LEARNING_ENABLED } from './meta-config';
import { recordMetaTelemetry } from './meta-events';

export type ZellmOutcome =
  | 'RESERVATION_SUCCESS' // pergunta → resposta → cotação → reserva
  | 'LEAD_QUALIFIED'
  | 'HUMAN_HANDOVER' // humano corrigiu a IA
  | 'NO_OUTCOME'
  | 'FAILURE';

export interface ZellmLearningContext {
  tenantId: string;
  conversationId: string;
  guestId?: string | null;
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'WEB';
  intent?: string | null;
  messageType?: string | null;
  metaCategory?: string | null;
  entryPointType?: string | null;
  campaignId?: string | null;
  leadStatus?: string | null;
  reservationStatus?: string | null;
  reservationValue?: number | null;
  humanHandover?: boolean;
  outcome: ZellmOutcome;
}

// ── 1. CAPTURE ───────────────────────────────────────────────────────────────

/**
 * Registra o resultado observado de uma conversa Meta→Cérebro.
 * NÃO promove nada sozinho: apenas cria a evidência (outcome) que alimenta
 * o score de padrões existentes (ConversationLearner / KnowledgeEntry).
 */
export async function recordConversationOutcome(ctx: ZellmLearningContext): Promise<void> {
  if (!META_LEARNING_ENABLED) return;

  try {
    recordMetaTelemetry({
      name: 'meta.learning.outcome',
      tenantId: ctx.tenantId,
      message: `Outcome ${ctx.outcome} registrado para aprendizagem ZéLLM`,
      context: {
        conversationId: ctx.conversationId,
        channel: ctx.channel,
        intent: ctx.intent ?? null,
        metaCategory: ctx.metaCategory ?? null,
        entryPointType: ctx.entryPointType ?? null,
        campaignId: ctx.campaignId ?? null,
        leadStatus: ctx.leadStatus ?? null,
        reservationStatus: ctx.reservationStatus ?? null,
        reservationValue: ctx.reservationValue ?? null,
        humanHandover: ctx.humanHandover ?? false,
      },
    });

    // Enriquece a conversa com o contexto Meta (sem duplicar pipeline):
    // usa metadata JSON do ConversationLog — campo existente, aditivo.
    // HARDENING (onda correção/hardening): leitura e escrita SEMPRE com o
    // guard de tenant — findUnique/update por id puro permitiria que um
    // tenantId trocado tocasse conversa de outro tenant.
    const existing = await db.conversationLog.findFirst({
      where: { id: ctx.conversationId, tenantId: ctx.tenantId },
      select: { metadata: true },
    });
    if (!existing) return;

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(existing.metadata || '{}') as Record<string, unknown>;
    } catch {
      meta = {};
    }

    const zellm = (meta.zellm as Record<string, unknown> | undefined) ?? {};
    // reservationValue entra no metadata (contrato do meta-learning-bridge,
    // que lê zellm.reservationValue — antes era escrito como null para sempre).
    await db.conversationLog.updateMany({
      where: { id: ctx.conversationId, tenantId: ctx.tenantId },
      data: {
        metadata: JSON.stringify({
          ...meta,
          zellm: {
            ...zellm,
            channel: ctx.channel,
            intent: ctx.intent ?? zellm.intent ?? null,
            metaCategory: ctx.metaCategory ?? zellm.metaCategory ?? null,
            entryPointType: ctx.entryPointType ?? zellm.entryPointType ?? null,
            campaignId: ctx.campaignId ?? zellm.campaignId ?? null,
            reservationValue:
              typeof ctx.reservationValue === 'number' && Number.isFinite(ctx.reservationValue)
                ? ctx.reservationValue
                : zellm.reservationValue ?? null,
            lastOutcome: ctx.outcome,
            outcomeUpdatedAt: new Date().toISOString(),
          },
        }),
      },
    });
  } catch (error) {
    console.error('[meta-learning] recordConversationOutcome failed (non-fatal):', error);
  }
}

// ── 2. SANITIZE / 3. VALIDATE ────────────────────────────────────────────────

export interface ZellmPatternCandidate {
  tenantId: string;
  category: 'verified_pattern' | 'anti_pattern';
  question: string;
  answer: string;
  outcome: ZellmOutcome;
  occurrences: number;
}

const FORBIDDEN_PATTERN_TOKENS = [
  /senha/i,
  /password/i,
  /cart[ãa]o/i,
  /cpf/i,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, // CPF formatado
  /\b(?:\d[ -.*]?){13,16}\b/, // possíveis cartões
];

/** Sanitiza PII/credenciais antes de qualquer score. Retorna null se inseguro. */
export function sanitizePatternCandidate(candidate: ZellmPatternCandidate): ZellmPatternCandidate | null {
  const text = `${candidate.question}\n${candidate.answer}`;
  for (const token of FORBIDDEN_PATTERN_TOKENS) {
    if (token.test(text)) return null;
  }
  return {
    ...candidate,
    question: candidate.question.slice(0, 500),
    answer: candidate.answer.slice(0, 2000),
  };
}

/** Valida se o candidato é elegível a virar padrão promovido. */
export function validatePatternCandidate(candidate: ZellmPatternCandidate): {
  eligible: boolean;
  reason?: string;
} {
  // Anti-patterns NUNCA são promovidos (Fase 15/16).
  if (candidate.category === 'anti_pattern') {
    return { eligible: false, reason: 'ANTI_PATTERN_NEVER_PROMOTED' };
  }
  if (candidate.outcome === 'HUMAN_HANDOVER' || candidate.outcome === 'FAILURE') {
    return { eligible: false, reason: 'NEGATIVE_OUTCOME_NOT_PROMOTABLE' };
  }
  if (candidate.outcome === 'NO_OUTCOME') {
    return { eligible: false, reason: 'INSUFFICIENT_EVIDENCE' };
  }
  if (candidate.occurrences < 2) {
    return { eligible: false, reason: 'NEEDS_REPEATED_SUCCESS' };
  }
  return { eligible: true };
}

// ── 4. SCORE / 5. PROMOTE ────────────────────────────────────────────────────

const PROMOTION_MIN_SCORE = 0.8;

/**
 * Promove um padrão comprovado para KnowledgeEntry (artefato do Cérebro).
 * score = evidência do padrão (ocorrências ponderadas por resultado).
 * Anti-pattern segue para a lista de anti-patterns do ConversationLearner
 * existente — nunca vira resposta sugerida.
 */
export async function promoteVerifiedPattern(
  candidate: ZellmPatternCandidate
): Promise<{ promoted: boolean; score: number; reason?: string }> {
  const sanitized = sanitizePatternCandidate(candidate);
  if (!sanitized) return { promoted: false, score: 0, reason: 'PII_OR_SECRET_DETECTED' };

  const validation = validatePatternCandidate(sanitized);
  const score =
    sanitized.outcome === 'RESERVATION_SUCCESS'
      ? Math.min(1, 0.5 + sanitized.occurrences * 0.1)
      : Math.min(0.7, sanitized.occurrences * 0.1);

  if (!validation.eligible || score < PROMOTION_MIN_SCORE) {
    return { promoted: false, score, reason: validation.reason ?? 'SCORE_BELOW_THRESHOLD' };
  }

  try {
    await db.knowledgeEntry.create({
      data: {
        tenantId: sanitized.tenantId,
        category: 'verified_pattern',
        question: sanitized.question,
        answer: sanitized.answer,
        priority: 'high',
        effectiveness: score,
        metadata: JSON.stringify({
          zellm: true,
          outcome: sanitized.outcome,
          occurrences: sanitized.occurrences,
          promotedAt: new Date().toISOString(),
        }),
      },
    });

    recordMetaTelemetry({
      name: 'meta.learning.outcome',
      tenantId: sanitized.tenantId,
      message: 'Padrão verificado promovido ao KnowledgeEntry (ZéLLM)',
      context: { outcome: sanitized.outcome, score },
    });

    return { promoted: true, score };
  } catch (error) {
    console.error('[meta-learning] promoteVerifiedPattern failed:', error);
    return { promoted: false, score, reason: 'DB_ERROR' };
  }
}

/**
 * Registra um anti-pattern (IA corrigida por humano / falha).
 * O anti-pattern é registrando APENAS como evidência negativa — ele NUNCA é
 * promovido para KnowledgeEntry como resposta sugerida.
 */
export async function recordAntiPattern(params: {
  tenantId: string;
  conversationId: string;
  question: string;
  failedAnswer: string;
  correctionSource: 'human_handover' | 'negative_feedback';
}): Promise<void> {
  if (!META_LEARNING_ENABLED) return;
  try {
    recordMetaTelemetry({
      name: 'meta.learning.outcome',
      tenantId: params.tenantId,
      message: 'Anti-pattern registrado (nunca promovido)',
      severity: 'warn',
      context: {
        conversationId: params.conversationId,
        correctionSource: params.correctionSource,
        category: 'anti_pattern',
      },
    });
  } catch (error) {
    console.error('[meta-learning] recordAntiPattern failed (non-fatal):', error);
  }
}
