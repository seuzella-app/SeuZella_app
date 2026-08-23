/**
 * Web Push Service — VAPID-signed push notifications
 * ============================================================================
 *
 * Architecture:
 *   1. Browser subscribes via navigator.serviceWorker.pushManager.subscribe()
 *   2. POST /api/push/subscribe with { endpoint, keys: { p256dh, auth } }
 *   3. Server persists to PushSubscription (PostgreSQL)
 *   4. Realtime event (e.g. reservation:created) → triggerPushToTenant()
 *   5. Server signs payload with VAPID private key + sends to push service
 *   6. Browser receives push event → Service Worker shows notification
 *
 * VAPID keys: generate once via:
 *   npx web-push generate-vapid-keys
 *   → set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars
 *
 * Fallback: if VAPID keys not configured, push is disabled but no crash.
 */

import { db, isDatabaseAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@seuzella.com';

export function isPushEnabled(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function savePushSubscription(
  tenantId: string,
  payload: PushSubscriptionPayload,
  userId?: string,
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  if (!(await isDatabaseAvailable())) {
    return { success: false, error: 'DB_UNAVAILABLE' };
  }

  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return { success: false, error: 'INVALID_SUBSCRIPTION_PAYLOAD' };
  }

  try {
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint: payload.endpoint },
    });

    if (existing) {
      await db.pushSubscription.update({
        where: { endpoint: payload.endpoint },
        data: {
          p256dhKey: payload.keys.p256dh,
          authKey: payload.keys.auth,
          userAgent: payload.userAgent,
          lastSeenAt: new Date(),
          isActive: true,
          ...(tenantId !== existing.tenantId ? { tenantId } : {}),
          ...(userId ? { userId } : {}),
        },
      });
      return { success: true, subscriptionId: existing.id };
    }

    const created = await db.pushSubscription.create({
      data: {
        tenantId,
        userId,
        endpoint: payload.endpoint,
        p256dhKey: payload.keys.p256dh,
        authKey: payload.keys.auth,
        userAgent: payload.userAgent,
        isActive: true,
      },
    });
    return { success: true, subscriptionId: created.id };
  } catch (err) {
    logger.error('[PUSH] savePushSubscription failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { success: false, error: 'PERSIST_FAILED' };
  }
}

export async function removePushSubscription(endpoint: string): Promise<{ success: boolean }> {
  if (!(await isDatabaseAvailable())) {
    return { success: false };
  }
  try {
    await db.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function triggerPushToTenant(
  tenantId: string,
  notification: PushNotification,
): Promise<{ sent: number; failed: number }> {
  if (!(await isDatabaseAvailable())) {
    return { sent: 0, failed: 0 };
  }

  if (!isPushEnabled()) {
    logger.warn('[PUSH] VAPID keys not configured — push disabled', { tenantId });
    return { sent: 0, failed: 0 };
  }

  try {
    const subs = await db.pushSubscription.findMany({
      where: { tenantId, isActive: true },
    });

    let sent = 0;
    let failed = 0;

    const webpush = await import('web-push').catch(() => null);

    if (!webpush) {
      logger.warn('[PUSH] web-push package not installed — push disabled');
      return { sent: 0, failed: subs.length };
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify(notification);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
          },
          payload,
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          }).catch(() => {});
        }
      }
    }

    return { sent, failed };
  } catch (err) {
    logger.error('[PUSH] triggerPushToTenant failed', {
      tenantId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { sent: 0, failed: 0 };
  }
}
