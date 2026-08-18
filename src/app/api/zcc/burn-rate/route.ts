import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ═══════════════════════════════════════════════════════════════
// ZCC BURN RATE — Taxímetro Global de custos
//
// Conexões Prisma:
//  - CostLog → custos LLM por provider/model (agregado diário/mensal)
//  - BudgetGuardState → spend diário/mensal vs budget
//  - Tenant → distribuição de custo por tenant
//  - Transaction → MRR real receita (USD convertido)
//
// Em mock mode (sem DB): retorna valores estáticos
// ═══════════════════════════════════════════════════════════════

// In-memory store for mock mode (resets on server restart)
const burnRateStore = {
  totalEvents: 0,
  totalMessagesProcessed: 0,
  totalTariffsUsed: 0,
  totalTariffsSaved: 0,
  totalMetaCostSpent: 0,
  totalMetaCostSaved: 0,
  lastEventAt: null as string | null,
  byNiche: {
    pousada: { events: 0, messages: 0, tariffsUsed: 0, saved: 0 },
    airbnb: { events: 0, messages: 0, tariffsUsed: 0, saved: 0 },
  },
};

interface BurnRateEvent {
  event: string;
  messagesCount: number;
  tariffsUsed: number;
  tariffsSaved: number;
  metaCostSpent: number;
  metaCostSaved: number;
  economyPercent: number;
  niche: 'pousada' | 'airbnb';
  simulatorSessionId?: string;
}

// ── Helpers ────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const fmtUSD = (v: number) =>
  v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── POST — Record telemetry event ──────────────────────────────

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  let body: BurnRateEvent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Corpo da requisição inválido.' },
      { status: 400 }
    );
  }

  const {
    event,
    messagesCount,
    tariffsUsed,
    tariffsSaved,
    metaCostSpent,
    metaCostSaved,
    niche,
  } = body;

  if (!event || messagesCount === undefined) {
    return NextResponse.json(
      { error: 'MISSING_FIELDS', message: 'Campos obrigatórios: event, messagesCount.' },
      { status: 400 }
    );
  }

  burnRateStore.totalEvents += 1;
  burnRateStore.totalMessagesProcessed += messagesCount || 0;
  burnRateStore.totalTariffsUsed += tariffsUsed || 0;
  burnRateStore.totalTariffsSaved += tariffsSaved || 0;
  burnRateStore.totalMetaCostSpent += metaCostSpent || 0;
  burnRateStore.totalMetaCostSaved += metaCostSaved || 0;
  burnRateStore.lastEventAt = new Date().toISOString();

  const nicheKey = niche === 'airbnb' ? 'airbnb' : 'pousada';
  burnRateStore.byNiche[nicheKey].events += 1;
  burnRateStore.byNiche[nicheKey].messages += messagesCount || 0;
  burnRateStore.byNiche[nicheKey].tariffsUsed += tariffsUsed || 0;
  burnRateStore.byNiche[nicheKey].saved += tariffsSaved || 0;

  return NextResponse.json({
    success: true,
    data: {
      eventRecorded: event,
      globalTotals: {
        totalEvents: burnRateStore.totalEvents,
        totalMessagesProcessed: burnRateStore.totalMessagesProcessed,
        totalTariffsUsed: burnRateStore.totalTariffsUsed,
        totalTariffsSaved: burnRateStore.totalTariffsSaved,
        totalMetaCostSpent: Math.round(burnRateStore.totalMetaCostSpent * 10000) / 10000,
        totalMetaCostSaved: Math.round(burnRateStore.totalMetaCostSaved * 10000) / 10000,
        globalEconomyPercent:
          burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved > 0
            ? Math.round(
                (burnRateStore.totalTariffsSaved /
                  (burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved)) *
                  100
              )
            : 0,
      },
      byNiche: burnRateStore.byNiche,
      lastEventAt: burnRateStore.lastEventAt,
    },
  });
}

// ── GET — Read current burn rate stats ─────────────────────────
//
// Resposta completa para BurnRatePanel:
//   - costItems: array com {id, label, dailyUsd, monthlyUsd, detail, icon, accent}
//   - tenantCosts: array com {id, name, niche, monthlyUsd, share}
//   - monthTrend: 12 meses de custo
//   - totals: daily, monthly, mrrUsd, netMonthly, runwayMonths
//   - budgetGuard: state atual

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    return NextResponse.json({
      success: true,
      data: buildMockBurnPayload(),
      meta: { source: 'demo' },
    });
  }

  try {
    // ── 1. CostLog: agrega custos LLM por provider ──────────────
    const todayStart = startOfDay();
    const monthStart = startOfMonth();

    let dailyLlmCost = 0;
    let monthlyLlmCost = 0;
    let llmCostByProvider: Array<{
      provider: string;
      model: string;
      dailyUsd: number;
      monthlyUsd: number;
      inputTokens: number;
      outputTokens: number;
      cacheHitRate: number;
    }> = [];

    try {
      const dailyAgg = await db.costLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: {
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true },
      });

      const monthlyAgg = await db.costLog.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: {
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true },
      });

      dailyLlmCost = dailyAgg._sum.costUsd ?? 0;
      monthlyLlmCost = monthlyAgg._sum.costUsd ?? 0;

      // Agrega por provider
      const providerAgg = await db.costLog.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: monthStart } },
        _sum: {
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true, cacheHit: true },
      });

      // Cache hit rate precisa de uma query separada
      const cacheHitsByProvider: Record<string, number> = {};
      const cacheMissesByProvider: Record<string, number> = {};
      for (const item of providerAgg) {
        try {
          const hits = await db.costLog.count({
            where: {
              provider: item.provider,
              createdAt: { gte: monthStart },
              cacheHit: true,
            },
          });
          const total = item._count.id;
          cacheHitsByProvider[`${item.provider}/${item.model}`] = hits;
          cacheMissesByProvider[`${item.provider}/${item.model}`] = total - hits;
        } catch {
          // ignore
        }
      }

      llmCostByProvider = providerAgg.map((item) => {
        const key = `${item.provider}/${item.model}`;
        const hits = cacheHitsByProvider[key] ?? 0;
        const total = item._count.id;
        const cacheHitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
        return {
          provider: item.provider,
          model: item.model,
          dailyUsd: (item._sum.costUsd ?? 0) / 30, // média diária do mês
          monthlyUsd: item._sum.costUsd ?? 0,
          inputTokens: item._sum.inputTokens ?? 0,
          outputTokens: item._sum.outputTokens ?? 0,
          cacheHitRate,
        };
      });
    } catch {
      // CostLog pode não existir em todos ambientes
    }

    // ── 2. BudgetGuardState ─────────────────────────────────────
    let budgetGuard: {
      dailySpendUsd: number;
      dailyBudgetUsd: number;
      monthlySpendUsd: number;
      monthlyBudgetUsd: number;
      criticalLevel: string;
    } | null = null;

    try {
      const today = new Date().toISOString().slice(0, 10);
      const budget = await db.budgetGuardState.findUnique({
        where: { date: today },
      });
      if (budget) {
        budgetGuard = {
          dailySpendUsd: budget.dailySpendUsd,
          dailyBudgetUsd: budget.dailyBudgetUsd,
          monthlySpendUsd: budget.monthlySpendUsd,
          monthlyBudgetUsd: budget.monthlyBudgetUsd,
          criticalLevel: budget.criticalLevel,
        };
      }
    } catch {
      // BudgetGuardState pode não existir
    }

    // ── 3. MRR real via Transactions (USD convertido) ──────────
    let monthlyRevenueBRL = 0;
    try {
      const txAgg = await db.transaction.aggregate({
        where: {
          type: 'PAYMENT',
          status: 'COMPLETED',
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      });
      monthlyRevenueBRL = txAgg._sum.amount ?? 0;
    } catch {
      // ignore
    }

    // Custo mensal real = LLM + WhatsApp (mock $35) + Vercel ($10) + DB ($4)
    const WHATSAPP_MONTHLY = 35.4;
    const VERCEL_MONTHLY = 10;
    const POSTGRES_MONTHLY = 4;
    const realMonthlyLlm = monthlyLlmCost || 24.6;
    const totalMonthlyBurn =
      realMonthlyLlm + WHATSAPP_MONTHLY + VERCEL_MONTHLY + POSTGRES_MONTHLY;
    const totalDailyBurn = totalMonthlyBurn / 30;

    // Cotação BRL→USD aproximada (mock)
    const BRL_TO_USD = 5.5;
    const mrrUsd = monthlyRevenueBRL > 0 ? monthlyRevenueBRL / BRL_TO_USD : 10850;
    const netMonthly = mrrUsd - totalMonthlyBurn;
    const cashOnHand = 50000;
    const runwayMonths = netMonthly > 0 ? Math.floor(cashOnHand / netMonthly) : 0;

    // ── 4. Cost items (para BurnRatePanel) ──────────────────────
    const costItems = [
      {
        id: 'whatsapp',
        label: 'WhatsApp Cloud API',
        dailyUsd: WHATSAPP_MONTHLY / 30,
        monthlyUsd: WHATSAPP_MONTHLY,
        detail: '$0.0068/msg · ~174 msgs/dia',
        icon: 'MessageSquare',
        accent: 'emerald',
      },
      {
        id: 'llm',
        label: 'LLM Tokens (GLM-4.7-flash)',
        dailyUsd: realMonthlyLlm / 30,
        monthlyUsd: realMonthlyLlm,
        detail: `$0.10/$0.20 per 1M tokens · cache hit ${llmCostByProvider[0]?.cacheHitRate ?? 47}%`,
        icon: 'Cpu',
        accent: 'primary',
      },
      {
        id: 'vercel',
        label: 'Vercel Pro (hosting)',
        dailyUsd: VERCEL_MONTHLY / 30,
        monthlyUsd: VERCEL_MONTHLY,
        detail: 'Next.js 16 + edge functions',
        icon: 'Cloud',
        accent: 'sky',
      },
      {
        id: 'postgres',
        label: 'Vercel Postgres',
        dailyUsd: POSTGRES_MONTHLY / 30,
        monthlyUsd: POSTGRES_MONTHLY,
        detail: 'Prisma ORM · 1GB storage usado',
        icon: 'Database',
        accent: 'amber',
      },
    ];

    // ── 5. Tenant costs (distribui LLM cost por tenant ativo) ──
    let tenantCosts: Array<{
      id: string;
      name: string;
      niche: string;
      monthlyUsd: number;
    }> = [];

    try {
      const tenants = await db.tenant.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          niche: true,
        },
        take: 6,
      });

      if (tenants.length > 0) {
        // Agrega CostLog por tenant
        const tenantCostsAgg = await db.costLog.groupBy({
          by: ['tenantId'],
          where: {
            createdAt: { gte: monthStart },
            tenantId: { not: null },
          },
          _sum: { costUsd: true },
        });
        const costsMap = new Map<string, number>();
        for (const item of tenantCostsAgg) {
          if (item.tenantId) {
            costsMap.set(item.tenantId, item._sum.costUsd ?? 0);
          }
        }
        const avgCost = realMonthlyLlm / tenants.length;
        tenantCosts = tenants.map((t) => ({
          id: t.id,
          name: t.name,
          niche: t.niche || 'pousada',
          monthlyUsd: costsMap.get(t.id) ?? avgCost,
        }));
      }
    } catch {
      // ignore
    }

    // ── 6. Month trend (últimos 12 meses a partir de CostLog) ──
    let monthTrend: Array<{ month: string; cost: number }> = [];
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const monthlyAgg = await db.costLog.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: twelveMonthsAgo } },
        _sum: { costUsd: true },
      });

      // Agrega por mês
      const byMonth = new Map<string, number>();
      for (const item of monthlyAgg) {
        const date = new Date(item.createdAt);
        const monthKey = date.toLocaleString('pt-BR', { month: 'short' });
        byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + (item._sum.costUsd ?? 0));
      }

      // Se não houver dados, usa mock
      if (byMonth.size === 0) {
        monthTrend = buildMockMonthTrend(totalMonthlyBurn);
      } else {
        // Fill gaps com custos médios
        monthTrend = [...byMonth.entries()].map(([month, cost]) => ({
          month: month.charAt(0).toUpperCase() + month.slice(1),
          cost: Math.round(cost * 100) / 100,
        }));
      }
    } catch {
      monthTrend = buildMockMonthTrend(totalMonthlyBurn);
    }

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          dailyBurn: totalDailyBurn,
          monthlyBurn: totalMonthlyBurn,
          mrrUsd,
          netMonthly,
          runwayMonths,
          margin: mrrUsd > 0 ? (netMonthly / mrrUsd) * 100 : 0,
        },
        costItems,
        tenantCosts,
        monthTrend,
        budgetGuard,
        llmCostByProvider,
        globalTotals: {
          totalEvents: burnRateStore.totalEvents,
          totalMessagesProcessed: burnRateStore.totalMessagesProcessed,
          totalTariffsUsed: burnRateStore.totalTariffsUsed,
          totalTariffsSaved: burnRateStore.totalTariffsSaved,
          totalMetaCostSpent: Math.round(burnRateStore.totalMetaCostSpent * 10000) / 10000,
          totalMetaCostSaved: Math.round(burnRateStore.totalMetaCostSaved * 10000) / 10000,
          globalEconomyPercent:
            burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved > 0
              ? Math.round(
                  (burnRateStore.totalTariffsSaved /
                    (burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved)) *
                    100
                )
              : 0,
        },
        byNiche: burnRateStore.byNiche,
        lastEventAt: burnRateStore.lastEventAt,
      },
      meta: { source: 'db' },
    });
  } catch (error) {
    console.error('[ZCC Burn Rate] Error:', error);
    return NextResponse.json({
      success: true,
      data: buildMockBurnPayload(),
      meta: { source: 'fallback' },
    });
  }
}

// ── Mock payload (Vercel sem DB) ────────────────────────────────

function buildMockBurnPayload() {
  const COST_ITEMS = [
    {
      id: 'whatsapp',
      label: 'WhatsApp Cloud API',
      dailyUsd: 1.18,
      monthlyUsd: 35.4,
      detail: '$0.0068/msg · ~174 msgs/dia',
      icon: 'MessageSquare',
      accent: 'emerald',
    },
    {
      id: 'llm',
      label: 'LLM Tokens (GLM-4.7-flash)',
      dailyUsd: 0.82,
      monthlyUsd: 24.6,
      detail: '$0.10/$0.20 per 1M tokens · cache hit 47%',
      icon: 'Cpu',
      accent: 'primary',
    },
    {
      id: 'vercel',
      label: 'Vercel Pro (hosting)',
      dailyUsd: 0.33,
      monthlyUsd: 10.0,
      detail: 'Next.js 16 + edge functions',
      icon: 'Cloud',
      accent: 'sky',
    },
    {
      id: 'postgres',
      label: 'Vercel Postgres',
      dailyUsd: 0.14,
      monthlyUsd: 4.0,
      detail: 'Prisma ORM · 1GB storage usado',
      icon: 'Database',
      accent: 'amber',
    },
  ];

  const totalDailyBurn = COST_ITEMS.reduce((s, c) => s + c.dailyUsd, 0);
  const totalMonthlyBurn = COST_ITEMS.reduce((s, c) => s + c.monthlyUsd, 0);
  const mrrUsd = 10850;
  const netMonthly = mrrUsd - totalMonthlyBurn;
  const cashOnHand = 50000;
  const runwayMonths = netMonthly > 0 ? Math.floor(cashOnHand / netMonthly) : 0;

  const tenantCosts = [
    { id: 't1', name: 'Pousada Maravilha', niche: 'pousada', monthlyUsd: 18.2 },
    { id: 't2', name: 'Villa Geribá Búzios', niche: 'airbnb', monthlyUsd: 15.4 },
    { id: 't3', name: 'Pousada Vila Floripa', niche: 'pousada', monthlyUsd: 12.6 },
    { id: 't4', name: 'Casa Trancoso BA', niche: 'airbnb', monthlyUsd: 14.8 },
    { id: 't5', name: 'Pousada Serenity Paraty', niche: 'pousada', monthlyUsd: 6.4 },
    { id: 't6', name: 'Studio Costa Verde', niche: 'airbnb', monthlyUsd: 11.2 },
  ];

  return {
    totals: {
      dailyBurn: totalDailyBurn,
      monthlyBurn: totalMonthlyBurn,
      mrrUsd,
      netMonthly,
      runwayMonths,
      margin: mrrUsd > 0 ? (netMonthly / mrrUsd) * 100 : 0,
    },
    costItems: COST_ITEMS,
    tenantCosts,
    monthTrend: buildMockMonthTrend(totalMonthlyBurn),
    budgetGuard: {
      dailySpendUsd: totalDailyBurn,
      dailyBudgetUsd: 50,
      monthlySpendUsd: totalMonthlyBurn,
      monthlyBudgetUsd: 1500,
      criticalLevel: 'nominal',
    },
    llmCostByProvider: [
      {
        provider: 'zai-sdk',
        model: 'glm-4.7-flash',
        dailyUsd: 0.82,
        monthlyUsd: 24.6,
        inputTokens: 12400000,
        outputTokens: 4200000,
        cacheHitRate: 47,
      },
    ],
    globalTotals: {
      totalEvents: burnRateStore.totalEvents,
      totalMessagesProcessed: burnRateStore.totalMessagesProcessed,
      totalTariffsUsed: burnRateStore.totalTariffsUsed,
      totalTariffsSaved: burnRateStore.totalTariffsSaved,
      totalMetaCostSpent: Math.round(burnRateStore.totalMetaCostSpent * 10000) / 10000,
      totalMetaCostSaved: Math.round(burnRateStore.totalMetaCostSaved * 10000) / 10000,
      globalEconomyPercent:
        burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved > 0
          ? Math.round(
              (burnRateStore.totalTariffsSaved /
                (burnRateStore.totalTariffsUsed + burnRateStore.totalTariffsSaved)) *
                100
            )
          : 0,
    },
    byNiche: burnRateStore.byNiche,
    lastEventAt: burnRateStore.lastEventAt,
  };
}

function buildMockMonthTrend(currentBurn: number): Array<{ month: string; cost: number }> {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const baseTrend = [58, 61, 64, 62, 67, 69, 71, 70, 72, 73, 74];
  return months.map((month, idx) => ({
    month,
    cost: idx === 11 ? currentBurn : baseTrend[idx],
  }));
}
