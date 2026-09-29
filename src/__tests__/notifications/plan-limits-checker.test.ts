/**
 * Tests for src/lib/notifications/plan-limits-checker.ts (Gap 10 · F28-C/D)
 *
 * Validates:
 *  - LITE_GUESTS_LIMIT = 50, LITE_MESSAGES_LIMIT = 500 (catalog via entitlements)
 *  - 80% threshold → fires plan.lite_guests_limit / plan.lite_messages_limit
 *  - 100% threshold → fires plan.lite_exceeded (urgent)
 *  - Below 80% → no notification fired
 *  - PRO/MAX/PARCEIRO plans: unlimited — no limits, no notifications
 *  - Upgrade suggestion fires when both > 60%
 *  - F28-D: DB unavailable → usage UNKNOWN, NO fabricated counts, NO notifications
 *  - Returns proper PlanLimitsResult shape (with available/status/unavailable)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const dbMock = {
  booking: { count: vi.fn() },
  conversationLog: { count: vi.fn() },
};

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  checkPlanLimits,
  LITE_GUESTS_LIMIT,
  LITE_MESSAGES_LIMIT,
} from '@/lib/notifications/plan-limits-checker';
import { memoryStore } from '@/lib/notifications/producer';

function mockDb(guests: number | Error, messages: number | Error) {
  dbMock.booking.count.mockReset();
  dbMock.conversationLog.count.mockReset();
  dbMock.booking.count.mockImplementation(async () => {
    if (guests instanceof Error) throw guests;
    return guests;
  });
  dbMock.conversationLog.count.mockImplementation(async () => {
    if (messages instanceof Error) throw messages;
    return messages;
  });
}

describe('Plan limits constants (catalog-owned)', () => {
  it('LITE_GUESTS_LIMIT is 50', () => {
    expect(LITE_GUESTS_LIMIT).toBe(50);
  });

  it('LITE_MESSAGES_LIMIT is 500', () => {
    expect(LITE_MESSAGES_LIMIT).toBe(500);
  });
});

describe('checkPlanLimits — unlimited plans (PRO/MAX/PARCEIRO)', () => {
  beforeEach(() => {
    memoryStore.clear();
    mockDb(0, 0);
  });

  it('PRO returns healthy unlimited result (no limits enforced)', async () => {
    const result = await checkPlanLimits('tenant-pro-1', 'pro');
    expect(result.plan).toBe('pro');
    expect(result.status).toBe('ok');
    expect(result.notificationsSent).toHaveLength(0);
    expect(result.guests.available).toBe(true);
    expect(result.guests.count).toBe(0);
    expect(result.messages.count).toBe(0);
  });

  it('MAX returns healthy unlimited result', async () => {
    const result = await checkPlanLimits('tenant-max-1', 'max');
    expect(result.status).toBe('ok');
    expect(result.notificationsSent).toHaveLength(0);
  });

  it('PARCEIRO returns healthy unlimited result (full PRO parity)', async () => {
    const result = await checkPlanLimits('tenant-parceiro-1', 'parceiro');
    expect(result.status).toBe('ok');
    expect(result.notificationsSent).toHaveLength(0);
    expect(result.unavailable).toHaveLength(0);
  });
});

describe('checkPlanLimits — LITE thresholds (real DB reads)', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('below 80% → no notification', async () => {
    mockDb(10, 100);
    const result = await checkPlanLimits('tenant-lite-1', 'lite');
    expect(result.status).toBe('ok');
    expect(result.guests).toMatchObject({ count: 10, limit: 50, percent: 20, available: true });
    expect(result.messages).toMatchObject({ count: 100, limit: 500, percent: 20, available: true });
    expect(result.notificationsSent).toHaveLength(0);
  });

  it('exactly 80% of guests (40/50) → fires plan.lite_guests_limit (high)', async () => {
    mockDb(40, 100);
    const result = await checkPlanLimits('tenant-lite-2', 'lite');
    expect(result.notificationsSent).toContain('plan.lite_guests_limit');
    expect(result.notificationsSent).not.toContain('plan.lite_messages_limit');
  });

  it('exactly 80% of messages (400/500) → fires plan.lite_messages_limit (high)', async () => {
    mockDb(10, 400);
    const result = await checkPlanLimits('tenant-lite-3', 'lite');
    expect(result.notificationsSent).toContain('plan.lite_messages_limit');
  });

  it('100% of guests (50/50) → fires plan.lite_exceeded (urgent)', async () => {
    mockDb(50, 100);
    const result = await checkPlanLimits('tenant-lite-4', 'lite');
    expect(result.notificationsSent).toContain('plan.lite_exceeded');
  });

  it('above the limit (57/50) → fires plan.lite_exceeded', async () => {
    mockDb(57, 520);
    const result = await checkPlanLimits('tenant-lite-5', 'lite');
    expect(result.notificationsSent).toContain('plan.lite_exceeded');
  });

  it('100% of messages (500/500) → fires plan.lite_exceeded', async () => {
    mockDb(10, 500);
    const result = await checkPlanLimits('tenant-lite-6', 'lite');
    expect(result.notificationsSent).toContain('plan.lite_exceeded');
  });

  it('both above 60% → fires plan.upgrade_suggestion', async () => {
    mockDb(40, 400);
    const result = await checkPlanLimits('tenant-lite-7', 'lite');
    expect(result.notificationsSent).toContain('plan.upgrade_suggestion');
  });

  it('all fired notifications have correct type prefix (plan.*)', async () => {
    mockDb(50, 500);
    const result = await checkPlanLimits('tenant-lite-8', 'lite');
    for (const type of result.notificationsSent) {
      expect(type.startsWith('plan.')).toBe(true);
      expect(
        type === 'plan.lite_guests_limit' ||
          type === 'plan.lite_messages_limit' ||
          type === 'plan.lite_exceeded' ||
          type === 'plan.upgrade_suggestion'
      ).toBe(true);
    }
  });
});

describe('checkPlanLimits — gratuito plan (treated like LITE)', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('gratuito plan also enforces LITE limits with real usage', async () => {
    mockDb(45, 450);
    const result = await checkPlanLimits('tenant-gratuito-1', 'gratuito');
    expect(result.plan).toBe('gratuito');
    expect(result.guests.limit).toBe(LITE_GUESTS_LIMIT);
    expect(result.messages.limit).toBe(LITE_MESSAGES_LIMIT);
    expect(result.status).toBe('ok');
    expect(result.notificationsSent).toContain('plan.lite_guests_limit');
    expect(result.notificationsSent).toContain('plan.lite_messages_limit');
  });
});

describe('checkPlanLimits — F28-D: DB unavailable NEVER fabricates usage', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('both dimensions unavailable → status unavailable, zero notifications, no fabricated counts', async () => {
    mockDb(new Error('P1001: database unreachable'), new Error('P1001'));
    const result = await checkPlanLimits('tenant-db-down-1', 'lite');

    expect(result.status).toBe('unavailable');
    expect(result.unavailable).toEqual(['guests', 'messages']);
    expect(result.guests).toMatchObject({ count: 0, percent: 0, available: false });
    expect(result.messages).toMatchObject({ count: 0, percent: 0, available: false });
    expect(result.notificationsSent).toHaveLength(0);
    // The old Math.random mock produced 35–54 / 350–549 — this is the
    // regression guard: no value in those fabricated ranges can appear.
    expect(result.guests.count).toBe(0);
    expect(result.messages.count).toBe(0);
  });

  it('one dimension unavailable → status partial and NO notifications (even for the known one)', async () => {
    mockDb(50, new Error('P1001'));
    const result = await checkPlanLimits('tenant-db-down-2', 'lite');

    expect(result.status).toBe('partial');
    expect(result.unavailable).toEqual(['messages']);
    expect(result.guests).toMatchObject({ count: 50, available: true }); // real read kept
    expect(result.messages.available).toBe(false);
    expect(result.notificationsSent).toHaveLength(0); // decision needs the FULL picture
  });

  it('tenant not found in DB behaves as unknown usage (no crash, no fabrication)', async () => {
    mockDb(new Error('P2025'), new Error('P2025'));
    const result = await checkPlanLimits('tenant-ghost-1', 'lite');
    expect(result.status).toBe('unavailable');
    expect(result.notificationsSent).toHaveLength(0);
  });

  it('plan change from lite to pro bypasses the DB-down problem entirely', async () => {
    mockDb(new Error('P1001'), new Error('P1001'));
    const result = await checkPlanLimits('tenant-upgraded-1', 'pro');
    expect(result.status).toBe('ok'); // unlimited plan: healthy empty state
    expect(result.notificationsSent).toHaveLength(0);
  });
});

describe('checkPlanLimits — PlanLimitsResult shape', () => {
  it('returns object with all required fields (incl. F28 additions)', async () => {
    mockDb(0, 0);
    const result = await checkPlanLimits('tenant-test-1', 'lite');
    expect(result).toHaveProperty('plan');
    expect(result).toHaveProperty('guests');
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('notificationsSent');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('unavailable');
    expect(result.guests).toHaveProperty('count');
    expect(result.guests).toHaveProperty('limit');
    expect(result.guests).toHaveProperty('percent');
    expect(result.guests).toHaveProperty('available');
    expect(result.messages).toHaveProperty('available');
    expect(Array.isArray(result.notificationsSent)).toBe(true);
  });
});
