import { db } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plan-resolver";
import {
  estimateMetaCost,
  isCustomerServiceWindowOpen as isServiceWindowOpen,
  getServiceWindowRemainingHours,
} from "@/lib/meta/meta-rate-card";
import { MetaPricingCategory, normalizeMetaPricingCategory } from "@/lib/meta/meta-types";

// ==============================================================================
// ZÉLLA — Meta Cost Guard (CORRIGIDO — Meta Pricing 2026)
// ==============================================================================
// CORREÇÃO CIRÚRGICA (onda Meta Foundation — Fase 6/7/8/19):
//
//  1. "Meta aceitou o envio" ≠ "Meta cobrou". O evento AUTHORITATIVE de
//     billing é o status da Meta com pricing.billable=true, registrado via
//     recordMetaPricingFromStatus() (source='meta_webhook_pricing').
//     registros criados no aceite do envio são ESTIMATIVAS
//     (source='send_accepted', estimated=true) — nunca mais tratados como
//     custo real.
//  2. Custos derivados de RATE CARD configurável (meta-rate-card.ts), não de
//     META_COST_PER_MSG × multiplicadores inventados (ex.: 0.5 para utility).
//  3. Categoria UNKNOWN: registrada, não descartada, NUNCA precificada.
//  4. Sem câmbio fixo USD→BRL: a moeda reportada pela Meta é registrada junto
//     com o custo (campo currency). O campo legado costUsd mantém o valor na
//     moeda registrada (nome preservado para compatibilidade de schema/calls).
//  5. Janela de 24h ≠ mensagem grátis (Fase 8). isCustomerServiceWindowOpen()
//     é regra de ENVIO; isMetaMessageBillable() é regra de COBRANÇA.
//  6. Deduplicação: se um custo authoritative já existe para o messageId, a
//     estimativa não é criada; quando o status chega, a estimativa é
//     PROMOVIDA a authoritative (update in place) — orçamento nunca conta
//     duas vezes.
// ==============================================================================

// Flag única de capacidade (reutiliza META_COST_ENABLED como alias legado —
// nunca duas flags para a mesma capacidade).
const META_COST_ENABLED =
  (process.env.META_COST_TRACKING_ENABLED ?? process.env.META_COST_ENABLED ?? "true")
    .toLowerCase() !== "false";

// Mantido apenas como fallback documentado para UNKNOWN-free fluxos legados.
// NÃO é mais a fonte principal de custo (rate card é).
const LEGACY_META_COST_PER_MSG = parseFloat(
  process.env.META_COST_PER_SERVICE_MSG || "0.0068"
);

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
  /** Override explícito da categoria Meta (quando conhecida a montante). */
  category?: MetaPricingCategory;
  /** Moeda da WABA (ex.: 'USD' | 'BRL'). Default 'USD'. */
  currency?: string;
}

/** Mapeia o messageType legado para a categoria oficial Meta. */
function mapMessageTypeToCategory(
  messageType: MetaCostEntry["messageType"],
  override?: MetaPricingCategory
): MetaPricingCategory {
  if (override) return normalizeMetaPricingCategory(override);
  switch (messageType) {
    case "utility_template":
      return "utility";
    case "marketing_template":
      return "marketing";
    case "service_reply":
    default:
      return "service";
  }
}

/**
 * Registra ESTIMATIVA de custo no aceite do envio (source='send_accepted').
 *
 * ATENÇÃO (Fase 6): isto NÃO é o custo real. O custo real vem do webhook de
 * status da Meta (recordMetaPricingFromStatus). Esta função existe para
 * observabilidade imediata e enforcement de orçamento em tempo real.
 */
export async function recordMetaCost(entry: MetaCostEntry): Promise<void> {
  if (!META_COST_ENABLED) return;

  try {
    const category = mapMessageTypeToCategory(entry.messageType, entry.category);
    const withinServiceWindow = entry.withinServiceWindow ?? true;
    const currency = entry.currency ?? "USD";

    // Dedupe: se já existe custo AUTHORITATIVE para este messageId, não criar
    // estimativa duplicada (o orçamento nunca deve contar duas vezes).
    if (entry.messageId) {
      const authoritative = await db.metaCostLog.findFirst({
        where: { messageId: entry.messageId, source: "meta_webhook_pricing" },
        select: { id: true },
      });
      if (authoritative) return;
    }

    const estimate = estimateMetaCost({
      market: "BR",
      category,
      withinServiceWindow,
    });

    let cost = 0;
    let rate: number | null = null;

    if (category === "UNKNOWN") {
      // Registrar sem inventar preço (Fase 6).
      cost = 0;
      rate = null;
    } else if (estimate && estimate.billable) {
      cost = estimate.cost;
      rate = estimate.cost;
    }

    await db.metaCostLog.create({
      data: {
        tenantId: entry.tenantId,
        conversationId: entry.conversationId,
        messageId: entry.messageId || null,
        guestId: entry.guestId || null,
        costUsd: cost,
        messageType: entry.messageType,
        intent: entry.intent || null,
        category,
        billable: category === "UNKNOWN" ? null : (estimate?.billable ?? false),
        currency,
        rate,
        source: "send_accepted",
        metadata: JSON.stringify({
          estimated: true,
          pricingSource: "rate_card",
          withinServiceWindow,
          ...(estimate === null && category !== "UNKNOWN" ? { noRateCardEntry: true } : {}),
          ...(entry.metadata ?? {}),
        }),
      },
    });
  } catch (error) {
    console.error("Failed to record Meta Cost Log:", error);
  }
}

export interface MetaPricingStatusInput {
  tenantId: string;
  conversationId: string;
  guestId?: string;
  /** wamid da mensagem enviada (vindo do status da Meta). */
  messageId: string;
  /** pricing.billable do status — autoridade de cobrança. */
  billable: boolean;
  /** pricing.category do status (pode ser categoria desconhecida). */
  category: string;
  pricingModel?: string;
  /** Custo reportado pela Meta (quando presente no payload). */
  cost?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * REGISTRA O CUSTO AUTHORITATIVE a partir do STATUS da Meta (Fase 6).
 *
 * Regras:
 *  - billable=false → registra com custo 0 (observabilidade, sem cobrança).
 *  - category desconhecida → registra como UNKNOWN, sem preço inventado.
 *  - Se já existe estimativa (send_accepted) para o messageId, ela é
 *    promovida a authoritative (update in place — sem dupla contagem).
 *  - custo = pricing.cost da Meta quando presente; senão rate card.
 */
export async function recordMetaPricingFromStatus(input: MetaPricingStatusInput): Promise<void> {
  if (!META_COST_ENABLED) return;

  try {
    const category = normalizeMetaPricingCategory(input.category);
    const currency = input.currency ?? "USD";

    let cost = 0;
    let rate: number | null = null;

    if (input.billable && category !== "UNKNOWN") {
      if (typeof input.cost === "number" && Number.isFinite(input.cost) && input.cost >= 0) {
        // Custo reportado pela Meta — authoritative.
        cost = input.cost;
        rate = input.cost;
      } else {
        const estimate = estimateMetaCost({
          market: "BR",
          category,
          withinServiceWindow: true,
        });
        if (estimate) {
          cost = estimate.cost;
          rate = estimate.cost;
        }
      }
    }

    const data = {
      category,
      billable: input.billable,
      currency,
      rate,
      source: "meta_webhook_pricing" as const,
      metadata: JSON.stringify({
        estimated: false,
        pricingSource: "meta_webhook_pricing",
        pricingModel: input.pricingModel ?? null,
        ...(input.metadata ?? {}),
      }),
    };

    const existing = await db.metaCostLog.findFirst({
      where: { messageId: input.messageId, tenantId: input.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, source: true, costUsd: true },
    });

    if (existing) {
      // Promove estimativa a authoritative (não cria segunda linha).
      await db.metaCostLog.update({
        where: { id: existing.id },
        data: { ...data, costUsd: cost },
      });
    } else {
      await db.metaCostLog.create({
        data: {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          guestId: input.guestId ?? null,
          costUsd: cost,
          messageType: category === "UNKNOWN" ? "unknown_category" : `${category}_template`,
          intent: null,
          ...data,
        },
      });
    }
  } catch (error) {
    console.error("Failed to record authoritative Meta pricing:", error);
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
        currency: true,
        category: true,
        source: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // SEM câmbio fixo: totais por moeda, na moeda registrada.
    const totalByCurrency: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalUsd = 0; // rows legadas (sem currency) + currency=USD
    let totalBrl = 0; // apenas currency=BRL (sem conversão inventada)

    for (const l of logs) {
      const cur = (l.currency ?? "USD").toUpperCase();
      totalByCurrency[cur] = (totalByCurrency[cur] ?? 0) + l.costUsd;
      bySource[l.source] = (bySource[l.source] ?? 0) + l.costUsd;
      if (cur === "BRL") totalBrl += l.costUsd;
      else totalUsd += l.costUsd;
    }

    const byIntent = logs.reduce((acc, l) => {
      const key = l.intent || "desconhecido";
      acc[key] = (acc[key] || 0) + l.costUsd;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsd,
      totalBrl,
      totalByCurrency,
      bySource,
      authoritativeCost: bySource["meta_webhook_pricing"] ?? 0,
      estimatedCost: bySource["send_accepted"] ?? 0,
      /** Totais são por moeda registrada — nunca misturadas por câmbio fixo. */
      currencyNote: "totals_are_per_recorded_currency_no_fixed_fx" as const,
      messageCount: logs.length,
      avgCostPerMsg: logs.length > 0 ? (totalUsd + totalBrl) / logs.length : 0,
      byIntent,
      period: { start: startDate, end: endDate },
    };
  } catch (error) {
    console.error("Failed to get Meta Cost Summary:", error);
    return {
      totalUsd: 0,
      totalBrl: 0,
      totalByCurrency: {},
      bySource: {},
      authoritativeCost: 0,
      estimatedCost: 0,
      currencyNote: "totals_are_per_recorded_currency_no_fixed_fx" as const,
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
 * (Mantido para compatibilidade — NÃO decide preço. O preço vem do rate card
 * + pricing.billable do status da Meta.)
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
 * Janela de atendimento de 24h — regra de ENVIO (Fase 8).
 * NÃO usar como sinônimo de "mensagem grátis": para cobrança use
 * isMetaMessageBillable() em meta-rate-card.ts.
 */
export function isWithinServiceWindow(lastGuestMessageAt?: Date | null): boolean {
  return isServiceWindowOpen(lastGuestMessageAt);
}

/**
 * Returns remaining hours in the 24h service window, or 0 if closed.
 */
export function getServiceWindowRemaining(lastGuestMessageAt?: Date | null): number {
  return getServiceWindowRemainingHours(lastGuestMessageAt);
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

// ─── Cost Savings Estimator (Fase 19 — CORRIGIDO) ────────────────────────────

/**
 * MULTIPLICADOR DE ESTIMATIVA — NÃO é verdade financeira (Fase 19).
 * Sem o bundling single-shot do Zélla, uma conversa exigiria ~2.5 mensagens.
 * Todo retorno desta função é ESTIMATIVA (estimated=true), exceto
 * actualCost, que soma apenas registros authoritative da Meta
 * (source='meta_webhook_pricing').
 */
const UNBUNDLED_MULTIPLIER = 2.5;

export async function getMetaCostSavings(tenantId: string): Promise<{
  totalSpent: number;
  actualCost: number;
  estimatedCost: number;
  estimated: true;
  costSourceNote: string;
  messagesWithoutBundler: number;
  estimatedWithoutZella: number;
  savedByZella: number;
}> {
  try {
    const { start, end } = getCurrentMonthRange();

    const [authoritative, estimated, allRows] = await Promise.all([
      db.metaCostLog.aggregate({
        _sum: { costUsd: true },
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          source: "meta_webhook_pricing",
        },
      }),
      db.metaCostLog.aggregate({
        _sum: { costUsd: true },
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          source: "send_accepted",
        },
      }),
      db.metaCostLog.aggregate({
        _sum: { costUsd: true },
        _count: true,
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    const actualCost = authoritative._sum.costUsd ?? 0;
    const estimatedCost = estimated._sum.costUsd ?? 0;
    const totalSpent = allRows._sum.costUsd ?? 0;
    const actualMessageCount = allRows._count;

    // ESTIMATIVA (Fase 19): marcada como estimated — nunca apresentada como
    // custo real da Meta.
    const messagesWithoutBundler = Math.round(actualMessageCount * UNBUNDLED_MULTIPLIER);
    const estimatedWithoutZella = messagesWithoutBundler * LEGACY_META_COST_PER_MSG;
    const savedByZella = Math.max(0, estimatedWithoutZella - totalSpent);

    return {
      totalSpent,
      actualCost,
      estimatedCost,
      estimated: true,
      costSourceNote:
        "actualCost = source meta_webhook_pricing (authoritative); estimatedCost = source send_accepted (estimativa)",
      messagesWithoutBundler,
      estimatedWithoutZella,
      savedByZella,
    };
  } catch (error) {
    console.error("[getMetaCostSavings] Failed to calculate savings:", error);
    return {
      totalSpent: 0,
      actualCost: 0,
      estimatedCost: 0,
      estimated: true,
      costSourceNote:
        "actualCost = source meta_webhook_pricing (authoritative); estimatedCost = source send_accepted (estimativa)",
      messagesWithoutBundler: 0,
      estimatedWithoutZella: 0,
      savedByZella: 0,
    };
  }
}
