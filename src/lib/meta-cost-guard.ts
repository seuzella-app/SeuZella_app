import { db } from '@/lib/db';
import { getEffectivePlan } from '@/lib/plan-resolver';
import { estimateMetaCost, isCustomerServiceWindowOpen as isServiceWindowOpen, getServiceWindowRemainingHours } from '@/lib/meta/meta-rate-card';
import { MetaPricingCategory, normalizeMetaPricingCategory } from '@/lib/meta/meta-types';

// ============================================================================
// ZÉLLA — Meta Cost Guard
// ============================================================================
// Meta aceitou o envio ≠ Meta cobrou.
// pricing.billable do webhook é a autoridade sobre cobrança.
// Rate card sem valor monetário da Meta é somente referência/estimativa.
// IMPORTANTE: costUsd é legado e só recebe valores cuja currency é USD.
// Valores BRL ficam em rate + currency até existir um ledger monetário nativo.
// Nunca aplicar câmbio fixo nem interpretar BRL como USD.
// ============================================================================

const META_COST_ENABLED = (process.env.META_COST_TRACKING_ENABLED ?? process.env.META_COST_ENABLED ?? 'true').toLowerCase() !== 'false';
const LEGACY_META_COST_PER_MSG_USD = Number(process.env.META_COST_PER_SERVICE_MSG || '0.0068');
type MetaMessageType = 'service_reply' | 'marketing_template' | 'utility_template';

interface MetaCostEntry {
  tenantId: string;
  conversationId: string;
  messageId?: string;
  guestId?: string;
  messageType: MetaMessageType;
  intent?: string;
  metadata?: Record<string, unknown>;
  withinServiceWindow?: boolean;
  category?: MetaPricingCategory;
  currency?: string;
}

function mapMessageTypeToCategory(messageType: MetaMessageType, override?: MetaPricingCategory): MetaPricingCategory {
  if (override) return normalizeMetaPricingCategory(override);
  if (messageType === 'utility_template') return 'utility';
  if (messageType === 'marketing_template') return 'marketing';
  return 'service';
}

function isUsd(currency: string | null | undefined): boolean {
  return (currency ?? '').toUpperCase() === 'USD';
}

export async function recordMetaCost(entry: MetaCostEntry): Promise<void> {
  if (!META_COST_ENABLED) return;
  try {
    const category = mapMessageTypeToCategory(entry.messageType, entry.category);
    const withinServiceWindow = entry.withinServiceWindow ?? true;

    if (entry.messageId) {
      const authoritative = await db.metaCostLog.findFirst({
        where: { messageId: entry.messageId, source: 'meta_webhook_pricing' },
        select: { id: true },
      });
      if (authoritative) return;
    }

    const estimate = estimateMetaCost({ market: 'BR', category, withinServiceWindow });
    const amount = estimate?.billable ? estimate.cost : 0;
    const currency = entry.currency ?? estimate?.currency ?? null;
    const rate = estimate?.billable ? estimate.cost : null;

    await db.metaCostLog.create({
      data: {
        tenantId: entry.tenantId,
        conversationId: entry.conversationId,
        messageId: entry.messageId ?? null,
        guestId: entry.guestId ?? null,
        // Legacy field: only USD. BRL is preserved in rate + currency.
        costUsd: isUsd(currency) ? amount : 0,
        messageType: entry.messageType,
        intent: entry.intent ?? null,
        category,
        billable: estimate ? estimate.billable : null,
        currency,
        rate,
        source: 'send_accepted',
        metadata: JSON.stringify({
          estimated: true,
          pricingSource: 'rate_card',
          withinServiceWindow,
          amount,
          amountCurrency: currency,
          ...(estimate === null ? { noRateCardEntry: true } : {}),
          ...(entry.metadata ?? {}),
        }),
      },
    });
  } catch (error) {
    console.error('[meta-cost-guard] Failed to record Meta cost estimate:', error);
  }
}

export interface MetaPricingStatusInput {
  tenantId: string;
  conversationId: string;
  guestId?: string;
  messageId: string;
  billable: boolean;
  category: string;
  pricingModel?: string;
  cost?: number | null;
  currency?: string | null;
  market?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordMetaPricingFromStatus(input: MetaPricingStatusInput): Promise<void> {
  if (!META_COST_ENABLED) return;
  try {
    const category = normalizeMetaPricingCategory(input.category);
    const market = (input.market ?? 'BR').trim().toUpperCase();
    let amount = 0;
    let currency = input.currency ?? null;
    let rate: number | null = null;
    let amountEstimated = false;

    if (input.billable && category !== 'UNKNOWN') {
      if (typeof input.cost === 'number' && Number.isFinite(input.cost) && input.cost >= 0) {
        amount = input.cost;
        rate = input.cost;
      } else {
        const estimate = estimateMetaCost({ market, category, withinServiceWindow: true });
        if (estimate?.billable) {
          amount = estimate.cost;
          rate = estimate.cost;
          currency = currency ?? estimate.currency;
          amountEstimated = true;
        }
      }
    }

    currency = currency ?? 'BRL';
    const existing = await db.metaCostLog.findFirst({
      where: { messageId: input.messageId, tenantId: input.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const metadata = JSON.stringify({
      estimated: amountEstimated,
      pricingSource: 'meta_webhook_pricing',
      pricingValueSource: amountEstimated ? 'rate_card_reference' : 'meta_payload_or_zero',
      pricingModel: input.pricingModel ?? null,
      market,
      amount,
      amountCurrency: currency,
      ...(input.metadata ?? {}),
    });

    const data = {
      category,
      billable: input.billable,
      currency,
      rate,
      source: 'meta_webhook_pricing' as const,
      metadata,
      // Legacy field remains strictly USD. BRL amount is carried by rate/currency.
      costUsd: isUsd(currency) ? amount : 0,
    };

    if (existing) {
      await db.metaCostLog.update({ where: { id: existing.id }, data });
    } else {
      await db.metaCostLog.create({
        data: {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          guestId: input.guestId ?? null,
          messageType: category === 'UNKNOWN' ? 'unknown_category' : `${category}_template`,
          intent: null,
          ...data,
        },
      });
    }
  } catch (error) {
    console.error('[meta-cost-guard] Failed to record authoritative Meta pricing:', error);
  }
}

export async function getMetaCostSummary(tenantId: string, startDate: Date, endDate: Date) {
  try {
    const logs = await db.metaCostLog.findMany({
      where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      select: { costUsd: true, messageType: true, intent: true, currency: true, rate: true, category: true, source: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalByCurrency: Record<string, number> = {};
    let totalUsd = 0;
    let totalBrl = 0;

    // FASE 02B (FRENTE 06 — CRITICAL DATA MODEL ISSUE corrigido):
    // TODOS os agregados agora são POR MOEDA. Antes, bySource/byIntent/
    // authoritativeCost/estimatedCost somavam amounts em moedas distintas
    // (BRL rate + USD costUsd) num único número — matematicamente inválido.
    const bySourceByCurrency: Record<string, Record<string, number>> = {};
    const byIntentByCurrency: Record<string, Record<string, number>> = {};

    for (const log of logs) {
      const currency = (log.currency ?? 'USD').toUpperCase();
      const amount = currency === 'USD' ? log.costUsd : (log.rate ?? 0);
      totalByCurrency[currency] = (totalByCurrency[currency] ?? 0) + amount;
      const sourceBucket = (bySourceByCurrency[log.source] ??= {});
      sourceBucket[currency] = (sourceBucket[currency] ?? 0) + amount;
      if (currency === 'BRL') totalBrl += amount;
      else if (currency === 'USD') totalUsd += amount;
    }

    for (const log of logs) {
      const key = log.intent || 'desconhecido';
      const currency = (log.currency ?? 'USD').toUpperCase();
      const amount = currency === 'USD' ? log.costUsd : (log.rate ?? 0);
      const intentBucket = (byIntentByCurrency[key] ??= {});
      intentBucket[currency] = (intentBucket[currency] ?? 0) + amount;
    }

    return {
      totalUsd,
      totalBrl,
      totalByCurrency,
      bySourceByCurrency,
      byIntentByCurrency,
      authoritativeCostByCurrency: bySourceByCurrency.meta_webhook_pricing ?? {},
      estimatedCostByCurrency: bySourceByCurrency.send_accepted ?? {},
      currencyNote:
        'aggregates_are_per_currency_no_fixed_fx_never_sum_across_currencies' as const,
      messageCount: logs.length,
      period: { start: startDate, end: endDate },
    };
  } catch (error) {
    console.error('[meta-cost-guard] Failed to get Meta Cost Summary:', error);
    return {
      totalUsd: 0,
      totalBrl: 0,
      totalByCurrency: {},
      bySourceByCurrency: {},
      byIntentByCurrency: {},
      authoritativeCostByCurrency: {},
      estimatedCostByCurrency: {},
      currencyNote:
        'aggregates_are_per_currency_no_fixed_fx_never_sum_across_currencies' as const,
      messageCount: 0,
      period: { start: startDate, end: endDate },
    };
  }
}

const BUDGET_OVERRIDE = process.env.META_BUDGET_ENFORCEMENT_DISABLED === 'true';
type PlanKey = 'gratuito' | 'lite' | 'pro' | 'max' | 'parceiro';
const BUDGET_LIMITS: Record<PlanKey, number> = {
  gratuito: Number(process.env.META_BUDGET_GRATUITO_USD ?? '3.40'),
  lite: Number(process.env.META_BUDGET_LITE_USD ?? '12.00'),
  pro: Number(process.env.META_BUDGET_PRO_USD ?? '34.00'),
  max: Number(process.env.META_BUDGET_MAX_USD ?? '68.00'),
  parceiro: Number(process.env.META_BUDGET_PARCEIRO_USD ?? '34.00'),
};

// FASE 02B (FRENTE 07): budget NATIVO em BRL (o rate card BR é 100% BRL —
// P1-3: antes o gasto BR não era contado em lugar nenhum do enforcement).
// NÃO há conversão automática USD↔BRL (nenhum FX inventado). O budget BRL
// só fica ATIVO quando configurado via env; enquanto ausente, o gasto BRL é
// REPORTADO (currentSpendByCurrency) mas NÃO enforced — limitação explícita
// registrada no resultado, nunca enforcement incorreto silencioso.
const BRL_BUDGET_ENV: Record<PlanKey, string> = {
  gratuito: 'META_BUDGET_GRATUITO_BRL',
  lite: 'META_BUDGET_LITE_BRL',
  pro: 'META_BUDGET_PRO_BRL',
  max: 'META_BUDGET_MAX_BRL',
  parceiro: 'META_BUDGET_PARCEIRO_BRL',
};

function resolveBrlBudgetLimit(plan: PlanKey): number | null {
  const raw = process.env[BRL_BUDGET_ENV[plan]];
  if (raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

interface BudgetResult {
  allowed: boolean;
  reason?: string;
  currentSpendUsd: number;
  budgetLimitUsd: number;
  usagePercent: number;
  budgetCurrency: 'USD';
  // FASE 02B (FRENTE 07): visibilidade multi-moeda explícita
  currentSpendByCurrency: Record<string, number>;
  budgetLimitsByCurrency: Record<string, number>;
  brlBudgetConfigured: boolean;
}

const budgetCache = new Map<string, { result: BudgetResult; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function classifyMessageType(intent?: string): MetaMessageType {
  if (!intent) return 'service_reply';
  if (['checkin_checkout', 'agradecimento', 'opt_out_confirmation', 'cota_excedida'].includes(intent)) return 'utility_template';
  return 'service_reply';
}

export function isWithinServiceWindow(lastGuestMessageAt?: Date | null): boolean {
  return isServiceWindowOpen(lastGuestMessageAt);
}

export function getServiceWindowRemaining(lastGuestMessageAt?: Date | null): number {
  return getServiceWindowRemainingHours(lastGuestMessageAt);
}

/** Budget multi-moeda: USD nativo sempre; BRL nativo quando configurado via env. */
export async function checkMetaBudget(tenantId: string): Promise<BudgetResult> {
  if (BUDGET_OVERRIDE) return { allowed: true, currentSpendUsd: 0, budgetLimitUsd: Infinity, usagePercent: 0, budgetCurrency: 'USD', currentSpendByCurrency: { USD: 0, BRL: 0 }, budgetLimitsByCurrency: {}, brlBudgetConfigured: false };

  const cacheKey = `${tenantId}:${new Date().toISOString().slice(0, 7)}`;
  const cached = budgetCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const { start, end } = getCurrentMonthRange();
  try {
    const logs = await db.metaCostLog.findMany({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      select: { costUsd: true, rate: true, currency: true },
    });
    // Gasto por moeda — NUNCA somado entre moedas (FRENTE 06/07).
    let currentSpendUsd = 0;
    let currentSpendBrl = 0;
    for (const log of logs) {
      const currency = (log.currency ?? 'USD').toUpperCase();
      if (currency === 'USD') currentSpendUsd += log.costUsd;
      else if (currency === 'BRL') currentSpendBrl += log.rate ?? 0;
    }
    const plan: PlanKey = await getEffectivePlan(tenantId);
    const budgetLimitUsd = BUDGET_LIMITS[plan] ?? BUDGET_LIMITS.gratuito;
    const brlLimit = resolveBrlBudgetLimit(plan);
    const brlBudgetConfigured = brlLimit !== null;
    const budgetLimitsByCurrency: Record<string, number> = { USD: budgetLimitUsd };
    if (brlLimit !== null) budgetLimitsByCurrency.BRL = brlLimit;

    const usdOver = currentSpendUsd >= budgetLimitUsd;
    const brlOver = brlLimit !== null && currentSpendBrl >= brlLimit;
    const usagePercent = Math.max(
      budgetLimitUsd > 0 ? Math.round((currentSpendUsd / budgetLimitUsd) * 100) : 0,
      brlLimit && brlLimit > 0 ? Math.round((currentSpendBrl / brlLimit) * 100) : 0
    );
    const result: BudgetResult = usdOver || brlOver
      ? {
          allowed: false,
          reason: usdOver ? 'ORÇAMENTO META USD EXCEDIDO' : 'ORÇAMENTO META BRL EXCEDIDO',
          currentSpendUsd,
          budgetLimitUsd,
          usagePercent: 100,
          budgetCurrency: 'USD',
          currentSpendByCurrency: { USD: currentSpendUsd, BRL: currentSpendBrl },
          budgetLimitsByCurrency,
          brlBudgetConfigured,
        }
      : {
          allowed: true,
          currentSpendUsd,
          budgetLimitUsd,
          usagePercent,
          budgetCurrency: 'USD',
          currentSpendByCurrency: { USD: currentSpendUsd, BRL: currentSpendBrl },
          budgetLimitsByCurrency,
          brlBudgetConfigured,
        };
    budgetCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.error('[checkMetaBudget] DB error — fail-closed:', error);
    const result: BudgetResult = { allowed: false, reason: 'BUDGET_CHECK_DB_ERROR_FAIL_CLOSED', currentSpendUsd: 0, budgetLimitUsd: 0, usagePercent: 0, budgetCurrency: 'USD', currentSpendByCurrency: { USD: 0, BRL: 0 }, budgetLimitsByCurrency: {}, brlBudgetConfigured: false };
    budgetCache.set(cacheKey, { result, expiresAt: Date.now() + 5_000 });
    return result;
  }
}

// NÃO é verdade financeira: estimativa de cenário — este multiplicador é
// somente uma hipótese para comparar cenários de bundling. Nunca deve ser
// usado como fatura Meta.
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
    // Savings legacy uses USD only; never mix BRL into a USD scenario.
    const [authoritative, estimated, allRows] = await Promise.all([
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, where: { tenantId, createdAt: { gte: start, lte: end }, source: 'meta_webhook_pricing', currency: 'USD' } }),
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, where: { tenantId, createdAt: { gte: start, lte: end }, source: 'send_accepted', currency: 'USD' } }),
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, _count: true, where: { tenantId, createdAt: { gte: start, lte: end }, currency: 'USD' } }),
    ]);
    const actualCost = authoritative._sum.costUsd ?? 0;
    const estimatedCost = estimated._sum.costUsd ?? 0;
    const totalSpent = allRows._sum.costUsd ?? 0;
    const messagesWithoutBundler = Math.round(allRows._count * UNBUNDLED_MULTIPLIER);
    const estimatedWithoutZella = messagesWithoutBundler * LEGACY_META_COST_PER_MSG_USD;
    const savedByZella = Math.max(0, estimatedWithoutZella - totalSpent);
    return {
      totalSpent,
      actualCost,
      estimatedCost,
      estimated: true,
      costSourceNote: 'USD-only savings estimate; BRL records are excluded until a native multi-currency ledger exists.',
      messagesWithoutBundler,
      estimatedWithoutZella,
      savedByZella,
    };
  } catch (error) {
    console.error('[getMetaCostSavings] Failed:', error);
    return { totalSpent: 0, actualCost: 0, estimatedCost: 0, estimated: true, costSourceNote: 'Meta cost unavailable', messagesWithoutBundler: 0, estimatedWithoutZella: 0, savedByZella: 0 };
  }
}
