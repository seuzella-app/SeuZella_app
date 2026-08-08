/**
 * Zélla — DDC Mobile Notifications Hook (Mock Mode)
 *
 * useDDCMobileNotifications(niche, plan) — fetches notifications from
 * /api/ddc/notifications/v2, polls every 15s, supports mark-read/mark-all-read
 * and live updates via window events.
 *
 * Designed for mobile-first DDC pages (pousada + airbnb).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DDCNotification,
  NotificationNiche,
  NotificationCategory,
  NotificationStats,
} from '@/lib/notifications/types';
import type { PlanTier } from '@/lib/plan-features';
import type { NicheType } from '@/contexts/NicheContext';

// ─── API helpers ───────────────────────────────────────────────────────────
async function fetchV2(niche: string, plan?: string, limit = 50): Promise<{
  success: boolean;
  data: DDCNotification[];
  meta: NotificationStats & { storeSize: number; seeded: boolean; mockMode: boolean };
}> {
  const params = new URLSearchParams({ niche, limit: String(limit) });
  if (plan) params.set('plan', plan);
  const res = await fetch(`/api/ddc/notifications/v2?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function updateV2(body: {
  action: 'mark_read' | 'mark_all_read' | 'archive';
  id?: string;
  niche?: string;
  plan?: string;
}): Promise<{ success: boolean }> {
  const res = await fetch('/api/ddc/notifications/v2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function simulate(): Promise<{ success: boolean; data: any }> {
  const res = await fetch('/api/ddc/notifications/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'simulate' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export interface UseDDCMobileNotificationsOptions {
  niche: NicheType | NotificationNiche;
  plan?: PlanTier;
  /** Polling interval in ms (default: 15000) */
  pollInterval?: number;
  /** Enable sounds on new notifications (default: true) */
  enableSound?: boolean;
  /** Enable browser notifications (default: true, requires permission) */
  enableBrowserNotifications?: boolean;
}

export interface UseDDCMobileNotificationsReturn {
  notifications: DDCNotification[];
  unreadCount: number;
  urgentCount: number;
  stats: NotificationStats | null;
  isLoading: boolean;
  error: Error | null;
  isMockMode: boolean;
  // Actions
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  refresh: () => void;
  simulateNotification: () => Promise<void>;
  // Filtering helpers
  filterByCategory: (category: NotificationCategory) => DDCNotification[];
  filterByPriority: (priority: 'low' | 'medium' | 'high' | 'urgent') => DDCNotification[];
}

export function useDDCMobileNotifications(
  options: UseDDCMobileNotificationsOptions
): UseDDCMobileNotificationsReturn {
  const { niche, plan, pollInterval = 15000, enableSound = true, enableBrowserNotifications = true } = options;
  const queryClient = useQueryClient();
  const queryKey = ['ddc-mobile-notifications', niche, plan ?? 'any'];
  const lastNotificationIdRef = useRef<string | null>(null);
  const [mockMode, setMockMode] = useState(true);

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchV2(niche, plan, 50),
    refetchInterval: pollInterval,
    staleTime: 5000,
  });

  // ─── Derive state ────────────────────────────────────────────────────────
  const notifications = response?.data ?? [];
  const stats = response?.meta ?? null;
  const unreadCount = stats?.unread ?? 0;
  const urgentCount = stats?.urgent ?? 0;

  useEffect(() => {
    setMockMode(response?.meta?.mockMode ?? true);
  }, [response?.meta?.mockMode]);

  // ─── Sound + browser notification on new arrival ────────────────────────
  useEffect(() => {
    if (!notifications.length) return;
    const newest = notifications[0];
    if (!newest) return;

    // First load — just record the latest id, don't notify
    if (lastNotificationIdRef.current === null) {
      lastNotificationIdRef.current = newest.id;
      return;
    }

    if (newest.id !== lastNotificationIdRef.current) {
      lastNotificationIdRef.current = newest.id;

      // Sound — choose file based on priority (Gap 6)
      if (enableSound) {
        try {
          const soundFile =
            newest.priority === 'urgent'
              ? '/sounds/alert.mp3'
              : newest.priority === 'high'
                ? '/sounds/notification.mp3'
                : newest.priority === 'medium'
                  ? '/sounds/success.mp3'
                  : '/sounds/info.mp3';
          const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!prefersReducedMotion) {
            const audio = new Audio(soundFile);
            audio.volume = 0.5; // never startle the user
            audio.play().catch(() => {});
          }
        } catch {}
      }

      // Browser notification
      if (enableBrowserNotifications && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          try {
            new Notification(newest.title, {
              body: newest.message,
              icon: '/logo.svg',
              tag: newest.id,
            });
          } catch {}
        } else if (Notification.permission === 'default') {
          // Request permission quietly — subsequent new notifications will fire
          Notification.requestPermission().catch(() => {});
        }
      }

      // Window event for any other listeners (e.g. FAB badge animations)
      window.dispatchEvent(
        new CustomEvent('zella:notification', { detail: newest })
      );
    }
  }, [notifications, enableSound, enableBrowserNotifications]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: string) => updateV2({ action: 'mark_read', id }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ data: DDCNotification[]; meta: any }>(
        queryKey,
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((n) =>
              n.id === id
                ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
                : n
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => updateV2({ action: 'mark_all_read', niche, plan }),
    onSuccess: () => {
      queryClient.setQueryData<{ data: DDCNotification[]; meta: any }>(
        queryKey,
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((n) => ({
              ...n,
              status: 'read' as const,
              readAt: n.readAt ?? new Date().toISOString(),
            })),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => updateV2({ action: 'archive', id }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ data: DDCNotification[]; meta: any }>(
        queryKey,
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((n) =>
              n.id === id ? { ...n, status: 'archived' as const } : n
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: simulate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ─── Stable callbacks ────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    try {
      await markReadMutation.mutateAsync(id);
    } catch (err) {
      console.error('[useDDCMobileNotifications] markAsRead error:', err);
    }
  }, [markReadMutation]);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllReadMutation.mutateAsync();
    } catch (err) {
      console.error('[useDDCMobileNotifications] markAllAsRead error:', err);
    }
  }, [markAllReadMutation]);

  const archive = useCallback(async (id: string) => {
    try {
      await archiveMutation.mutateAsync(id);
    } catch (err) {
      console.error('[useDDCMobileNotifications] archive error:', err);
    }
  }, [archiveMutation]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const simulateNotification = useCallback(async () => {
    try {
      await simulateMutation.mutateAsync();
    } catch (err) {
      console.error('[useDDCMobileNotifications] simulate error:', err);
    }
  }, [simulateMutation]);

  // ─── Filtering helpers ───────────────────────────────────────────────────
  const filterByCategory = useCallback(
    (category: NotificationCategory) =>
      notifications.filter((n) => n.category === category),
    [notifications]
  );

  const filterByPriority = useCallback(
    (priority: 'low' | 'medium' | 'high' | 'urgent') =>
      notifications.filter((n) => n.priority === priority),
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    urgentCount,
    stats,
    isLoading,
    error: error as Error | null,
    isMockMode: mockMode,
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
    simulateNotification,
    filterByCategory,
    filterByPriority,
  };
}
