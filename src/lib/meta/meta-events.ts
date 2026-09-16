// ==============================================================================
// ZÉLLA — Meta Events: Idempotência + Telemetria (Fase 5 / Fase 24)
// ==============================================================================
// Eventos externos Meta são idempotentes, mas STATUS outbound precisa ser
// idempotente por (wamid + status), porque a mesma mensagem recebe sent,
// delivered, read e/ou failed em eventos distintos.
// ==============================================================================

import { db } from '@/lib/db';
import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';

export type MetaEventKind =
  | 'inbound_message'
  | 'outbound_status'
  | 'webhook_entry'
  | 'pricing_event';

export function buildMetaEventKey(kind: MetaEventKind, externalEventId: string, discriminator?: string): string {
  return discriminator
    ? `meta:${kind}:${externalEventId}:${discriminator}`
    : `meta:${kind}:${externalEventId}`;
}

export interface MetaEventClaimResult {
  claimed: boolean;
  alreadyProcessed: boolean;
}

/**
 * Claim atômico por chave de evento.
 * Para outbound_status, metadata.status faz parte da identidade do evento:
 * um wamid pode legitimamente receber vários statuses diferentes.
 * Em erro de DB NÃO processamos às cegas: falhar fechado deixa a Meta retryar
 * o webhook, evitando duplicação silenciosa quando a idempotência não pôde
 * ser garantida.
 */
export async function claimMetaEvent(
  kind: MetaEventKind,
  externalEventId: string,
  metadata: Record<string, unknown> = {}
): Promise<MetaEventClaimResult> {
  if (!externalEventId) return { claimed: false, alreadyProcessed: false };
  const discriminator = kind === 'outbound_status' && typeof metadata.status === 'string'
    ? metadata.status
    : undefined;
  const eventKey = buildMetaEventKey(kind, externalEventId, discriminator);

  try {
    const existing = await db.metaWebhookEvent.findUnique({
      where: { eventKey },
      select: { id: true, status: true },
    });
    if (existing) return { claimed: false, alreadyProcessed: true };

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
    if (isUniqueViolation(error)) return { claimed: false, alreadyProcessed: true };
    console.error('[meta-events] claimMetaEvent DB error (fail-closed):', error);
    recordTelemetryEvent({
      type: 'error',
      name: 'meta.idempotency.db_error',
      module: 'meta',
      severity: 'critical',
      message: 'MetaWebhookEvent claim falhou — webhook deve ser retryado',
      context: { eventKey },
    });
    return { claimed: false, alreadyProcessed: false };
  }
}

/** Marca o evento como processado. Para status, fecha somente o status pedido. */
export async function completeMetaEvent(
  kind: MetaEventKind,
  externalEventId: string,
  outcome: 'processed' | 'skipped' | 'failed' = 'processed',
  discriminator?: string
): Promise<void> {
  const eventKey = buildMetaEventKey(kind, externalEventId, discriminator);
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
