'use client';

/**
 * usePushNotifications — browser-side push subscription hook.
 *
 * RESPONSIBILITIES:
 *   1. Fetch VAPID public key from /api/push/vapid-public-key
 *   2. Subscribe via navigator.serviceWorker.pushManager.subscribe()
 *   3. POST subscription to /api/push/subscribe
 *   4. Expose permissionState + subscribe() + unsubscribe()
 *
 * USAGE:
 *   const { permissionState, subscribe, unsubscribe } = usePushNotifications();
 *   if (permissionState === 'default') {
 *     return <button onClick={subscribe}>Ativar notificações</button>;
 *   }
 */

import { useState, useEffect, useCallback } from 'react';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported' | 'disabled';

export interface UsePushNotificationsResult {
  permissionState: PushPermissionState;
  isSubscribed: boolean;
  subscribe: () => Promise<{ success: boolean; error?: string }>;
  unsubscribe: () => Promise<{ success: boolean }>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permissionState, setPermissionState] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermissionState('unsupported');
      return;
    }

    // Check current permission
    const {permission} = Notification;
    setPermissionState(permission as PushPermissionState);

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (typeof window === 'undefined') return { success: false, error: 'SSR' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, error: 'UNSUPPORTED' };
    }

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PushPermissionState);
      if (permission !== 'granted') {
        return { success: false, error: 'PERMISSION_DENIED' };
      }

      // 2. Fetch VAPID public key
      const vapidRes = await fetch('/api/push/vapid-public-key');
      if (!vapidRes.ok) {
        return { success: false, error: 'VAPID_NOT_CONFIGURED' };
      }
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        return { success: false, error: 'VAPID_MISSING_PUBLIC_KEY' };
      }

      // 3. Convert VAPID key to Uint8Array for pushManager.subscribe
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 4. Subscribe via pushManager
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true, // required by spec
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // 5. POST subscription to server
      const sub = subscription.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      });

      if (!saveRes.ok) {
        return { success: false, error: 'SAVE_FAILED' };
      }

      setIsSubscribed(true);
      return { success: true };
    } catch (err) {
      console.error('[usePushNotifications] subscribe failed:', err);
      return { success: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<{ success: boolean }> => {
    if (typeof window === 'undefined') return { success: false };
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return { success: true };
      }

      // Notify server to deactivate
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      // Unsubscribe from browser push manager
      await sub.unsubscribe();
      setIsSubscribed(false);
      return { success: true };
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe failed:', err);
      return { success: false };
    }
  }, []);

  return {
    permissionState,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}

/** Convert base64url VAPID key to Uint8Array (required by PushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
