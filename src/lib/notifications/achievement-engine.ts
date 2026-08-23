/**
 * Zélla — Achievement Engine (Gap 2)
 *
 * Triggers gamification achievements based on tenant activity.
 * Designed for PARCEIRO_ZÉLLA plan but awards trigger for all plans;
 * plan gating is enforced by notifyAchievement's planAvailability filter.
 *
 * 5 Triggers:
 *  1. first_booking       — Tenant has its first confirmed booking
 *  2. milestone_10        — Tenant reached 10 confirmed bookings
 *  3. milestone_100       — Tenant reached 100 confirmed bookings
 *  4. revenue_record      — Current MRR exceeds tenant's historical max MRR
 *  5. partner_level_up    — PARCEIRO tier upgrade (bronze→prata→ouro)
 *
 * Usage:
 *   import { checkAchievements } from '@/lib/notifications/achievement-engine';
 *   await checkAchievements(tenantId);
 *
 * Mock mode: works against in-memory store if Prisma unavailable.
 */

import { bridgeAchievement } from './bridges';
import { memoryStore } from './store';
import type { DDCNotification } from './types';

// ─── Tracking keys (in-memory — for dev/mock mode) ────────────────────────
// In production these would be columns on Tenant or a separate AchievementProgress table.
type AchievementProgress = {
  bookingsConfirmed: number;
  historicalMaxMrr: number;
  partnerTier: 'bronze' | 'prata' | 'ouro' | null;
  achievementsAwarded: Set<string>;
  lastCheckedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __ZELLA_ACHIEVEMENT_PROGRESS__: Map<string, AchievementProgress> | undefined;
}

const progressMap: Map<string, AchievementProgress> =
  globalThis.__ZELLA_ACHIEVEMENT_PROGRESS__ ?? new Map();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ZELLA_ACHIEVEMENT_PROGRESS__ = progressMap;
}

function getProgress(tenantId: string): AchievementProgress {
  let p = progressMap.get(tenantId);
  if (!p) {
    p = {
      bookingsConfirmed: 0,
      historicalMaxMrr: 0,
      partnerTier: null,
      achievementsAwarded: new Set<string>(),
      lastCheckedAt: new Date().toISOString(),
    };
    progressMap.set(tenantId, p);
  }
  return p;
}

// ─── Public: reset (for tests) ─────────────────────────────────────────────
export function __resetAchievementProgress(tenantId?: string): void {
  if (tenantId) {
    progressMap.delete(tenantId);
  } else {
    progressMap.clear();
  }
}

// ─── Public: get progress (for UI / Conquistas tab) ─────────────────────────
export interface AchievementProgressSnapshot {
  bookingsConfirmed: number;
  historicalMaxMrr: number;
  partnerTier: string | null;
  achievementsAwarded: string[];
  nextMilestone: { type: 'milestone_10' | 'milestone_100'; at: number; current: number } | null;
  achievementsHistory: DDCNotification[];
}

export function getAchievementProgress(tenantId: string): AchievementProgressSnapshot {
  const p = getProgress(tenantId);
  const history = memoryStore
    .query({ status: 'unread', limit: 100 })
    .filter((n) => n.category === 'achievements' && n.tenantId === tenantId);
  const next =
    p.bookingsConfirmed < 10
      ? { type: 'milestone_10' as const, at: 10, current: p.bookingsConfirmed }
      : p.bookingsConfirmed < 100
        ? { type: 'milestone_100' as const, at: 100, current: p.bookingsConfirmed }
        : null;
  return {
    bookingsConfirmed: p.bookingsConfirmed,
    historicalMaxMrr: p.historicalMaxMrr,
    partnerTier: p.partnerTier,
    achievementsAwarded: Array.from(p.achievementsAwarded),
    nextMilestone: next,
    achievementsHistory: history,
  };
}

// ─── Public: increment counters (call from webhooks/crons) ──────────────────
export function incrementBookingConfirmed(tenantId: string, count = 1): void {
  const p = getProgress(tenantId);
  p.bookingsConfirmed += count;
}

export function recordMrr(tenantId: string, mrr: number): void {
  const p = getProgress(tenantId);
  if (mrr > p.historicalMaxMrr) {
    p.historicalMaxMrr = mrr;
  }
}

export function setPartnerTier(
  tenantId: string,
  tier: 'bronze' | 'prata' | 'ouro'
): void {
  const p = getProgress(tenantId);
  p.partnerTier = tier;
}

// ─── Main: run all 5 trigger checks ─────────────────────────────────────────
export interface CheckResult {
  triggered: string[];
  skipped: string[];
  errors: string[];
}

export async function checkAchievements(
  tenantId: string,
  options: { currentMrr?: number; newPartnerTier?: 'bronze' | 'prata' | 'ouro'; newBookingsConfirmed?: number } = {}
): Promise<CheckResult> {
  const result: CheckResult = { triggered: [], skipped: [], errors: [] };
  const p = getProgress(tenantId);

  // Allow direct overrides for testing (mock mode); otherwise use stored counters
  if (typeof options.newBookingsConfirmed === 'number') {
    p.bookingsConfirmed = options.newBookingsConfirmed;
  }
  if (typeof options.currentMrr === 'number' && options.currentMrr > p.historicalMaxMrr) {
    p.historicalMaxMrr = options.currentMrr;
  }
  // NOTE: do NOT update p.partnerTier here — we need the previous tier
  // to detect level-up. We update only after the trigger check below.

  p.lastCheckedAt = new Date().toISOString();

  // Helper to award (idempotent within session — deduped by achievementType)
  const tryAward = (
    achievementType: 'first_booking' | 'milestone_10' | 'milestone_100' | 'revenue_record' | 'partner_level_up',
    isEligible: boolean,
    metadata?: Record<string, any>
  ): void => {
    if (!isEligible) {
      result.skipped.push(achievementType);
      return;
    }
    if (p.achievementsAwarded.has(achievementType)) {
      result.skipped.push(achievementType);
      return;
    }
    try {
      const r = bridgeAchievement({
        niche: 'all',
        achievementType,
        metadata: { tenantId, ...metadata },
        tenantId,
      });
      if (r.success) {
        p.achievementsAwarded.add(achievementType);
        result.triggered.push(achievementType);
      } else {
        result.errors.push(`${achievementType}: ${r.reason ?? 'unknown'}`);
      }
    } catch (e) {
      result.errors.push(
        `${achievementType}: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    }
  };

  // Trigger 1: first_booking — when bookingsConfirmed reaches 1
  tryAward('first_booking', p.bookingsConfirmed >= 1, {
    bookingCount: p.bookingsConfirmed,
  });

  // Trigger 2: milestone_10 — when bookingsConfirmed reaches 10
  tryAward('milestone_10', p.bookingsConfirmed >= 10, {
    bookingCount: p.bookingsConfirmed,
    milestone: 10,
  });

  // Trigger 3: milestone_100 — when bookingsConfirmed reaches 100
  tryAward('milestone_100', p.bookingsConfirmed >= 100, {
    bookingCount: p.bookingsConfirmed,
    milestone: 100,
  });

  // Trigger 4: revenue_record — when currentMrr exceeds historicalMaxMrr
  // (we already updated historicalMaxMrr above if options.currentMrr was passed;
  // for this trigger we use the *previous* max stored before update — so we use
  // a separate flag: only trigger if metadata says "new record")
  if (typeof options.currentMrr === 'number') {
    const wasRecord = options.currentMrr > 0 && options.currentMrr >= p.historicalMaxMrr;
    tryAward('revenue_record', wasRecord, {
      currentMrr: options.currentMrr,
      previousMaxMrr: p.historicalMaxMrr,
    });
  }

  // Trigger 5: partner_level_up — when partnerTier is set (and was previously null/lower)
  if (options.newPartnerTier) {
    const tierOrder: Record<string, number> = { bronze: 1, prata: 2, ouro: 3 };
    const previousTier = p.partnerTier;
    const previousLevel = previousTier ? tierOrder[previousTier] : 0;
    const newLevel = tierOrder[options.newPartnerTier];
    tryAward('partner_level_up', newLevel > previousLevel, {
      previousTier,
      newTier: options.newPartnerTier,
    });
    // Update stored tier AFTER trigger check so the comparison was against the previous value
    p.partnerTier = options.newPartnerTier;
  }

  return result;
}
