/**
 * Zélla — DDC Mobile Notification API (Mock Mode)
 *
 * GET    /api/ddc/notifications/v2?niche=pousada&plan=pro&limit=50
 *   → Returns notifications filtered by niche + plan
 *
 * PUT    /api/ddc/notifications/v2
 *   body: { action: 'mark_read' | 'mark_all_read' | 'archive', id?: string, niche?, plan? }
 *   → Updates notification status
 *
 * POST   /api/ddc/notifications/v2
 *   body: { action: 'seed' | 'simulate' | 'reset' }
 *   → Seed / simulate / reset the mock store
 *
 * MOCK MODE: All data is in-memory. No DB required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/notifications/store';
import { seedNotifications, isSeeded, resetSeed } from '@/lib/notifications/seed';
import { BRIDGES } from '@/lib/notifications/bridges';
import type {
  NotificationNiche,
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
} from '@/lib/notifications/types';
import type { PlanTier } from '@/lib/plan-features';

// ─── Helpers ───────────────────────────────────────────────────────────────
function parseQuery(request: NextRequest) {
  const url = new URL(request.url);
  return {
    niche: (url.searchParams.get('niche') as NotificationNiche | null) ?? undefined,
    category: (url.searchParams.get('category') as NotificationCategory | null) ?? undefined,
    status: (url.searchParams.get('status') as 'unread' | 'read' | 'archived' | null) ?? 'unread',
    priority: (url.searchParams.get('priority') as NotificationPriority | null) ?? undefined,
    source: (url.searchParams.get('source') as NotificationSource | null) ?? undefined,
    plan: (url.searchParams.get('plan') as PlanTier | null) ?? undefined,
    limit: Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200),
  };
}

// ─── GET: List notifications ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // Auto-seed if store is empty (mock mode behavior)
    if (!isSeeded() || memoryStore.size() === 0) {
      seedNotifications();
    }

    const query = parseQuery(request);
    const notifications = memoryStore.query(query);
    const stats = memoryStore.stats({
      niche: query.niche,
      plan: query.plan,
    });

    return NextResponse.json({
      success: true,
      data: notifications,
      meta: {
        total: notifications.length,
        unread: stats.unread,
        urgent: stats.urgent,
        byCategory: stats.byCategory,
        byNiche: stats.byNiche,
        storeSize: memoryStore.size(),
        seeded: isSeeded(),
        mockMode: true,
      },
    });
  } catch (error) {
    console.error('[DDC notifications v2] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: '500', message: 'Failed to fetch notifications' } },
      { status: 500 }
    );
  }
}

// ─── PUT: Update notification status ───────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, niche, plan } = body as {
      action: 'mark_read' | 'mark_all_read' | 'archive';
      id?: string;
      niche?: NotificationNiche;
      plan?: PlanTier;
    };

    if (!action) {
      return NextResponse.json(
        { success: false, error: { code: '400', message: 'Missing action' } },
        { status: 400 }
      );
    }

    if (action === 'mark_all_read') {
      const count = memoryStore.markAllRead({ niche, plan });
      return NextResponse.json({ success: true, data: { updated: count } });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: '400', message: 'Missing id' } },
        { status: 400 }
      );
    }

    if (action === 'mark_read') {
      const updated = memoryStore.markRead(id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: '404', message: 'Notification not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'archive') {
      const updated = memoryStore.archive(id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: '404', message: 'Notification not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { success: false, error: { code: '400', message: `Unknown action: ${action}` } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DDC notifications v2] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: '500', message: 'Failed to update notification' } },
      { status: 500 }
    );
  }
}

// ─── POST: Seed / Simulate / Reset ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: 'seed' | 'simulate' | 'reset' };

    if (action === 'reset') {
      resetSeed();
      return NextResponse.json({ success: true, data: { reset: true } });
    }

    if (action === 'seed') {
      const result = seedNotifications({ force: true });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'simulate') {
      // Pick a random bridge + mock payload
      const samples: Array<() => any> = [
        () =>
          BRIDGES.reservation({
            niche: 'pousada',
            bookingId: `SIM-${Date.now()}`,
            guestName: 'Hóspede Simulado',
            roomName: 'Suíte Teste',
            checkIn: '20/08',
            checkOut: '22/08',
            status: 'created',
            tenantId: 'mock-tenant-001',
          }),
        () =>
          BRIDGES.payment({
            niche: 'airbnb',
            paymentId: `PAY-SIM-${Date.now()}`,
            amount: 1500,
            guestName: 'Pagador Simulado',
            status: 'received',
            tenantId: 'mock-tenant-001',
          }),
        () =>
          BRIDGES.cerebroAlert({
            niche: 'all',
            alertType: 'pattern_learned',
            pattern: 'Padrão simulado: hóspedes perguntando sobre café da manhã',
            tenantId: 'mock-tenant-001',
          }),
        () =>
          BRIDGES.adsBudgetLow({
            niche: 'pousada',
            platform: 'google',
            campaign: 'Campanha Simulada',
            amount: 35,
            tenantId: 'mock-tenant-001',
          }),
        () =>
          BRIDGES.reviewNegative({
            niche: 'airbnb',
            guestName: 'Crítico Simulado',
            stars: 2,
            platform: 'Airbnb',
            tenantId: 'mock-tenant-001',
          }),
        () =>
          BRIDGES.achievement({
            niche: 'pousada',
            achievementType: 'milestone_10',
            tenantId: 'mock-tenant-001',
          }),
      ];
      const sample = samples[Math.floor(Math.random() * samples.length)];
      const result = sample();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: { code: '400', message: 'Unknown action. Use: seed | simulate | reset' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DDC notifications v2] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: '500', message: 'Failed' } },
      { status: 500 }
    );
  }
}
