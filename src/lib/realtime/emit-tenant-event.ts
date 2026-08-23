/**
 * Tenant Event Bus — combined realtime SSE publish + push notification.
 *
 * WHY: previously each mutation endpoint called publishTenantEvent() only.
 * That sent the event to SSE subscribers (online browsers). But push
 * notifications (for offline / background users) were never triggered.
 *
 * This helper unifies both: a single call publishes to SSE AND triggers
 * a web push notification to all subscribed devices for the tenant.
 *
 * ARCHITECTURE:
 *   Mutation endpoint (e.g. POST /api/ddc/locks/[id]/pins)
 *     ↓ AFTER DB write
 *   emitTenantEvent(tenantId, type, payload, pushNotification?)
 *     ├─ publishTenantEvent() → Redis/in-memory → SSE → online browsers
 *     └─ triggerPushToTenant() → VAPID-signed push → Service Worker
 *
 * USAGE:
 *   await emitTenantEvent(
 *     tenantId,
 *     'pin:created',
 *     { deviceId, guestName, validFrom, validTo },
 *     {
 *       title: 'Novo PIN gerado',
 *       body: guestName ? `Acesso liberado para ${guestName}` : 'PIN gerado',
 *       tag: 'pin:created',
 *       data: { url: '/ddc/pousada' },
 *     }
 *   );
 *
 * The pushNotification param is OPTIONAL — if omitted, only SSE fires.
 * Push notifications are silent when VAPID keys not configured (graceful).
 */

import { publishTenantEvent, type TenantStateEvent } from '@/lib/realtime/tenant-pubsub';
import { triggerPushToTenant, type PushNotification } from '@/lib/push/push-service';
import { logger } from '@/lib/logger';

export type TenantEventType = TenantStateEvent['type'];

/**
 * Emit a tenant event via SSE AND optionally trigger a push notification.
 *
 * @param tenantId The tenant the event belongs to (server-resolved)
 * @param type Event type (e.g. 'pin:created')
 * @param payload Event data (sent to SSE subscribers)
 * @param pushNotification Optional push notification (title, body, icon, etc.)
 *                         If omitted, only SSE fires. If VAPID not configured,
 *                         push is silently skipped (no error).
 */
export async function emitTenantEvent(
  tenantId: string,
  type: TenantEventType,
  payload: Record<string, unknown>,
  pushNotification?: PushNotification,
): Promise<void> {
  // 1. Publish to SSE (sync, in-memory or Redis)
  publishTenantEvent(tenantId, type, payload);

  // 2. Trigger push notification (async, fire-and-forget)
  if (pushNotification) {
    try {
      // Fire-and-forget — don't block the response on push delivery.
      // Errors are logged inside triggerPushToTenant, not thrown.
      void triggerPushToTenant(tenantId, pushNotification).catch((err) => {
        logger.warn('[emitTenantEvent] push failed (non-fatal)', {
          tenantId,
          type,
          error: err instanceof Error ? err.message : 'unknown',
        });
      });
    } catch (err) {
      // Defensive — triggerPushToTenant should never throw synchronously,
      // but if it does, we don't want to break the mutation.
      logger.error('[emitTenantEvent] push threw (non-fatal)', {
        tenantId,
        type,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
}

/**
 * Build a standard push notification payload for a tenant event type.
 * Returns undefined if the event type doesn't warrant a push notification
 * (e.g. 'tenant:metadata_updated' is silent — too noisy for push).
 */
export function buildPushForEvent(
  type: TenantEventType,
  payload: Record<string, unknown>,
): PushNotification | undefined {
  switch (type) {
    case 'pin:created': {
      const guestName = (payload.guestName as string) || '';
      return {
        title: '🔑 Novo PIN gerado',
        body: guestName ? `Acesso liberado para ${guestName}` : 'PIN gerado',
        tag: 'pin:created',
        data: { url: '/ddc/pousada', deviceId: payload.deviceId },
        requireInteraction: false,
      };
    }
    case 'pin:revoked': {
      const bulkRevoke = payload.bulkRevoke as boolean;
      const revokedCount = (payload.revokedCount as number) || 0;
      return {
        title: bulkRevoke ? '🚨 Pânico acionado' : 'PIN revogado',
        body: bulkRevoke
          ? `${revokedCount} PIN(s) revogado(s) por segurança`
          : 'Um PIN foi revogado',
        tag: 'pin:revoked',
        data: { url: '/ddc/pousada' },
        requireInteraction: true,
      };
    }
    case 'reservation:created': {
      const guestName = (payload.guestName as string) || '';
      const roomName = (payload.roomName as string) || '';
      return {
        title: '🏨 Nova reserva recebida',
        body: `${guestName}${roomName ? ` — ${roomName}` : ''}`,
        tag: 'reservation:created',
        data: { url: '/ddc/pousada' },
        requireInteraction: false,
      };
    }
    case 'lock:status_changed': {
      const action = (payload.action as string) || '';
      return {
        title: action === 'unlock' ? '🔓 Fechadura destrancada' : '🔒 Fechadura trancada',
        body: 'Operação remota realizada',
        tag: 'lock:status',
        data: { url: '/ddc/pousada' },
      };
    }
    case 'guest:updated':
    case 'room:updated':
    case 'tenant:metadata_updated':
    default:
      // Silent — these events are too noisy for push.
      return undefined;
  }
}
