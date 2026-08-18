import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ── Plan pricing (alinhado com PLAN_PRICING em /lib/zcc/types.ts) ──────────
const PLAN_PRICING: Record<string, number> = {
  gratuito: 0,
  trial: 0,
  lite: 197,
  pro: 397,
  max: 797,
  parceiro: 247,
  starter: 147,
  business: 597,
  airb_pro: 397,
  airb_max: 797,
};

const PLAN_META: Record<
  string,
  { label: string; features: string[] }
> = {
  LITE: {
    label: 'LITE',
    features: ['50 hóspedes', '500 mensagens', 'IA limitada'],
  },
  PRO: {
    label: 'PRO',
    features: ['Ilimitado', 'OAuth Airbnb', 'Dynamic pricing'],
  },
  MAX: {
    label: 'MAX',
    features: ['Tudo de PRO', 'Competitor monitoring', 'Multi-property'],
  },
  PARCEIRO: {
    label: 'PARCEIRO',
    features: ['PRO + tab Conquistas', 'Referral gamification'],
  },
  TRIAL: {
    label: 'TRIAL',
    features: ['Demo', 'Limitado'],
  },
};

interface PlanAgg {
  count: number;
  mrr: number;
}

interface NicheAgg {
  clients: number;
  mrr: number;
}

/**
 * GET /api/zcc/metrics/financial
 *
 * Decomposição financeira completa do ZCC.
 *
 * Conexões:
 *  - Tenant (Prisma) → contagem + plano
 *  - Subscription (Prisma) → preço real pago (sobreponde ao plan default)
 *  - AirBSubscription (Prisma) → preço real Airbnb
 *  - Property.type → determina niche
 *
 * Retorno:
 *  - totalMRR, arpu, churnRate
 *  - activeClients, churnedClients, mrrLost
 *  - planBreakdown: array com {plan, label, price, count, mrr, ratio, features}
 *  - nicheBreakdown: array com {niche, label, clients, mrr, ratio}
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const dbOk = await isDatabaseAvailable();

    // ── Aggregates ────────────────────────────────────────────────
    const planAgg: Record<string, PlanAgg> = {
      LITE: { count: 0, mrr: 0 },
      PRO: { count: 0, mrr: 0 },
      MAX: { count: 0, mrr: 0 },
      PARCEIRO: { count: 0, mrr: 0 },
      TRIAL: { count: 0, mrr: 0 },
    };
    const nicheAgg: Record<string, NicheAgg> = {
      pousada: { clients: 0, mrr: 0 },
      airbnb: { clients: 0, mrr: 0 },
      parceiro: { clients: 0, mrr: 0 },
    };

    let totalMRR = 0;
    let activeCount = 0;
    let churnedCount = 0;
    let mrrLost = 0;
    let arpuPlanSum = 0; // soma de planPrice para todos ativos

    if (dbOk) {
      const tenants = await db.tenant.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
          property: {
            select: { type: true, city: true, state: true },
          },
          airbSubscriptions: {
            where: { status: 'active' },
            select: { amount: true, planType: true },
          },
          subscriptions: {
            where: { status: 'active' },
            select: { amount: true, planType: true },
          },
        },
      });

      for (const tenant of tenants) {
        const planRaw = (tenant.plan || '').toLowerCase();
        const isChurned = tenant.status === 'suspended' || tenant.status === 'churned';

        // Determine plan price (priority: Subscription > AirBSub > plan default)
        let planPrice = PLAN_PRICING[planRaw] ?? 0;
        if (tenant.airbSubscriptions.length > 0) {
          planPrice = tenant.airbSubscriptions[0].amount;
        }
        if (tenant.subscriptions.length > 0) {
          planPrice = tenant.subscriptions[0].amount;
        }

        // Map plan to breakdown key (normaliza legacy)
        let planKey = 'TRIAL';
        if (planRaw === 'lite' || planRaw === 'starter') planKey = 'LITE';
        else if (planRaw === 'pro' || planRaw === 'airb_pro') planKey = 'PRO';
        else if (planRaw === 'max' || planRaw === 'business' || planRaw === 'airb_max') planKey = 'MAX';
        else if (planRaw === 'parceiro') planKey = 'PARCEIRO';

        if (isChurned) {
          churnedCount++;
          mrrLost += planPrice;
          continue;
        }

        activeCount++;
        planAgg[planKey].count++;
        planAgg[planKey].mrr += planPrice;
        totalMRR += planPrice;
        arpuPlanSum += planPrice;

        // Niche breakdown
        const propertyType = tenant.property?.type;
        if (planRaw === 'parceiro') {
          nicheAgg.parceiro.clients++;
          nicheAgg.parceiro.mrr += planPrice;
        } else if (propertyType === 'airbnb' || tenant.airbSubscriptions.length > 0) {
          nicheAgg.airbnb.clients++;
          nicheAgg.airbnb.mrr += planPrice;
        } else {
          nicheAgg.pousada.clients++;
          nicheAgg.pousada.mrr += planPrice;
        }
      }

      // Se DB vazio, usa fallback demo
      if (totalMRR === 0) {
        return NextResponse.json({
          success: true,
          data: buildDemoPayload(),
          meta: { source: 'demo' },
        });
      }
    } else {
      // Demo mode (sem DB)
      return NextResponse.json({
        success: true,
        data: buildDemoPayload(),
        meta: { source: 'demo' },
      });
    }

    // ── Build response ────────────────────────────────────────────
    const arpu = activeCount > 0 ? Math.round(arpuPlanSum / activeCount) : 0;
    const totalClients = activeCount + churnedCount;
    const churnRate =
      totalClients > 0 ? Math.round((churnedCount / totalClients) * 1000) / 10 : 0;

    // Plan breakdown como array (alinhado com FinancialBreakdownPanel)
    const planBreakdown = (Object.keys(planAgg) as Array<keyof typeof planAgg>)
      .filter((k) => planAgg[k].count > 0 || k !== 'TRIAL')
      .map((planKey) => {
        const meta = PLAN_META[planKey] ?? PLAN_META.TRIAL;
        const price = PLAN_PRICING[planKey.toLowerCase()] ?? 0;
        const ratio = totalMRR > 0 ? Math.round((planAgg[planKey].mrr / totalMRR) * 1000) / 10 : 0;
        return {
          plan: planKey,
          label: meta.label,
          price,
          count: planAgg[planKey].count,
          mrr: planAgg[planKey].mrr,
          ratio,
          features: meta.features,
        };
      });

    const nicheBreakdown = [
      {
        niche: 'pousada',
        label: 'Pousadas',
        clients: nicheAgg.pousada.clients,
        mrr: nicheAgg.pousada.mrr,
        ratio: totalMRR > 0 ? Math.round((nicheAgg.pousada.mrr / totalMRR) * 1000) / 10 : 0,
      },
      {
        niche: 'airbnb',
        label: 'Airbnb',
        clients: nicheAgg.airbnb.clients,
        mrr: nicheAgg.airbnb.mrr,
        ratio: totalMRR > 0 ? Math.round((nicheAgg.airbnb.mrr / totalMRR) * 1000) / 10 : 0,
      },
      {
        niche: 'parceiro',
        label: 'Parceiros',
        clients: nicheAgg.parceiro.clients,
        mrr: nicheAgg.parceiro.mrr,
        ratio: totalMRR > 0 ? Math.round((nicheAgg.parceiro.mrr / totalMRR) * 1000) / 10 : 0,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        totalMRR,
        arpu,
        churnRate,
        totalClients,
        activeClients: activeCount,
        churnedClients: churnedCount,
        mrrLost,
        planBreakdown,
        nicheBreakdown,
      },
      meta: { source: 'db' },
    });
  } catch (error) {
    console.error('[ZCC Financial Metrics] Error:', error);
    return NextResponse.json({
      success: true,
      data: buildDemoPayload(),
      meta: { source: 'fallback' },
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function buildDemoPayload() {
  const planBreakdown = [
    {
      plan: 'LITE',
      label: 'LITE',
      price: 197,
      count: 24,
      mrr: 24 * 197,
      ratio: 0,
      features: PLAN_META.LITE.features,
    },
    {
      plan: 'PRO',
      label: 'PRO',
      price: 397,
      count: 48,
      mrr: 48 * 397,
      ratio: 0,
      features: PLAN_META.PRO.features,
    },
    {
      plan: 'MAX',
      label: 'MAX',
      price: 797,
      count: 32,
      mrr: 32 * 797,
      ratio: 0,
      features: PLAN_META.MAX.features,
    },
    {
      plan: 'PARCEIRO',
      label: 'PARCEIRO',
      price: 247,
      count: 18,
      mrr: 18 * 247,
      ratio: 0,
      features: PLAN_META.PARCEIRO.features,
    },
  ];
  const totalMRR = planBreakdown.reduce((s, p) => s + p.mrr, 0);
  planBreakdown.forEach((p) => {
    p.ratio = totalMRR > 0 ? Math.round((p.mrr / totalMRR) * 1000) / 10 : 0;
  });

  const nicheBreakdown = [
    {
      niche: 'pousada',
      label: 'Pousadas',
      clients: 64,
      mrr: 31280,
      ratio: 0,
    },
    {
      niche: 'airbnb',
      label: 'Airbnb',
      clients: 40,
      mrr: 13420,
      ratio: 0,
    },
    {
      niche: 'parceiro',
      label: 'Parceiros',
      clients: 18,
      mrr: 4446,
      ratio: 0,
    },
  ];
  const nicheTotal = nicheBreakdown.reduce((s, n) => s + n.mrr, 0);
  nicheBreakdown.forEach((n) => {
    n.ratio = nicheTotal > 0 ? Math.round((n.mrr / nicheTotal) * 1000) / 10 : 0;
  });

  const totalClients = planBreakdown.reduce((s, p) => s + p.count, 0);
  const churned = 3;
  const churnRate = Math.round((churned / (totalClients + churned)) * 1000) / 10;
  const arpu = Math.round(totalMRR / totalClients);

  return {
    totalMRR,
    arpu,
    churnRate,
    totalClients: totalClients + churned,
    activeClients: totalClients,
    churnedClients: churned,
    mrrLost: churned * arpu,
    planBreakdown,
    nicheBreakdown,
  };
}
