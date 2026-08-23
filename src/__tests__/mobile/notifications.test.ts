/**
 * Tests for src/lib/notifications/achievement-engine.ts (Gap 12)
 *
 * Validates the 5 triggers:
 *  1. first_booking — fires when bookingsConfirmed >= 1
 *  2. milestone_10 — fires when bookingsConfirmed >= 10
 *  3. milestone_100 — fires when bookingsConfirmed >= 100
 *  4. revenue_record — fires when currentMrr > historicalMaxMrr
 *  5. partner_level_up — fires when tier moves up
 *
 * Also validates idempotency within a session (each achievement fires only once).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkAchievements,
  getAchievementProgress,
  incrementBookingConfirmed,
  recordMrr,
  setPartnerTier,
  __resetAchievementProgress,
} from '@/lib/notifications/achievement-engine';
import { memoryStore } from '@/lib/notifications/producer';

describe('checkAchievements — first_booking trigger', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires first_booking when 1+ bookings confirmed', async () => {
    const result = await checkAchievements('tenant-1', { newBookingsConfirmed: 1 });
    expect(result.triggered).toContain('first_booking');
  });

  it('does NOT fire first_booking when 0 bookings', async () => {
    const result = await checkAchievements('tenant-2', { newBookingsConfirmed: 0 });
    expect(result.triggered).not.toContain('first_booking');
    expect(result.skipped).toContain('first_booking');
  });
});

describe('checkAchievements — milestone_10 trigger', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires milestone_10 when 10+ bookings confirmed', async () => {
    const result = await checkAchievements('tenant-1', { newBookingsConfirmed: 10 });
    expect(result.triggered).toContain('milestone_10');
  });

  it('does NOT fire milestone_10 when < 10 bookings', async () => {
    const result = await checkAchievements('tenant-1', { newBookingsConfirmed: 9 });
    expect(result.triggered).not.toContain('milestone_10');
  });
});

describe('checkAchievements — milestone_100 trigger', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires milestone_100 when 100+ bookings confirmed', async () => {
    const result = await checkAchievements('tenant-1', { newBookingsConfirmed: 100 });
    expect(result.triggered).toContain('milestone_100');
  });
});

describe('checkAchievements — revenue_record trigger', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires revenue_record when currentMrr > 0 (first record)', async () => {
    const result = await checkAchievements('tenant-1', { currentMrr: 5000 });
    expect(result.triggered).toContain('revenue_record');
  });

  it('does NOT fire revenue_record when currentMrr is 0', async () => {
    const result = await checkAchievements('tenant-1', { currentMrr: 0 });
    expect(result.triggered).not.toContain('revenue_record');
  });
});

describe('checkAchievements — partner_level_up trigger', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires partner_level_up when tier is set for first time', async () => {
    const result = await checkAchievements('tenant-1', { newPartnerTier: 'bronze' });
    expect(result.triggered).toContain('partner_level_up');
  });

  it('does NOT fire partner_level_up when same tier is set again', async () => {
    // First call — fires
    await checkAchievements('tenant-1', { newPartnerTier: 'bronze' });
    // Second call — should be deduped (idempotent within session)
    const result2 = await checkAchievements('tenant-1', { newPartnerTier: 'bronze' });
    expect(result2.triggered).not.toContain('partner_level_up');
  });

  it('fires partner_level_up again when tier moves UP (bronze → prata)', async () => {
    // Set initial tier
    setPartnerTier('tenant-1', 'bronze');
    await checkAchievements('tenant-1');
    memoryStore.clear();

    // Move to prata
    __resetAchievementProgress('tenant-1');
    setPartnerTier('tenant-1', 'bronze'); // re-set previous tier to track properly
    const result = await checkAchievements('tenant-1', { newPartnerTier: 'prata' });
    expect(result.triggered).toContain('partner_level_up');
  });
});

describe('checkAchievements — idempotency (session dedup)', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('fires first_booking only once even if checkAchievements is called multiple times', async () => {
    // First call
    const r1 = await checkAchievements('tenant-1', { newBookingsConfirmed: 5 });
    expect(r1.triggered).toContain('first_booking');

    // Second call — should be deduped
    const r2 = await checkAchievements('tenant-1', { newBookingsConfirmed: 5 });
    expect(r2.triggered).not.toContain('first_booking');
    expect(r2.skipped).toContain('first_booking');
  });
});

describe('getAchievementProgress — UI snapshot', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('returns progress with nextMilestone when < 10 bookings', async () => {
    await checkAchievements('tenant-1', { newBookingsConfirmed: 8 });
    const snap = getAchievementProgress('tenant-1');
    expect(snap.bookingsConfirmed).toBe(8);
    expect(snap.nextMilestone?.type).toBe('milestone_10');
    expect(snap.nextMilestone?.current).toBe(8);
    expect(snap.nextMilestone?.at).toBe(10);
  });

  it('returns nextMilestone=milestone_100 when 10 <= bookings < 100', async () => {
    await checkAchievements('tenant-1', { newBookingsConfirmed: 50 });
    const snap = getAchievementProgress('tenant-1');
    expect(snap.nextMilestone?.type).toBe('milestone_100');
  });

  it('returns nextMilestone=null when 100+ bookings', async () => {
    await checkAchievements('tenant-1', { newBookingsConfirmed: 150 });
    const snap = getAchievementProgress('tenant-1');
    expect(snap.nextMilestone).toBeNull();
  });

  it('returns achievementsAwarded list', async () => {
    await checkAchievements('tenant-1', { newBookingsConfirmed: 1 });
    const snap = getAchievementProgress('tenant-1');
    expect(snap.achievementsAwarded).toContain('first_booking');
  });
});

describe('incrementBookingConfirmed / recordMrr / setPartnerTier (helpers)', () => {
  beforeEach(() => {
    __resetAchievementProgress();
    memoryStore.clear();
  });

  it('incrementBookingConfirmed accumulates correctly', () => {
    incrementBookingConfirmed('tenant-1', 5);
    incrementBookingConfirmed('tenant-1', 3);
    const snap = getAchievementProgress('tenant-1');
    expect(snap.bookingsConfirmed).toBe(8);
  });

  it('recordMrr updates historicalMaxMrr only when value is higher', () => {
    recordMrr('tenant-1', 5000);
    recordMrr('tenant-1', 3000); // lower — should not update
    const snap = getAchievementProgress('tenant-1');
    expect(snap.historicalMaxMrr).toBe(5000);
  });

  it('setPartnerTier stores the tier', () => {
    setPartnerTier('tenant-1', 'prata');
    const snap = getAchievementProgress('tenant-1');
    expect(snap.partnerTier).toBe('prata');
  });
});
