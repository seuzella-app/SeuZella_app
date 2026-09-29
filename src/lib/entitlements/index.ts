/**
 * SEUZELLA F28-B — Canonical Server-Side Entitlement Layer
 * ============================================================================
 *
 * Single authority for the commercial chain:
 *
 *     PLAN → ENTITLEMENT → QUOTA → USAGE → ENFORCEMENT
 *
 * WHAT THIS MODULE IS
 * -------------------
 * The deterministic server-side answer to: "which plan does this tenant have,
 * which features are unlocked, which quotas apply, how much has been consumed,
 * and is a given action allowed?".
 *
 * RELATIONSHIP TO EXISTING MODULES (do NOT duplicate — compose):
 *   - plan-features.ts  → taxonomy + feature matrix + tier levels (untouched).
 *   - plan-resolver.ts  → getEffectivePlan() (subscription > tenant.plan),
 *                         fail-closed to 'gratuito' on unknown/legacy values.
 *   - notifications/plan-limits-checker.ts → NOTIFICATION ONLY. It consumes
 *     the quota definitions from HERE; it is no longer a quota authority.
 *
 * QUOTAS (current commercial catalog — do NOT invent new limits):
 *   - LITE / GRATUITO: 50 guests/month · 500 messages/month
 *   - PRO / MAX / PARCEIRO: unlimited (PARCEIRO = full PRO parity, tier 2)
 *
 * F28-D CONTRACT (usage reliability):
 *   When the database is unavailable, usage is UNKNOWN — never fabricated.
 *   getMonthlyUsage() returns { available: false } and callers MUST treat it
 *   as "no data": no notifications, no billing decisions, no fabricated count.
 *
 * ============================================================================
 */

import type { PlanTier } from '@/lib/plan-features';
import { PLAN_DISPLAY, tierLevel, hasAccess, migratePlanLegacy, DDC_TABS } from '@/lib/plan-features';

// ── Quota catalog (single source of truth) ──────────────────────────────────

export type QuotaResource = 'guests' | 'messages';

export interface QuotaDef {
  resource: QuotaResource;
  /** Monthly limit; -1 means unlimited. */
  monthlyLimit: number;
  unlimited: boolean;
}

const LIMITED_QUOTAS: Record<QuotaResource, QuotaDef> = {
  guests: { resource: 'guests', monthlyLimit: 50, unlimited: false },
  messages: { resource: 'messages', monthlyLimit: 500, unlimited: false },
};

const UNLIMITED_QUOTAS: Record<QuotaResource, QuotaDef> = {
  guests: { resource: 'guests', monthlyLimit: -1, unlimited: true },
  messages: { resource: 'messages', monthlyLimit: -1, unlimited: true },
};

export const PLAN_QUOTAS: Record<PlanTier, Record<QuotaResource, QuotaDef>> = {
  gratuito: LIMITED_QUOTAS,
  lite: LIMITED_QUOTAS,
  pro: UNLIMITED_QUOTAS,
  max: UNLIMITED_QUOTAS,
  // PARCEIRO: full PRO parity (commercial canon: R$247/mês, 24 months).
  parceiro: UNLIMITED_QUOTAS,
};

/** Back-compat aliases (previously hardcoded in plan-limits-checker.ts). */
export const LITE_GUESTS_LIMIT = 50;
export const LITE_MESSAGES_LIMIT = 500;

export function getQuota(plan: PlanTier | string, resource: QuotaResource): QuotaDef {
  const tier = normalizePlan(plan);
  return PLAN_QUOTAS[tier][resource];
}

export function isUnlimitedPlan(plan: PlanTier | string): boolean {
  const tier = normalizePlan(plan);
  return PLAN_QUOTAS[tier].guests.unlimited;
}

/** Normalizes any legacy/unknown plan string via the unified taxonomy. */
export function normalizePlan(plan: PlanTier | string): PlanTier {
  const allowed: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
  if (allowed.includes(plan as PlanTier)) return plan as PlanTier;
  return migratePlanLegacy(String(plan));
}

// ── USAGE (F28-D: unknown ≠ fabricated) ─────────────────────────────────────

export interface UsageResult {
  /** true → count is real (from DB). false → UNKNOWN; count MUST be ignored. */
  available: boolean;
  /** Real usage when available; 0 when unavailable (never a fabricated value). */
  count: number;
  source: 'db' | 'unavailable';
}

const startOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Lazy db resolution, memoized ONCE per process. Besides avoiding the Prisma
// client at module load (same reason the checker does lazy import), a single
// shared import() prevents concurrent dynamic imports from racing module
// resolution (F28: two Promise.all branches resolving db simultaneously).
let dbPromise: Promise<typeof import('@/lib/db')['db']> | null = null;
function getDb(): Promise<typeof import('@/lib/db')['db']> {
  if (!dbPromise) {
    dbPromise = import('@/lib/db').then((m) => m.db);
  }
  return dbPromise;
}

async function countSince(tenantId: string, resource: QuotaResource, since: Date): Promise<number> {
  const db = await getDb();
  if (resource === 'guests') {
    return db.booking.count({ where: { tenantId, createdAt: { gte: since } } });
  }
  return db.conversationLog.count({ where: { tenantId, createdAt: { gte: since } } });
}

/**
 * Real monthly usage for a tenant/resource. NEVER fabricates data:
 * on DB failure returns { available: false, count: 0, source: 'unavailable' }.
 */
export async function getMonthlyUsage(tenantId: string, resource: QuotaResource): Promise<UsageResult> {
  try {
    const count = await countSince(tenantId, resource, startOfCurrentMonth());
    return { available: true, count, source: 'db' };
  } catch (err) {
    console.error('[entitlements] usage unavailable — returning UNKNOWN (not fabricating)', {
      tenantId,
      resource,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { available: false, count: 0, source: 'unavailable' };
  }
}

// ── ENFORCEMENT ─────────────────────────────────────────────────────────────

export type EnforcementReason =
  | 'ok'
  | 'unlimited'
  | 'quota_exceeded'
  | 'usage_unavailable'
  | 'invalid_tenant';

export interface EnforcementDecision {
  plan: PlanTier;
  resource: QuotaResource;
  requested: number;
  /** false when the action must NOT proceed (fail-closed by default). */
  allowed: boolean;
  reason: EnforcementReason;
  limit: number;
  unlimited: boolean;
  usage: UsageResult | null;
  /** How 'usage_unavailable' was treated. */
  policy: 'fail_closed' | 'fail_open';
}

/**
 * Deterministic enforcement for "may this tenant consume N more units?".
 *
 * - Unlimited plans → always allowed (reason 'unlimited').
 * - Limited plans with real usage → allowed iff usage + requested <= limit.
 * - Limited plans with UNAVAILABLE usage → governed by policy:
 *     fail_closed (default): NOT allowed — never decide on fabricated data.
 *     fail_open: allowed, but reason stays 'usage_unavailable' so callers can
 *     audit every bypass (e.g. non-commercial flows that must not break).
 */
export async function checkQuota(
  tenantId: string,
  plan: PlanTier | string,
  resource: QuotaResource,
  requested = 1,
  policy: 'fail_closed' | 'fail_open' = 'fail_closed',
): Promise<EnforcementDecision> {
  const tier = normalizePlan(plan);
  const quota = PLAN_QUOTAS[tier][resource];
  const base: EnforcementDecision = {
    plan: tier,
    resource,
    requested,
    allowed: false,
    reason: 'ok',
    limit: quota.monthlyLimit,
    unlimited: quota.unlimited,
    usage: null,
    policy,
  };

  if (quota.unlimited) {
    return { ...base, allowed: true, reason: 'unlimited' };
  }

  const usage = await getMonthlyUsage(tenantId, resource);
  if (!usage.available) {
    return {
      ...base,
      allowed: policy === 'fail_open',
      reason: 'usage_unavailable',
      usage,
    };
  }

  return {
    ...base,
    allowed: usage.count + requested <= quota.monthlyLimit,
    reason: usage.count + requested <= quota.monthlyLimit ? 'ok' : 'quota_exceeded',
    usage,
  };
}

// ── ENTITLEMENT RESOLUTION (full answer for a tenant) ───────────────────────

export interface TenantEntitlement {
  plan: PlanTier;
  display: { name: string; price: number; priceLabel: string };
  tierLevel: number;
  unlimited: boolean;
  quotas: Record<QuotaResource, QuotaDef>;
  tabAccess: Record<string, boolean>;
  resolvedFrom: 'subscription_or_tenant' | 'fail_closed_gratuito';
}

/**
 * Full entitlement snapshot for a tenant. Fail-closed: DB error, missing
 * tenant or unknown plan all resolve to 'gratuito' (via getEffectivePlan).
 */
export async function resolveEntitlement(tenantId: string): Promise<TenantEntitlement> {
  let plan: PlanTier = 'gratuito';
  let resolvedFrom: TenantEntitlement['resolvedFrom'] = 'fail_closed_gratuito';
  try {
    const { getEffectivePlan } = await import('@/lib/plan-resolver');
    const effective = await getEffectivePlan(tenantId);
    plan = normalizePlan(effective);
    resolvedFrom = 'subscription_or_tenant';
  } catch (err) {
    console.error('[entitlements] resolveEntitlement failed — fail-closed to gratuito', {
      tenantId,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  return {
    plan,
    display: {
      name: PLAN_DISPLAY[plan].name,
      price: PLAN_DISPLAY[plan].price,
      priceLabel: PLAN_DISPLAY[plan].priceLabel,
    },
    tierLevel: tierLevel(plan),
    unlimited: isUnlimitedPlan(plan),
    quotas: PLAN_QUOTAS[plan],
    tabAccess: buildTabAccess(plan),
    resolvedFrom,
  };
}

function buildTabAccess(plan: PlanTier): Record<string, boolean> {
  const access: Record<string, boolean> = {};
  for (const tab of DDC_TABS) access[tab.id] = hasAccess(plan, tab.minTier);
  return access;
}
