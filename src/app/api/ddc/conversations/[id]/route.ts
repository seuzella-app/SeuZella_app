import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/ddc-mapper';
import { createError, apiSuccess } from '@/lib/error-handler';
import { apiRatelimit } from '@/lib/rate-limit';
import { learnFromConversation } from '@/lib/brain/conversation-learner';
import { recordResolvedConversationMetaLearning } from '@/lib/meta/meta-learning-bridge';
import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';

async function guard(): Promise<string | NextResponse> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return createError(401, 'UNAUTHORIZED', 'Não autorizado');
  const { success } = await apiRatelimit.limit(tenantId);
  if (!success) return createError(429, 'RATE_LIMITED', 'Muitas requisições');
  return tenantId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await params;
    const conversation = await db.conversationLog.findFirst({
      where: { id, tenantId: g },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });

    if (!conversation) {
      return createError(404, 'NOT_FOUND', 'Conversa não encontrada');
    }

    return apiSuccess(conversation);
  } catch {
    return createError(500, 'INTERNAL_ERROR', 'Erro interno');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await params;
    const body = await request.json();
    const { status, aiConfidence, metadata } = body;

    // FASE 02B (FRENTE 01): transições de status VALIDADAS. A reativação da IA
    // ('active') é decisão humana explícita (encerramento do handover); strings
    // arbitrárias são rejeitadas (antes: qualquer string era aceita).
    const ALLOWED_CONVERSATION_STATUSES = ['active', 'resolved', 'escalated'] as const;
    if (status !== undefined && status !== null && !(ALLOWED_CONVERSATION_STATUSES as readonly string[]).includes(status)) {
      return createError(400, 'INVALID_STATUS', `Status deve ser um de: ${ALLOWED_CONVERSATION_STATUSES.join(', ')}`);
    }

    const existing = await db.conversationLog.findFirst({
      where: { id, tenantId: g },
    });
    if (!existing) {
      return createError(404, 'NOT_FOUND', 'Conversa não encontrada');
    }

    // FASE 02B: metadata agora é MERGE (não clobber) — preserva metadata.zellm
    // escrito pelo learning bridge (P2-10).
    let mergedMetadata: string | undefined;
    if (metadata) {
      let existingMetadata: Record<string, unknown> = {};
      try {
        existingMetadata = JSON.parse(existing.metadata || '{}');
      } catch {
        existingMetadata = {};
      }
      mergedMetadata = JSON.stringify({ ...existingMetadata, ...metadata });
    }

    const conversation = await db.conversationLog.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(aiConfidence !== undefined && { aiConfidence }),
        ...(mergedMetadata && { metadata: mergedMetadata }),
        lastUpdate: new Date(),
      },
    });

    // FASE 02B (FRENTE 26): telemetria handover.ended quando o humano encerra
    // o controle (escalated → resolved/active)
    if (existing.status === 'escalated' && status && status !== 'escalated') {
      recordTelemetryEvent({
        type: 'request',
        name: 'handover.ended',
        module: 'whatsapp-handover',
        severity: 'info',
        message: 'Controle humano encerrado',
        tenantId: g,
        context: { conversationId: id, newStatus: status },
      });
    }

    // O ConversationLearner continua sendo o dono da extração/promoção.
    // O bridge Meta apenas registra contexto/outcome explícito para o ZéLLM.
    if (status === 'resolved' || status === 'escalated') {
      learnFromConversation(g, id).catch(err =>
        console.error('[DDC PATCH] Background learning on status change:', err)
      );
      recordResolvedConversationMetaLearning(g, id, status).catch(err =>
        console.error('[DDC PATCH] Meta/ZéLLM learning bridge failed:', err)
      );
    }

    return apiSuccess(conversation);
  } catch {
    return createError(500, 'INTERNAL_ERROR', 'Erro interno');
  }
}