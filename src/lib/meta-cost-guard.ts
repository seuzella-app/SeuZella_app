import { db } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plan-resolver";

const META_COST_PER_MSG = parseFloat(
  process.env.META_COST_PER_SERVICE_MSG || "0.0068"
);
const META_COST_ENABLED = process.env.META_COST_ENABLED !== "false";

interface MetaCostEntry {
  tenantId: string;
  conversationId: string;
  messageId?: string;
  guestId?: string;
  messageType: "service_reply" | "marketing_template" | "utility_template";
  intent?: string;
  metadata?: Record<string, unknown>;
  /** Whether the message was sent inside the 24h Customer Service Window */
  withinServiceWindow?: boolean;
}

export async function recordMetaCost(entry: MetaCostEntry): Promise<void> {
  if (!META_COST_ENABLED) return;

  // Messages inside the 24h Customer Service Window may have different
  // cost treatment per Meta 2026 rules. Track window status for analytics.
  const costUsd =
    entry.messageType === "service_reply"
      ? META_COST_PER_MSG
      : entry.messageType === "utility_template"
        ? META_COST_PER_MSG * 0.5 // Utility templates typically cost less
        : 0; // Marketing templates have their own cost tracking

  if (costUsd === 0) return;

  try {
    await db.metaCostLog.create({
      data: {
        tenantId: entry.tenantId,
        conversationId: entry.conversationId,
        messageId: entry.messageId || null,
        guestId: entry.guestId || null,
        costUsd,
        messageType: entry.messageType,
        intent: entry.intent || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : "{}",
      },
    });
  } catch (error) {
    console.error("Failed to record Meta Cost Log:", error);
  }
}

export async function getMetaCostSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const logs = await db.metaCostLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        costUsd: true,
        messageType: true,
        intent: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const totalUsd = logs.reduce((sum, l) => sum + l.costUsd, 0);
    const byIntent = logs.reduce((acc, l) => {
      const key = l.intent || "desconhecido";
      acc[key] = (acc[key] || 0) + l.costUsd;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsd,
      totalBrl: totalUsd * 5.15, // cotacao aproximada
      messageCount: logs.length,
      avgCostPerMsg: logs.length > 0 ? totalUsd / logs.length : 0,
      byIntent,
      period: { start: startDate, end: endDate },
    };
  } catch (error) {
    console.error("Failed to get Meta Cost Summary:", error);
    return {
      totalUsd: 0,
      totalBrl: 0,
      messageCount: 0,
      avgCostPerMsg: 0,
      byIntent: {},
      period: { start: startDate, end: endDate },
    };
  }
}

// ─── Budget Enforcement ──────────────────────────────────────────────────────

const BUDGET_OVERRIDE = process.env.META_BUDGET_ENFORCEMENT_DISABLED === "true";

type PlanKey = "gratuito" | "lite" | "pro" | "max" | "parceiro";

const BUDGET_LIMITS: Record<PlanKey, number> = {
  gratuito: parseFloat(process.env.META_BUDGET_GRATUITO_USD || "3.40"),
  lite: parseFloat(process.env.META_BUDGET_LITE_USD || "12.00"), // ~350 msgs/mês — viável para R$197
  pro: parseFloat(process.env.META_BUDGET_PRO_USD || "34.00"),
  max: parseFloat(process.env.META_BUDGET_MAX_USD || "68.00"),
  parceiro: parseFloat(process.env.META_BUDGET_PARCEIRO_USD || "34.00"),
};

// Simple in-memory cache (serverless-safe, lazy cleanup)
interface CacheEntry {
  result: Awaited<ReturnType<typeof checkMetaBudget>>;
  expiresAt: number;
}

const budgetCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCacheKey(tenantId: string): string {
  // Include current month so the cache auto-invalidates on month boundary
  const now = new Date();
  return `${tenantId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of budgetCache) {
    if (entry.expiresAt <= now) {
      budgetCache.delete(key);
    }
  }
}

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Classifies the message type based on content and intent.
 * Meta 2026 charges differently per category:
 *   - utility: confirmations, status updates, policy info (lowest cost)
 *   - service: answers to guest questions, support (standard cost)
 *   - marketing: promotions, offers (highest cost, requires opt-in)
 */
export function classifyMessageType(intent?: string): "service_reply" | "marketing_template" | "utility_template" {
  if (!intent) return "service_reply";
  const UTILITY_INTENTS: string[] = ["checkin_checkout", "agradecimento", "opt_out_confirmation", "cota_excedida"];
  const MARKETING_INTENTS: string[] = [];
  if (UTILITY_INTENTS.includes(intent)) return "utility_template";
  if (MARKETING_INTENTS.includes(intent)) return "marketing_template";
  return "service_reply";
}

/**
 * Checks the 24h Customer Service Window for a conversation.
 * Meta allows free/cheaper service messages within 24h of the
 * guest's last message. Returns true if the window is still open.
 */
export function isWithinServiceWindow(lastGuestMessageAt?: Date | null): boolean {
  if (!lastGuestMessageAt) return false;
  const WINDOW_HOURS = 24;
  const elapsed = Date.now() - lastGuestMessageAt.getTime();
  return elapsed < WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Returns remaining hours in the 24h service window, or 0 if closed.
 */
export function getServiceWindowRemaining(lastGuestMessageAt?: Date | null): number {
  if (!lastGuestMessageAt) return 0;
  const WINDOW_HOURS = 24;
  const elapsedMs = Date.now() - lastGuestMessageAt.getTime();
  const remainingMs = WINDOW_HOURS * 60 * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.round(remainingMs / (60 * 60 * 1000) * 10) / 10);
}

export async function checkMetaBudget(tenantId: string): Promise<{
  allowed: boolean;
  reason?: string;
  currentSpendUsd: number;
  budgetLimitUsd: number;
  usagePercent: number;
}> {
  // Hardcoded override for testing
  if (BUDGET_OVERRIDE) {
    return { allowed: true, currentSpendUsd: 0, budgetLimitUsd: Infinity, usagePercent: 0 };
  }

  // Check cache
  const cacheKey = getCacheKey(tenantId);
  const cached = budgetCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Lazy cleanup of stale entries (runs at most once per invocation)
  evictExpired();

  // 1. Get current month's total Meta cost
  const { start, end } = getCurrentMonthRange();

  let currentSpendUsd = 0;
  try {
    const aggregate = await db.metaCostLog.aggregate({
      _sum: { costUsd: true },
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
    });
    currentSpendUsd = aggregate._sum.costUsd ?? 0;
  } catch (error) {
    // CORREÇÃO v2 — finding 2.5: fail-CLOSED em erro de DB.
    // Em SaaS B2B com cobrança Meta real, fail-open permite que um tenant
    // dispare mensagens ilimitadas enquanto o DB estiver indisponível,
    // gerando custo real ao cliente. Melhor bloquear e alertar.
    console.error("[checkMetaBudget] CRÍTICO: DB error — fail-closed para proteção:", error);
    // TODO: integrar Sentry/Datadog: Sentry.captureException(error);
    const failClosedResult = {
      allowed: false,
      reason: "BUDGET_CHECK_DB_ERROR_FAIL_CLOSED",
      currentSpendUsd: 0,
      budgetLimitUsd: 0,
      usagePercent: 0,
    };
    // Cache muito curto (5s) para evitar re-bater o DB a cada mensagem
    budgetCache.set(cacheKey, {
      result: failClosedResult,
      expiresAt: Date.now() + 5_000,
    });
    return failClosedResult;
  }

  // 2. Determine budget limit based on plan
  const plan: PlanKey = await getEffectivePlan(tenantId);
  const budgetLimitUsd = BUDGET_LIMITS[plan] ?? BUDGET_LIMITS.gratuito;

  // 3. Enforce
  const usagePercent = budgetLimitUsd > 0 ? Math.round((currentSpendUsd / budgetLimitUsd) * 100) : 0;
  const overBudget = currentSpendUsd >= budgetLimitUsd;
  const result: {
    allowed: boolean;
    reason?: string;
    currentSpendUsd: number;
    budgetLimitUsd: number;
    usagePercent: number;
  } = overBudget
    ? { allowed: false, reason: "ORÇAMENTO META EXCEDIDO", currentSpendUsd, budgetLimitUsd, usagePercent: 100 }
    : { allowed: true, currentSpendUsd, budgetLimitUsd, usagePercent };

  // Warn when approaching 80% (log but don't block)
  if (!overBudget && usagePercent >= 80 && usagePercent < 100) {
    console.warn(
      `[checkMetaBudget] Tenant ${tenantId}: Meta budget at ${usagePercent}% ($${currentSpendUsd.toFixed(2)} / $${budgetLimitUsd.toFixed(2)})`
    );
  }

  // Store in cache
  budgetCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}

// ─── Cost Savings Estimator ───────────────────────────────────────────────────

const UNBUNDLED_MULTIPLIER = 2.5;

export async function getMetaCostSavings(tenantId: string): Promise<{
  totalSpent: number;
  messagesWithoutBundler: number;
  estimatedWithoutZella: number;
  savedByZella: number;
}> {
  try {
    const { start, end } = getCurrentMonthRange();

    const aggregate = await db.metaCostLog.aggregate({
      _sum: { costUsd: true },
      _count: true,
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
    });

    const totalSpent = aggregate._sum.costUsd ?? 0;
    const actualMessageCount = aggregate._count;

    // Without Zélla's single-shot bundling, each conversation would require
    // ~2.5 messages on average (greeting + follow-up + answer).
    const messagesWithoutBundler = Math.round(actualMessageCount * UNBUNDLED_MULTIPLIER);
    const estimatedWithoutZella = messagesWithoutBundler * META_COST_PER_MSG;
    const savedByZella = Math.max(0, estimatedWithoutZella - totalSpent);

    return {
      totalSpent,
      messagesWithoutBundler,
      estimatedWithoutZella,
      savedByZella,
    };
  } catch (error) {
    console.error("[getMetaCostSavings] Failed to calculate savings:", error);
    return {
      totalSpent: 0,
      messagesWithoutBundler: 0,
      estimatedWithoutZella: 0,
      savedByZella: 0,
    };
  }
}
