import { db } from '@/lib/db';
import { getEffectivePlan } from '@/lib/plan-resolver';
import {
  estimateMetaCost,
  isCustomerServiceWindowOpen as isServiceWindowOpen,
  getServiceWindowRemainingHours,
} from '@/lib/meta/meta-rate-card';
import { MetaPricingCategory, normalizeMetaPricingCategory } from '@/lib/meta/meta-types';

// ==============================================================================
// ZÉLLA — Meta Cost Guard
// ==============================================================================
// PRINCÍPIOS:
// 1. Meta aceitou o envio ≠ Meta cobrou.
// 2. `pricing.billable` do webhook é a autoridade sobre cobrança.
// 3. Se o webhook não trouxer valor monetário, qualquer valor obtido do rate
//    card é ESTIMATIVA e permanece explicitamente marcado como tal.
// 4. `currency` acompanha cada registro. Não existe câmbio fixo USD→BRL.
// 5. `costUsd` é um campo legado do schema e, por compatibilidade, recebe o
//    valor monetário registrado na moeda da linha. Consumidores novos devem
//    usar `currency` + `rate`; não interpretar `costUsd` como USD quando
//    currency != USD.
// 6. UNKNOWN nunca recebe preço por suposição.
// ==============================================================================

const META_COST_ENABLED =
  (process.env.META_COST_TRACKING_ENABLED ?? process.env.META_COST_ENABLED ?? 'true').toLowerCase() !== 'false';

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
  switch (messageType) {
    case 'utility_template':
      return 'utility';
    case 'marketing_template':
      return 'marketing';
    default:
      return 'service';
  }
}

/** Estimativa no aceite do envio. Não representa faturamento da Meta. */
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

    const estimate = estimateMetaCost({
      market: 'BR',
      category,
      withinServiceWindow,
    });

    const cost = estimate?.billable ? estimate.cost : 0;
    const currency = entry.currency ?? estimate?.currency ?? 'BRL';
    const rate = estimate?.billable ? estimate.cost : null;

    await db.metaCostLog.create({
      data: {
        tenantId: entry.tenantId,
        conversationId: entry.conversationId,
        messageId: entry.messageId ?? null,
        guestId: entry.guestId ?? null,
        // Compatibilidade com schema legado: o valor permanece acompanhado de
        // currency. Não tratar esta coluna como USD quando currency != USD.
        costUsd: cost,
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
  /** Alguns payloads/integrações podem fornecer valor monetário; se ausente,
   * usamos apenas rate card como ESTIMATIVA. */
  cost?: number | null;
  currency?: string | null;
  market?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra a evidência de billing recebida da Meta.
 *
 * IMPORTANTE: status.billable=true é authoritative sobre o fato de cobrança,
 * mas não necessariamente contém o valor monetário. Nesse caso o valor
 * persistido via rate card continua `estimated=true`.
 */
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
        amountEstimated = false;
      } else {
        const estimate = estimateMetaCost({
          market,
          category,
          withinServiceWindow: true,
        });
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
      ...(input.metadata ?? {}),
    });

    const data = {
      category,
      billable: input.billable,
      currency,
      rate,
      source: 'meta_webhook_pricing' as const,
      metadata,
      costUsd: amount,
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
      select: { costUsd: true, messageType: true, intent: true, currency: true, category: true, source: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalByCurrency: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalUsd = 0;
    let totalBrl = 0;

    for (const log of logs) {
      const currency = (log.currency ?? 'USD').toUpperCase();
      totalByCurrency[currency] = (totalByCurrency[currency] ?? 0) + log.costUsd;
      bySource[log.source] = (bySource[log.source] ?? 0) + log.costUsd;
      if (currency === 'BRL') totalBrl += log.costUsd;
      else if (currency === 'USD') totalUsd += log.costUsd;
    }

    const byIntent = logs.reduce((acc, log) => {
      const key = log.intent || 'desconhecido';
      acc[key] = (acc[key] || 0) + log.costUsd;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsd,
      totalBrl,
      totalByCurrency,
      bySource,
      authoritativeCost: bySource.meta_webhook_pricing ?? 0,
      estimatedCost: bySource.send_accepted ?? 0,
      currencyNote: 'totals_are_per_recorded_currency_no_fixed_fx' as const,
      messageCount: logs.length,
      avgCostPerMsg: logs.length ? (totalUsd + totalBrl) / logs.length : 0,
      byIntent,
      period: { start: startDate, end: endDate },
    };
  } catch (error) {
    console.error('[meta-cost-guard] Failed to get Meta Cost Summary:', error);
    return {
      totalUsd: 0,
      totalBrl: 0,
      totalByCurrency: {},
      bySource: {},
      authoritativeCost: 0,
      estimatedCost: 0,
      currencyNote: 'totals_are_per_recorded_currency_no_fixed_fx' as const,
      messageCount: 0,
      avgCostPerMsg: 0,
      byIntent: {},
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

interface BudgetResult {
  allowed: boolean;
  reason?: string;
  currentSpendUsd: number;
  budgetLimitUsd: number;
  usagePercent: number;
  budgetCurrency: 'USD';
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
  if (['checkin_checkout', 'agradecimento', 'opt_out_confirmation', 'cota_excedida'].includes(intent)) {
    return 'utility_template';
  }
  return 'service_reply';
}

export function isWithinServiceWindow(lastGuestMessageAt?: Date | null): boolean {
  return isServiceWindowOpen(lastGuestMessageAt);
}

export function getServiceWindowRemaining(lastGuestMessageAt?: Date | null): number {
  return getServiceWindowRemainingHours(lastGuestMessageAt);
}

/**
 * O budget legado é em USD. Registros em BRL NÃO são convertidos nem somados
 * ao orçamento USD. Isso evita bloquear/autorizar por um câmbio inventado.
 * Até existir budget por moeda no produto, BRL fica em observabilidade.
 */
export async function checkMetaBudget(tenantId: string): Promise<BudgetResult> {
  if (BUDGET_OVERRIDE) {
    return { allowed: true, currentSpendUsd: 0, budgetLimitUsd: Infinity, usagePercent: 0, budgetCurrency: 'USD' };
  }

  const cacheKey = `${tenantId}:${new Date().toISOString().slice(0, 7)}`;
  const cached = budgetCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const { start, end } = getCurrentMonthRange();
  try {
    const logs = await db.metaCostLog.findMany({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      select: { costUsd: true, currency: true },
    });

    const hasNonUsdBilling = logs.some((log) => (log.currency ?? 'USD').toUpperCase() !== 'USD' && log.costUsd > 0);
    const currentSpendUsd = logs
      .filter((log) => (log.currency ?? 'USD').toUpperCase() === 'USD')
      .reduce((sum, log) => sum + log.costUsd, 0);

    const plan: PlanKey = await getEffectivePlan(tenantId);
    const budgetLimitUsd = BUDGET_LIMITS[plan] ?? BUDGET_LIMITS.gratuito;

    // Não bloquear BRL com um limite USD. Quando a operação migrar o budget
    // para moeda nativa, este guard deverá receber um budget por currency.
    if (hasNonUsdBilling) {
      const result: BudgetResult = {
        allowed: true,
        reason: 'BUDGET_USD_NOT_APPLIED_TO_NON_USD_BILLING',
        currentSpendUsd,
        budgetLimitUsd,
        usagePercent: budgetLimitUsd > 0 ? Math.round((currentSpendUsd / budgetLimitUsd) * 100) : 0,
        budgetCurrency: 'USD',
      };
      budgetCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    const usagePercent = budgetLimitUsd > 0 ? Math.round((currentSpendUsd / budgetLimitUsd) * 100) : 0;
    const overBudget = currentSpendUsd >= budgetLimitUsd;
    const result: BudgetResult = overBudget
      ? { allowed: false, reason: 'ORÇAMENTO META USD EXCEDIDO', currentSpendUsd, budgetLimitUsd, usagePercent: 100, budgetCurrency: 'USD' }
      : { allowed: true, currentSpendUsd, budgetLimitUsd, usagePercent, budgetCurrency: 'USD' };

    budgetCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.error('[checkMetaBudget] DB error — fail-closed:', error);
    const result: BudgetResult = {
      allowed: false,
      reason: 'BUDGET_CHECK_DB_ERROR_FAIL_CLOSED',
      currentSpendUsd: 0,
      budgetLimitUsd: 0,
      usagePercent: 0,
      budgetCurrency: 'USD',
    };
    budgetCache.set(cacheKey, { result, expiresAt: Date.now() + 5_000 });
    return result;
  }
}

// ─── Savings estimator ───────────────────────────────────────────────────────

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
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, where: { tenantId, createdAt: { gte: start, lte: end }, source: 'meta_webhook_pricing' } }),
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, where: { tenantId, createdAt: { gte: start, lte: end }, source: 'send_accepted' } }),
      db.metaCostLog.aggregate({ _sum: { costUsd: true }, _count: true, where: { tenantId, createdAt: { gte: start, lte: end } } }),
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
      costSourceNote: 'actualCost = authoritative billable records; value may be rate-card estimated when Meta status has no monetary amount. Use currency alongside every value.',
      messagesWithoutBundler,
      estimatedWithoutZella,
      savedByZella,
    };
  } catch (error) {
    console.error('[getMetaCostSavings] Failed:', error);
    return {
      totalSpent: 0,
      actualCost: 0,
      estimatedCost: 0,
      estimated: true,
      costSourceNote: 'Meta cost unavailable',
      messagesWithoutBundler: 0,
      estimatedWithoutZella: 0,
      savedByZella: 0,
    };
  }
}
