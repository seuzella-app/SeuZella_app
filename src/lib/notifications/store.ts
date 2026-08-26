/**
 * Zélla — In-memory notification store (MOCK MODE)
 *
 * Why: We're in mock mode — no DB writes needed for testing.
 * This store emulates the Notification table so producers can `INSERT`
 * and consumers (hooks, API) can `SELECT` without touching Prisma.
 *
 * When real DB is wired: replace `MemoryStore.push()` with `db.notification.create()`
 * and `MemoryStore.query()` with `db.notification.findMany()`.
 *
 * The store is per-process (dev). In production with multiple instances,
 * swap for Redis or the Prisma-backed Notification table.
 */

import type {
  DDCNotification,
  NotificationQuery,
  NotificationStats,
  NotificationStatus,
} from './types';
import { isNotificationVisibleToNiche, isNotificationVisibleToPlan } from './types';

type StoreRecord = DDCNotification;

class NotificationMemoryStore {
  private records: StoreRecord[] = [];
  private seq = 0;
  private listeners: Array<(n: DDCNotification) => void> = [];

  /** Insert a fully-formed notification (producer does the formatting) */
  insert(notification: DDCNotification): DDCNotification {
    this.records.push(notification);
    // Keep most recent 500 to prevent unbounded growth in dev
    if (this.records.length > 500) {
      this.records = this.records.slice(-500);
    }
    // Notify subscribers (used by hook for live updates)
    this.listeners.forEach((fn) => {
      try {
        fn(notification);
      } catch {
        /* swallow listener errors */
      }
    });
    return notification;
  }

  /** Query with filters — returns sorted by createdAt desc */
  query(query: NotificationQuery = {}): DDCNotification[] {
    const {
      niche,
      category,
      status = 'unread',
      priority,
      source,
      plan,
      limit = 50,
    } = query;

    let result = this.records.slice();

    // Status filter — if 'unread', include both 'unread' and 'read'
    if (status === 'unread') {
      result = result.filter((n) => n.status === 'unread' || n.status === 'read');
    } else {
      result = result.filter((n) => n.status === status);
    }

    if (niche && niche !== 'all') {
      result = result.filter((n) => isNotificationVisibleToNiche(n, niche as any));
    }
    if (category) {
      result = result.filter((n) => n.category === category);
    }
    if (priority) {
      result = result.filter((n) => n.priority === priority);
    }
    if (source) {
      result = result.filter((n) => n.source === source);
    }
    if (plan) {
      result = result.filter((n) => isNotificationVisibleToPlan(n, plan));
    }

    // Sort by createdAt desc
    result.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    return result.slice(0, limit);
  }

  /** Count unread by niche + plan */
  stats(query: NotificationQuery = {}): NotificationStats {
    const { niche, plan } = query;
    let filtered = this.records.slice();

    if (niche && niche !== 'all') {
      filtered = filtered.filter((n) => isNotificationVisibleToNiche(n, niche as any));
    }
    if (plan) {
      filtered = filtered.filter((n) => isNotificationVisibleToPlan(n, plan));
    }

    const byCategory: NotificationStats['byCategory'] = {
      reservations: 0,
      financial: 0,
      guests: 0,
      ai: 0,
      operations: 0,
      marketing: 0,
      system: 0,
      achievements: 0,
      external: 0,
    };
    const byNiche: NotificationStats['byNiche'] = { pousada: 0, airbnb: 0, all: 0 };

    let unread = 0;
    let urgent = 0;
    for (const n of filtered) {
      if (n.status === 'unread') {
        unread++;
        byCategory[n.category] = (byCategory[n.category] || 0) + 1;
        byNiche[n.niche as 'pousada' | 'airbnb' | 'all'] =
          (byNiche[n.niche as 'pousada' | 'airbnb' | 'all'] || 0) + 1;
        if (n.priority === 'urgent') urgent++;
      }
    }

    return {
      total: filtered.length,
      unread,
      urgent,
      byCategory,
      byNiche,
    };
  }

  /** Mark single notification as read */
  markRead(id: string): DDCNotification | null {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.status = 'read';
    record.readAt = new Date().toISOString();
    return record;
  }

  /** Mark all (filtered) as read */
  markAllRead(query: NotificationQuery = {}): number {
    const { niche, plan } = query;
    let count = 0;
    for (const r of this.records) {
      if (r.status !== 'unread') continue;
      if (niche && niche !== 'all' && !isNotificationVisibleToNiche(r, niche as any)) continue;
      if (plan && !isNotificationVisibleToPlan(r, plan)) continue;
      r.status = 'read';
      r.readAt = new Date().toISOString();
      count++;
    }
    return count;
  }

  /** Archive a notification */
  archive(id: string): DDCNotification | null {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.status = 'archived';
    return record;
  }

  /** Set status — generic */
  setStatus(id: string, status: NotificationStatus): DDCNotification | null {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.status = status;
    if (status === 'read' && !record.readAt) {
      record.readAt = new Date().toISOString();
    }
    return record;
  }

  /** Subscribe to new-notification events (returns unsubscribe fn) */
  subscribe(fn: (n: DDCNotification) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  /** Bulk insert (used by seed) */
  bulkInsert(notifications: DDCNotification[]): void {
    this.records.push(...notifications);
    if (this.records.length > 500) {
      this.records = this.records.slice(-500);
    }
  }

  /** Clear all (used by tests) */
  clear(): void {
    this.records = [];
    this.seq = 0;
  }

  /** Total count (for debugging) */
  size(): number {
    return this.records.length;
  }

  /** Generate a unique ID */
  nextId(): string {
    this.seq++;
    return `mock-n-${Date.now()}-${this.seq}`;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────
declare global {
   
  var __ZELLA_NOTIFICATION_STORE__: NotificationMemoryStore | undefined;
}

export const memoryStore: NotificationMemoryStore =
  globalThis.__ZELLA_NOTIFICATION_STORE__ ?? new NotificationMemoryStore();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ZELLA_NOTIFICATION_STORE__ = memoryStore;
}
