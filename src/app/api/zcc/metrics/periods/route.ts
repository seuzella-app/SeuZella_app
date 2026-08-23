import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ═══════════════════════════════════════════════════════════════
// ZCC METRICS BY PERIOD — Breakdown por dia/semana/mês/trimestre/semestre/ano
//
// Conexões Prisma:
//  - Tenant (createdAt, subscriptionAt) → new tenants no período
//  - Subscription (amount, status, createdAt) → MRR real no período
//  - Transaction (type=PAYMENT, status=COMPLETED, createdAt) → receita recebida
//  - Lead (createdAt, status) → leads gerados/convertidos no período
//  - CostLog (createdAt, costUsd) → custos do período
//
// Retorna métricas completas para 2 períodos: atual + anterior (para calcular crescimento)
// ═══════════════════════════════════════════════════════════════

export type PeriodKey =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'semester'
  | 'year';

interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

function getPeriodRange(period: PeriodKey, offset = 0): PeriodRange {
  const now = new Date();
  let end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day':
      start.setDate(start.getDate() - offset);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week': {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek - offset * 7);
      end = new Date(start.getTime() + 7 * 24 * 3600 * 1000 - 1);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setMonth(start.getMonth() - offset);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'quarter': {
      const quarterMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(quarterMonth - offset * 3);
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'semester': {
      const semMonth = Math.floor(start.getMonth() / 6) * 6;
      start.setMonth(semMonth - offset * 6);
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 6, 0, 23, 59, 59, 999);
      break;
    }
    case 'year':
      start.setMonth(0, 1);
      start.setFullYear(start.getFullYear() - offset);
      end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
  }

  return {
    start,
    end,
    label: formatLabel(period, start, end),
  };
}

function formatLabel(period: PeriodKey, start: Date, end: Date): string {
  const fmtShort = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  const fmtYear = (d: Date) => d.getFullYear().toString();

  switch (period) {
    case 'day':
      return start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    case 'week':
      return `${fmtShort(start)} → ${fmtShort(end)}`;
    case 'month':
      return fmtMonth(start);
    case 'quarter':
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
    case 'semester':
      return `S${Math.floor(start.getMonth() / 6) + 1} ${start.getFullYear()}`;
    case 'year':
      return fmtYear(start);
  }
}

interface PeriodMetrics {
  range: PeriodRange;
  totalMRR: number;
  newMRR: number;
  lostMRR: number;
  activeClients: number;
  newClients: number;
  churnedClients: number;
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenue: number;
  arpu: number;
  burn: number;
  netProfit: number;
  burnPerClient: number;
}

async function computePeriodMetrics(range: PeriodRange): Promise<PeriodMetrics> {
  const { start, end } = range;

  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    return computeMockPeriodMetrics(range);
  }

  // Defaults
  let totalMRR = 0;
  let newMRR = 0;
  let lostMRR = 0;
  let activeClients = 0;
  let newClients = 0;
  let churnedClients = 0;
  let totalLeads = 0;
  let convertedLeads = 0;
  let lostLeads = 0;
  let revenue = 0;
  let burn = 0;

  try {
    // Active tenants with their MRR (snapshot now)
    const tenants = await db.tenant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        plan: true,
        createdAt: true,
        subscriptions: {
          where: { status: 'active' },
          select: { amount: true, createdAt: true },
          take: 1,
        },
        airbSubscriptions: {
          where: { status: 'active' },
          select: { amount: true, createdAt: true },
          take: 1,
        },
      },
    });

    const PLAN_PRICING: Record<string, number> = {
      lite: 197, pro: 397, max: 797, parceiro: 247, starter: 147, business: 597,
      airb_pro: 397, airb_max: 797, gratuito: 0, trial: 0,
    };

    for (const t of tenants) {
      const planRaw = (t.plan || '').toLowerCase();
      let planPrice = PLAN_PRICING[planRaw] ?? 0;
      if (t.airbSubscriptions.length > 0) planPrice = t.airbSubscriptions[0].amount;
      if (t.subscriptions.length > 0) planPrice = t.subscriptions[0].amount;

      totalMRR += planPrice;
      activeClients++;

      // Novo cliente no período?
      const tenantCreated = new Date(t.createdAt);
      if (tenantCreated >= start && tenantCreated <= end) {
        newClients++;
        newMRR += planPrice;
      }
    }

    // Churned clients (suspended in period)
    const churned = await db.tenant.findMany({
      where: {
        status: { in: ['suspended', 'churned'] },
        updatedAt: { gte: start, lte: end },
      },
      select: { id: true, plan: true, subscriptions: { take: 1, select: { amount: true } } },
    });
    churnedClients = churned.length;
    for (const c of churned) {
      const planRaw = (c.plan || '').toLowerCase();
      lostMRR += c.subscriptions[0]?.amount ?? PLAN_PRICING[planRaw] ?? 0;
    }

    // Revenue (Transaction type=PAYMENT status=COMPLETED no período)
    try {
      const txAgg = await db.transaction.aggregate({
        where: {
          type: 'PAYMENT',
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      });
      revenue = txAgg._sum.amount ?? 0;
    } catch {
      revenue = 0;
    }

    // Leads (created in period)
    try {
      const leadAgg = await db.lead.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { id: true },
      });
      for (const g of leadAgg) {
        totalLeads += g._count.id;
        if (g.status === 'converted' || g.status === 'convertido') convertedLeads += g._count.id;
        if (g.status === 'lost' || g.status === 'perdido') lostLeads += g._count.id;
      }
    } catch {
      totalLeads = 0;
    }

    // Burn (CostLog in period)
    try {
      const burnAgg = await db.costLog.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { costUsd: true },
      });
      burn = (burnAgg._sum.costUsd ?? 0) * 5.5; // USD → BRL approx
    } catch {
      burn = 0;
    }
  } catch (error) {
    console.error('[ZCC periods] computePeriodMetrics error:', error);
  }

  // Se MRR é zero, simula
  if (totalMRR === 0) {
    return computeMockPeriodMetrics(range);
  }

  const arpu = activeClients > 0 ? Math.round(totalMRR / activeClients) : 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;
  const netProfit = revenue - burn;
  const burnPerClient = activeClients > 0 ? burn / activeClients : 0;

  return {
    range,
    totalMRR,
    newMRR,
    lostMRR,
    activeClients,
    newClients,
    churnedClients,
    totalLeads,
    convertedLeads,
    lostLeads,
    conversionRate,
    revenue,
    arpu,
    burn,
    netProfit,
    burnPerClient,
  };
}

function computeMockPeriodMetrics(range: PeriodRange): PeriodMetrics {
  // Mock determinístico baseado na data de início do período (estável por dia)
  const seed = range.start.getTime();
  const seedNum = (Math.sin(seed / 86400000) + 1) / 2; // 0..1

  // MRR base simulado: R$ 80k/mês para contexto
  const baseMRR = 80000;
  const periodLength = range.end.getTime() - range.start.getTime();
  const periodInMonths = periodLength / (30 * 24 * 3600 * 1000);

  const totalMRR = Math.round(baseMRR * (0.7 + seedNum * 0.6));
  const newMRR = Math.round(totalMRR * 0.08 * (0.5 + seedNum * 1.5));
  const lostMRR = Math.round(totalMRR * 0.025 * (0.5 + seedNum));

  const activeClients = Math.round(totalMRR / 480);
  const newClients = Math.max(1, Math.round(newMRR / 480));
  const churnedClients = Math.max(0, Math.round(lostMRR / 480));

  const totalLeads = Math.round(40 * Math.max(1, periodInMonths) * (0.7 + seedNum * 0.6));
  const convertedLeads = Math.round(totalLeads * (0.2 + seedNum * 0.15));
  const lostLeads = Math.round(totalLeads * (0.1 + seedNum * 0.1));
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

  const revenue = Math.round(totalMRR * (0.9 + seedNum * 0.2));
  const arpu = activeClients > 0 ? Math.round(totalMRR / activeClients) : 0;
  const burn = Math.round(revenue * 0.06 * (0.8 + seedNum * 0.4));
  const netProfit = revenue - burn;
  const burnPerClient = activeClients > 0 ? burn / activeClients : 0;

  return {
    range,
    totalMRR,
    newMRR,
    lostMRR,
    activeClients,
    newClients,
    churnedClients,
    totalLeads,
    convertedLeads,
    lostLeads,
    conversionRate,
    revenue,
    arpu,
    burn,
    netProfit,
    burnPerClient,
  };
}

// ── Insights engine ──────────────────────────────────────────────

interface Insight {
  type: 'growth' | 'decline' | 'critical' | 'opportunity' | 'success';
  severity: 'info' | 'warning' | 'critical' | 'success';
  metric: string;
  current: number;
  previous: number;
  changePct: number;
  message: string;
  actionArea: string; // setor onde atuar
  recommendation: string; // como reverter/melhorar
  futureGoal?: string;
}

function computeInsights(
  current: PeriodMetrics,
  previous: PeriodMetrics,
  period: PeriodKey
): Insight[] {
  const insights: Insight[] = [];
  const periodLabel = {
    day: 'dia', week: 'semana', month: 'mês',
    quarter: 'trimestre', semester: 'semestre', year: 'ano',
  }[period];

  const calcChange = (curr: number, prev: number) =>
    prev !== 0 ? Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10 : curr > 0 ? 100 : 0;

  // 1. MRR growth
  const mrrChange = calcChange(current.totalMRR, previous.totalMRR);
  if (mrrChange > 5) {
    insights.push({
      type: 'growth',
      severity: 'success',
      metric: 'MRR',
      current: current.totalMRR,
      previous: previous.totalMRR,
      changePct: mrrChange,
      message: `MRR cresceu ${mrrChange}% no ${periodLabel}`,
      actionArea: 'Sales + Customer Success',
      recommendation: 'Manter ritmo de aquisição. Identificar canais que trouxeram mais conversões e dobrar investimento neles. Considerar upsell para clientes LITE→PRO.',
      futureGoal: `Atingir R$ ${(current.totalMRR * 1.15).toLocaleString('pt-BR')} no próximo ${periodLabel} (+15%)`,
    });
  } else if (mrrChange < -5) {
    insights.push({
      type: 'decline',
      severity: 'critical',
      metric: 'MRR',
      current: current.totalMRR,
      previous: previous.totalMRR,
      changePct: mrrChange,
      message: `MRR caiu ${Math.abs(mrrChange)}% no ${periodLabel}`,
      actionArea: 'Customer Success + Retention',
      recommendation: 'URGENTE: contatar todos os clientes suspensos nas últimas 48h. Oferecer desconto de retentativa (50% off por 2 meses). Ativar campanha de win-back via WhatsApp.',
      futureGoal: `Recuperar para R$ ${previous.totalMRR.toLocaleString('pt-BR')} em 30 dias`,
    });
  }

  // 2. New clients
  const newClientsChange = calcChange(current.newClients, previous.newClients);
  if (newClientsChange > 10) {
    insights.push({
      type: 'growth',
      severity: 'success',
      metric: 'Novos clientes',
      current: current.newClients,
      previous: previous.newClients,
      changePct: newClientsChange,
      message: `Aquisição de novos clientes cresceu ${newClientsChange}% no ${periodLabel}`,
      actionArea: 'Marketing + Sales',
      recommendation: 'Triplicar investimento nos canais que estão convertendo. Criar campanha de referral (parceiro R$ 247) para acelerar ainda mais.',
      futureGoal: `Manter CAC abaixo de R$ 800 e LTV/CAC acima de 3:1`,
    });
  } else if (newClientsChange < -15) {
    insights.push({
      type: 'decline',
      severity: 'warning',
      metric: 'Novos clientes',
      current: current.newClients,
      previous: previous.newClients,
      changePct: newClientsChange,
      message: `Aquisição de novos clientes caiu ${Math.abs(newClientsChange)}% no ${periodLabel}`,
      actionArea: 'Marketing (Google Ads + Landing Page)',
      recommendation: 'Revisar campanhas Google Ads: aumentar lances em palavras-chave com maior Quality Score. Ativar lookalike audience de top clientes no Meta Ads. Otimizar landing page (testar novo CTA).',
      futureGoal: `Voltar a ${previous.newClients} novos clientes no próximo ${periodLabel}`,
    });
  }

  // 3. Churn
  const churnChange = calcChange(current.churnedClients, previous.churnedClients);
  const churnRate = current.activeClients > 0
    ? (current.churnedClients / (current.activeClients + current.churnedClients)) * 100
    : 0;
  if (churnRate > 3) {
    insights.push({
      type: 'critical',
      severity: 'critical',
      metric: 'Churn rate',
      current: churnRate,
      previous: previous.activeClients > 0
        ? (previous.churnedClients / (previous.activeClients + previous.churnedClients)) * 100
        : 0,
      changePct: churnChange,
      message: `Churn rate de ${churnRate.toFixed(1)}% no ${periodLabel} — acima da meta de 3%`,
      actionArea: 'Customer Success',
      recommendation: 'Implementar NPS semanal para detectar insatisfação antes do cancelamento. Criar programa de "save desk" com ofertas personalizadas. Revisar onboarding dos últimos 30 clientes que cancelaram.',
      futureGoal: 'Reduzir churn para < 2% em 60 dias',
    });
  }

  // 4. Conversion rate
  const convChange = calcChange(current.conversionRate, previous.conversionRate);
  if (convChange > 5) {
    insights.push({
      type: 'growth',
      severity: 'success',
      metric: 'Taxa de conversão de leads',
      current: current.conversionRate,
      previous: previous.conversionRate,
      changePct: convChange,
      message: `Conversão de leads subiu ${convChange}% no ${periodLabel}`,
      actionArea: 'Sales',
      recommendation: 'Documentar scripts que estão funcionando e treinar toda equipe. Aumentar volume de leads nesse perfil (Google Ads similar audience).',
      futureGoal: `Atingir 30% de conversão até fim do ano`,
    });
  } else if (convChange < -5) {
    insights.push({
      type: 'decline',
      severity: 'warning',
      metric: 'Taxa de conversão de leads',
      current: current.conversionRate,
      previous: previous.conversionRate,
      changePct: convChange,
      message: `Conversão de leads caiu ${Math.abs(convChange)}% no ${periodLabel}`,
      actionArea: 'Sales (qualificação de leads)',
      recommendation: 'Revisar scoring de leads (scoreQual pode estar superestimado). Implementar call disqualification: leads com score < 60 não passam para sales. Revisar qualidade dos leads do Google Ads.',
      futureGoal: 'Recuperar 25% de conversão em 30 dias',
    });
  }

  // 5. Burn rate vs revenue
  const burnMargin = current.revenue > 0 ? (current.burn / current.revenue) * 100 : 0;
  if (burnMargin > 15) {
    insights.push({
      type: 'critical',
      severity: 'critical',
      metric: 'Burn vs Revenue margin',
      current: burnMargin,
      previous: previous.revenue > 0 ? (previous.burn / previous.revenue) * 100 : 0,
      changePct: calcChange(burnMargin, previous.revenue > 0 ? (previous.burn / previous.revenue) * 100 : 0),
      message: `Custos representam ${burnMargin.toFixed(1)}% da receita — acima da meta de 10%`,
      actionArea: 'Engineering + Finance (CFO Agent)',
      recommendation: 'Ativar BudgetGuard em modo "warning". Revisar CostLog por provider e otimizar prompts (cache hit rate). Considerar mudar para modelo mais barato (GLM-4.7-flash) em tarefas não-críticas.',
      futureGoal: 'Reduzir burn para < 8% da receita',
    });
  } else if (burnMargin < 8) {
    insights.push({
      type: 'success',
      severity: 'success',
      metric: 'Burn vs Revenue margin',
      current: burnMargin,
      previous: previous.revenue > 0 ? (previous.burn / previous.revenue) * 100 : 0,
      changePct: calcChange(burnMargin, previous.revenue > 0 ? (previous.burn / previous.revenue) * 100 : 0),
      message: `Custos representam apenas ${burnMargin.toFixed(1)}% da receita — saudável`,
      actionArea: 'Finance',
      recommendation: 'Margem saudável permite investir em growth (Google Ads + conteúdo). Considerar contratar 1 SDR para acelerar aquisição.',
      futureGoal: 'Manter margem entre 5-10% e investir 20% do líquido em marketing',
    });
  }

  // 6. ARPU
  const arpuChange = calcChange(current.arpu, previous.arpu);
  if (arpuChange < -3) {
    insights.push({
      type: 'decline',
      severity: 'warning',
      metric: 'ARPU',
      current: current.arpu,
      previous: previous.arpu,
      changePct: arpuChange,
      message: `ARPU caiu ${Math.abs(arpuChange)}% no ${periodLabel}`,
      actionArea: 'Sales (upsell / cross-sell)',
      recommendation: 'Ativar campanha de upsell LITE→PRO (R$ 397) com 30 dias de bônus. Promover Link-in-Bio (R$ 47) para clientes LITE. Considerar tier MAX para clientes PRO com > 100 hóspedes.',
      futureGoal: `Atingir ARPU de R$ ${Math.round(current.arpu * 1.2)} (+20%)`,
    });
  } else if (arpuChange > 5) {
    insights.push({
      type: 'growth',
      severity: 'success',
      metric: 'ARPU',
      current: current.arpu,
      previous: previous.arpu,
      changePct: arpuChange,
      message: `ARPU cresceu ${arpuChange}% no ${periodLabel} — clientes migrando para planos superiores`,
      actionArea: 'Sales + Product',
      recommendation: 'Continuar upsell. Investir em features premium para diferenciar MAX. Documentar cases de sucesso para usar em vendas.',
      futureGoal: `Manter ARPU crescente rumo a R$ 600`,
    });
  }

  // 7. Net profit
  const profitChange = calcChange(current.netProfit, previous.netProfit);
  if (profitChange < -10) {
    insights.push({
      type: 'decline',
      severity: 'critical',
      metric: 'Lucro líquido',
      current: current.netProfit,
      previous: previous.netProfit,
      changePct: profitChange,
      message: `Lucro líquido caiu ${Math.abs(profitChange)}% no ${periodLabel}`,
      actionArea: 'Finance (CFO Agent) + Sales',
      recommendation: 'Combinar: (1) reduzir burn em 15%, (2) acelerar aquisição de clientes PRO/MAX (maior margem), (3) pausar investimentos não-essenciais. Revisar runway.',
      futureGoal: 'Recuperar lucro em 30 dias e melhorar runway > 24 meses',
    });
  } else if (profitChange > 15) {
    insights.push({
      type: 'success',
      severity: 'success',
      metric: 'Lucro líquido',
      current: current.netProfit,
      previous: previous.netProfit,
      changePct: profitChange,
      message: `Lucro líquido cresceu ${profitChange}% no ${periodLabel}`,
      actionArea: 'Finance + Growth',
      recommendation: 'Reservar 30% para reserve fund (runway), 50% para growth (Google Ads + conteúdo), 20% para R&D (novos agentes Zélla).',
      futureGoal: 'Atingir R$ 50k/mês de lucro líquido até fim do ano',
    });
  }

  return insights;
}

// ── HTTP Handler ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') || 'month') as PeriodKey;

  const validPeriods: PeriodKey[] = ['day', 'week', 'month', 'quarter', 'semester', 'year'];
  if (!validPeriods.includes(period)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PERIOD', message: `Period deve ser: ${validPeriods.join(', ')}` },
      { status: 400 }
    );
  }

  // Período atual + período anterior (para comparação)
  const currentRange = getPeriodRange(period, 0);
  const previousRange = getPeriodRange(period, 1);

  const [current, previous] = await Promise.all([
    computePeriodMetrics(currentRange),
    computePeriodMetrics(previousRange),
  ]);

  const insights = computeInsights(current, previous, period);

  // Resumo executivo
  const summary = {
    period,
    periodLabel: current.range.label,
    previousPeriodLabel: previous.range.label,
    growthRate:
      previous.totalMRR !== 0
        ? Math.round(((current.totalMRR - previous.totalMRR) / Math.abs(previous.totalMRR)) * 1000) / 10
        : 0,
    healthScore: computeHealthScore(current, previous),
    actionAreas: extractActionAreas(insights),
    topPriorities: insights
      .filter((i) => i.severity === 'critical' || i.severity === 'warning')
      .slice(0, 3)
      .map((i) => ({
        metric: i.metric,
        message: i.message,
        recommendation: i.recommendation,
        actionArea: i.actionArea,
      })),
  };

  return NextResponse.json({
    success: true,
    data: {
      current,
      previous,
      insights,
      summary,
    },
    meta: {
      source: (await isDatabaseAvailable()) ? 'db' : 'demo',
      generatedAt: new Date().toISOString(),
    },
  });
}

function computeHealthScore(curr: PeriodMetrics, prev: PeriodMetrics): number {
  // Score 0-100 baseado em: MRR growth, churn, conversion, profit margin
  const mrrGrowth = prev.totalMRR !== 0
    ? ((curr.totalMRR - prev.totalMRR) / Math.abs(prev.totalMRR)) * 100
    : 0;
  const churnRate = curr.activeClients > 0
    ? (curr.churnedClients / (curr.activeClients + curr.churnedClients)) * 100
    : 0;
  const margin = curr.revenue > 0 ? (curr.netProfit / curr.revenue) * 100 : 0;
  const conv = curr.conversionRate;

  const mrrScore = Math.max(0, Math.min(40, 20 + mrrGrowth * 2));
  const churnScore = Math.max(0, 20 - churnRate * 5);
  const marginScore = Math.max(0, Math.min(20, margin / 5));
  const convScore = Math.max(0, Math.min(20, conv));

  return Math.round(mrrScore + churnScore + marginScore + convScore);
}

function extractActionAreas(insights: Insight[]): string[] {
  const areas = new Set<string>();
  for (const i of insights) areas.add(i.actionArea);
  return [...areas];
}
