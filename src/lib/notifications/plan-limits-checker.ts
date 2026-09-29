/**
 * Zélla — LITE Plan Limits Checker (Gap 10) · F28-C/D refactor
 * ============================================================================
 *
 * RESPONSIBILITY (narrowed in F28): NOTIFICATION ONLY.
 * The quota authority is now `@/lib/entitlements` (PLAN → ENTITLEMENT → QUOTA
 * → USAGE → ENFORCEMENT). This checker consumes its catalog and its real
 * usage reads — it no longer owns limits and no longer fabricates usage.
 *
 * Limits (catalog-owned, re-exported here for back-compat):
 *  - LITE / GRATUITO: 50 hóspedes/mês (80% = 40 → warning; 100% = 50 → critical)
 *  - LITE / GRATUITO: 500 mensagens/mês (80% = 400 → warning; 100% = 500 → critical)
 *
 * F28-D CONTRACT — DB UNAVAILABLE:
 *  - Usage is UNKNOWN, never fabricated (the old random-usage mock is GONE).
 *  - With unavailable usage: NO threshold notifications are sent, no upgrade
 *    suggestion fires, and the result is marked status 'unavailable'/'partial'
 *    with `available: false` on the affected dimension.
 *
 * Public API: checkPlanLimits(tenantId, plan)
 * Cron: src/app/api/cron/plan-limits-check/route.ts (daily 08:00 BRT)
 */

import { notify } from './producer';
import {
  PLAN_QUOTAS,
  getMonthlyUsage,
  normalizePlan,
  type QuotaResource,
} from '@/lib/entitlements';

// ─── Back-compat aliases (canonical values now live in @/lib/entitlements) ──
export const LITE_GUESTS_LIMIT = 50;
export const LITE_MESSAGES_LIMIT = 500;

// ─── Result ─────────────────────────────────────────────────────────────────
export interface UsageDimension {
  /** Real usage when available; 0 when UNKNOWN (never fabricated). */
  count: number;
  limit: number;
  percent: number;
  /** false → DB unavailable this cycle; count/percent carry no information. */
  available: boolean;
}

export interface PlanLimitsResult {
  plan: string;
  guests: UsageDimension;
  messages: UsageDimension;
  notificationsSent: string[];
  /** 'ok' | 'partial' (one dimension unknown) | 'unavailable' (both unknown). */
  status: 'ok' | 'partial' | 'unavailable';
  /** Dimensions whose usage could not be read this cycle. */
  unavailable: QuotaResource[];
}

function dimension(count: number, limit: number, available: boolean): UsageDimension {
  return {
    count: available ? count : 0,
    limit,
    percent: available ? Math.round((count / limit) * 100) : 0,
    available,
  };
}

// ─── Public: check & notify ─────────────────────────────────────────────────
export async function checkPlanLimits(
  tenantId: string,
  plan: string
): Promise<PlanLimitsResult> {
  const tier = normalizePlan(plan);
  const quotas = PLAN_QUOTAS[tier];

  const result: PlanLimitsResult = {
    plan: tier,
    guests: dimension(0, quotas.guests.monthlyLimit, false),
    messages: dimension(0, quotas.messages.monthlyLimit, false),
    notificationsSent: [],
    status: 'unavailable',
    unavailable: ['guests', 'messages'],
  };

  // Only LIMITED plans have threshold notifications; unlimited plans
  // (PRO/MAX/PARCEIRO — full PRO parity) report healthy empty state.
  if (quotas.guests.unlimited) {
    result.guests = dimension(0, quotas.guests.monthlyLimit, true);
    result.messages = dimension(0, quotas.messages.monthlyLimit, true);
    result.status = 'ok';
    result.unavailable = [];
    return result;
  }

  // ── REAL usage (F28-D: unknown ≠ fabricated) ──
  const [guestsUsage, messagesUsage] = await Promise.all([
    getMonthlyUsage(tenantId, 'guests'),
    getMonthlyUsage(tenantId, 'messages'),
  ]);

  result.guests = dimension(guestsUsage.count, quotas.guests.monthlyLimit, guestsUsage.available);
  result.messages = dimension(
    messagesUsage.count,
    quotas.messages.monthlyLimit,
    messagesUsage.available,
  );
  result.unavailable = [
    ...(guestsUsage.available ? [] : (['guests'] as QuotaResource[])),
    ...(messagesUsage.available ? [] : (['messages'] as QuotaResource[])),
  ];
  result.status =
    result.unavailable.length === 0
      ? 'ok'
      : result.unavailable.length === 2
        ? 'unavailable'
        : 'partial';

  // F28-D: with unknown usage there is NOTHING honest to notify about.
  if (result.status !== 'ok') {
    console.warn('[plan-limits-checker] usage unavailable — skipping notifications (no fabricated data)', {
      tenantId,
      plan: tier,
      unavailable: result.unavailable,
    });
    return result;
  }

  const guestCount = result.guests.count;
  const messageCount = result.messages.count;
  const guestsLimit = quotas.guests.monthlyLimit;
  const messagesLimit = quotas.messages.monthlyLimit;

  // ── Trigger notifications based on thresholds ──
  const tryNotify = (type: string, priority: 'medium' | 'high' | 'urgent', metadata: Record<string, any>) => {
    try {
      const r = notify({
        niche: 'all',
        type,
        priority,
        source: 'plan_system',
        metadata,
        tenantId,
        actionUrl: '/mobile/pousada?tab=config',
        actionLabel: 'Ver plano',
      });
      if (r.success) result.notificationsSent.push(type);
    } catch (e) {
      console.error('[plan-limits-checker] notify failed:', e);
    }
  };

  // ── Guests thresholds ──
  if (guestCount >= guestsLimit) {
    tryNotify('plan.lite_exceeded', 'urgent', {
      resource: 'guests',
      count: guestCount,
      limit: guestsLimit,
      message: `Limite LITE excedido: ${guestCount}/${guestsLimit} hóspedes`,
    });
  } else if (guestCount >= guestsLimit * 0.8) {
    tryNotify('plan.lite_guests_limit', 'high', {
      count: guestCount,
      limit: guestsLimit,
      percent: result.guests.percent,
    });
  }

  // ── Messages thresholds ──
  if (messageCount >= messagesLimit) {
    tryNotify('plan.lite_exceeded', 'urgent', {
      resource: 'messages',
      count: messageCount,
      limit: messagesLimit,
      message: `Limite LITE excedido: ${messageCount}/${messagesLimit} mensagens`,
    });
  } else if (messageCount >= messagesLimit * 0.8) {
    tryNotify('plan.lite_messages_limit', 'high', {
      count: messageCount,
      limit: messagesLimit,
      percent: result.messages.percent,
    });
  }

  // ── Upgrade suggestion (only if both are above 60% — once a week signal) ──
  if (result.guests.percent > 60 && result.messages.percent > 60) {
    tryNotify('plan.upgrade_suggestion', 'medium', {
      currentPlan: tier,
      recommendedPlan: 'pro',
      guestsPercent: result.guests.percent,
      messagesPercent: result.messages.percent,
    });
  }

  return result;
}
