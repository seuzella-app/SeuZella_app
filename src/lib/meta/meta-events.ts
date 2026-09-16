// ==============================================================================
// ZÉLLA — Meta Events: Idempotência + Telemetria (Fase 5 / Fase 24)
// ==============================================================================
// Todo evento externo Meta é idempotente: message_id, status e webhook event
// NUNCA são processados duas vezes.
//
// Mecanismo: tabela MetaWebhookEvent (Prisma) com unique(eventKey).
// Telemetria: REUTILIZA o Telemetry Bridge existente (recordTelemetryEvent) —
// NÃO criamos um segundo sistema de telemetria.
// ==============================================================================

import { db } from '@/lib/db';
import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';

// ── Idempotência ─────────────────────────────────────────────────────────────

export type MetaEventKind =
  | 'inbound_message'
  | 'outbound_status'
  | 'webhook_entry'
  | 'pricing_event';

export function buildMetaEventKey(kind: MetaEventKind, externalEventId: string): string {
  return `meta:${kind}:${externalEventId}`;
}

export interface MetaEventClaimResult {
  /** true = este processo é o DONO do evento e deve processá-lo. */
  claimed: boolean;
  /** true = evento já foi processado anteriormente (idempotência). */
  alreadyProcessed: boolean;
}

/**
 * Toma posse idempotente de um evento externo Meta.
 * - Primeira vez: cria registro e retorna claimed=true.
 * - Repetição: retorna claimed=false, alreadyProcessed=true.
 * - Erro de DB: fail-open CONTROLADO (claimed=true) para não bloquear o
 *   webhook — a Meta faz retry e o pipeline downstream é idempotente por
 *   messageId. O erro é logado com severidade critical via telemetria.
 */
export async function claimMetaEvent(
  kind: MetaEventKind,
  externalEventId: string,
  metadata: Record<string, unknown> = {}
): Promise<MetaEventClaimResult> {
  if (!externalEventId) return { claimed: false, alreadyProcessed: false };
  const eventKey = buildMetaEventKey(kind, externalEventId);

  try {
    const existing = await db.metaWebhookEvent.findUnique({
      where: { eventKey },
      select: { id: true, status: true },
    });
    if (existing) {
      return { claimed: false, alreadyProcessed: true };
    }

    await db.metaWebhookEvent.create({
      data: {
        eventKey,
        kind,
        externalEventId,
        status: 'processing',
        metadata: JSON.stringify(metadata),
      },
    });
    return { claimed: true, alreadyProcessed: false };
  } catch (error) {
    // Corrida benigna: outro worker criou primeiro (unique violation) → duplicado.
    if (isUniqueViolation(error)) {
      return { claimed: false, alreadyProcessed: true };
    }
    console.error('[meta-events] claimMetaEvent DB error (fail-open):', error);
    recordTelemetryEvent({
      type: 'error',
      name: 'meta.idempotency.db_error',
      module: 'meta',
      severity: 'critical',
      message: 'MetaWebhookEvent claim falhou — fail-open controlado',
      context: { eventKey },
    });
    return { claimed: true, alreadyProcessed: false };
  }
}

/** Marca evento como processado (outcome do pipeline). */
export async function completeMetaEvent(
  kind: MetaEventKind,
  externalEventId: string,
  outcome: 'processed' | 'skipped' | 'failed' = 'processed'
): Promise<void> {
  const eventKey = buildMetaEventKey(kind, externalEventId);
  try {
    await db.metaWebhookEvent.updateMany({
      where: { eventKey },
      data: { status: outcome, processedAt: new Date() },
    });
  } catch (error) {
    console.error('[meta-events] completeMetaEvent error (non-fatal):', error);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as { code?: string }).code === 'P2002' ||
      (error as { code?: string }).code === '23505')
  );
}

// ── Telemetria (Fase 24 — reusa pipeline existente) ──────────────────────────

export type MetaTelemetryEventName =
  | 'meta.connection.changed'
  | 'meta.webhook.received'
  | 'meta.message.received'
  | 'meta.message.sent'
  | 'meta.message.delivered'
  | 'meta.message.read'
  | 'meta.message.failed'
  | 'meta.pricing.recorded'
  | 'meta.attribution.detected'
  | 'meta.learning.outcome';

/**
 * Registra um evento meta.* no pipeline de telemetria EXISTENTE.
 * recordTelemetryEvent é síncrona (persistência interna fire-and-forget).
 */
export function recordMetaTelemetry(input: {
  name: MetaTelemetryEventName;
  tenantId?: string;
  message: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  context?: Record<string, unknown>;
}): void {
  recordTelemetryEvent({
    type: 'webhook',
    name: input.name,
    module: 'meta',
    severity: input.severity ?? 'info',
    message: input.message,
    tenantId: input.tenantId,
    context: input.context,
  });
}
