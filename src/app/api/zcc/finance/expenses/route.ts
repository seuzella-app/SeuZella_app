import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ═══════════════════════════════════════════════════════════════
// ZCC FINANCE EXPENSES — Taxas de cartão + Impostos Praia Grande/SP
//
// CONTEXTO:
//  - Empresa sediada em Praia Grande, Litoral Sul de São Paulo
//  - Regime: Simples Nacional (Anexo III — prestação de serviços)
//  - Gateways escolhidos: Mercado Pago (PIX + Cartão) + Payment Gateway (cartão internacional)
//
// GATEWAY FEES (taxas de cartão):
//  - Mercado Pago PIX:           0.99% (taxa promocional)
//  - Mercado Pago Cartão débito: 1.99%
//  - Mercado Pago Cartão crédito: 4.99% + R$ 0,40
//  - Payment Gateway Cartão internacional: 4.99% + R$ 0,50 + 1% (cross-border)
//
// IMPOSTOS PRAIA GRANDE/SP:
//  - Simples Nacional Anexo III (faturamento até R$ 180k/ano):
//    · Aliquota nominal inicial: 6%
//    · Faixa 1 (até R$ 180k/ano): 6%
//    · Faixa 2 (R$ 180k a R$ 360k/ano): 11.2%
//  - ISS Praia Grande: 5% (alíquota municipal para serviços de TI/SaaS)
//    · Já incluso no Simples Nacional (não cobrado separadamente)
//  - PIS/COFINS: cumulativo 0.65% + 3% = 3.65% (mas no Simples é 0.74% embutido)
//
// CONEXÕES PRISMA:
//  - Subscription (status='active', paymentMethod) → base de cálculo
//  - Transaction (type='PAYMENT', status='COMPLETED', method) → histórico real
//  - CostLog → custos LLM (já existe)
//  - BudgetGuardState → budget tracking (já existe)
// ═══════════════════════════════════════════════════════════════

// ── Tipos ──────────────────────────────────────────────────────

interface GatewayFee {
  gateway: 'mercadopago';
  paymentMethod: 'pix' | 'debito' | 'credito' | 'credito_internacional';
  label: string;
  ratePct: number;
  fixedFeeBRL: number;
  effectiveRatePct: number; // taxa efetiva considerando valor médio
}

interface TaxBreakdown {
  name: string;
  description: string;
  ratePct: number;
  baseBRL: number;
  amountBRL: number;
  isPracaGrandeSpecific: boolean;
}

interface ExpenseItem {
  id: string;
  category: 'gateway_fee' | 'tax' | 'infrastructure' | 'marketing' | 'team' | 'tool' | 'other';
  label: string;
  amountBRL: number;
  detail?: string;
  isRecurring: boolean;
}

interface ExpensesResponse {
  // Taxas de gateway (por método)
  gatewayFees: Array<GatewayFee & {
    transactionCount: number;
    volumeBRL: number;
    feeBRL: number;
  }>;
  totalGatewayFeesBRL: number;

  // Impostos (Praia Grande/SP)
  taxes: TaxBreakdown[];
  totalTaxesBRL: number;

  // Outras despesas operacionais
  otherExpenses: ExpenseItem[];
  totalOtherExpensesBRL: number;

  // Resumo
  grossRevenueBRL: number;
  totalExpensesBRL: number;
  netRevenueBRL: number;
  marginPct: number;

  // Configuração (jurisdiction)
  jurisdiction: {
    city: 'Praia Grande';
    state: 'SP';
    country: 'BR';
    taxRegime: 'Simples Nacional';
    anexo: 'III';
    annualRevenueBracket: string;
    effectiveTaxRatePct: number;
  };

  // Cálculo detalhado por plano (com taxa de cartão embutida)
  perPlanBreakdown: Array<{
    plan: string;
    priceBRL: number;
    paymentMethod: string;
    gateway: string;
    gatewayFeeBRL: number;
    taxBRL: number;
    netPerClientBRL: number;
    clientCount: number;
    totalNetBRL: number;
  }>;
}

// ── Constantes — Taxas de Gateway (atualizadas 2025) ─────────────

const GATEWAY_FEES: GatewayFee[] = [
  {
    gateway: 'mercadopago',
    paymentMethod: 'pix',
    label: 'Mercado Pago · PIX',
    ratePct: 0.99,
    fixedFeeBRL: 0,
    effectiveRatePct: 0.99,
  },
  {
    gateway: 'mercadopago',
    paymentMethod: 'debito',
    label: 'Mercado Pago · Cartão Débito',
    ratePct: 1.99,
    fixedFeeBRL: 0,
    effectiveRatePct: 1.99,
  },
  {
    gateway: 'mercadopago',
    paymentMethod: 'credito',
    label: 'Mercado Pago · Cartão Crédito',
    ratePct: 4.99,
    fixedFeeBRL: 0.40,
    effectiveRatePct: 5.06, // considerando ticket médio R$ 397
  },
  {
    gateway: 'mercadopago',
  paymentMethod: 'credito_internacional',
    label: 'Payment Gateway · Cartão Internacional',
    ratePct: 4.99,
    fixedFeeBRL: 0.50,
    effectiveRatePct: 6.24, // +1% cross-border
  },
];

// ── Constantes — Impostos Praia Grande/SP ────────────────────────

const TAXES_PRAIA_GRANDE: Array<Omit<TaxBreakdown, 'baseBRL' | 'amountBRL'>> = [
  {
    name: 'Simples Nacional · Anexo III',
    description: 'Tributo federal unificado (IRPJ, CSLL, PIS, COFINS, CPP, ISS) para prestadores de serviço. Faixa 1: até R$ 180k/ano.',
    ratePct: 6.0,
    isPracaGrandeSpecific: false,
  },
  {
    name: 'ISS Praia Grande',
    description: 'Imposto Municipal de Praia Grande/SP sobre serviços de TI/SaaS. Alíquota 5%, mas já embutida no Simples Nacional (não cobrada separadamente).',
    ratePct: 0, // 0% pois já está embutido no Simples
    isPracaGrandeSpecific: true,
  },
  {
    name: 'PIS/COFINS Cumulativo',
    description: 'Já embutido no Simples Nacional (0.74% efetivo dentro da alíquota de 6%).',
    ratePct: 0,
    isPracaGrandeSpecific: false,
  },
  {
    name: 'CPP (INSS Patronal)',
    description: 'Já embutido no Simples Nacional Anexo III. Para folha até 1 salário mínimo por funcionário.',
    ratePct: 0,
    isPracaGrandeSpecific: false,
  } as any,
];

// ── Outras despesas operacionais (mensal) ────────────────────────

const DEFAULT_OPERATIONAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'infra-vercel',
    category: 'infrastructure',
    label: 'Vercel Pro (hosting Next.js 16)',
    amountBRL: 150,
    detail: 'Plano Pro · edge functions · analytics',
    isRecurring: true,
  },
  {
    id: 'infra-postgres',
    category: 'infrastructure',
    label: 'Vercel Postgres (Prisma)',
    amountBRL: 80,
    detail: '1GB storage · backups automáticos',
    isRecurring: true,
  },
  {
    id: 'infra-whatsapp',
    category: 'infrastructure',
    label: 'WhatsApp Cloud API',
    amountBRL: 320,
    detail: '~250 conversas/dia · 1000 templates/mês',
    isRecurring: true,
  },
  {
    id: 'tool-llm',
    category: 'tool',
    label: 'LLM Tokens (GLM-4.7-flash)',
    amountBRL: 135,
    detail: '~$24 USD/mês · 16M tokens',
    isRecurring: true,
  },
  {
    id: 'tool-claude',
    category: 'tool',
    label: 'Claude Code (Anthropic)',
    amountBRL: 500,
    detail: 'Desenvolvimento + code review automático',
    isRecurring: true,
  },
  {
    id: 'marketing-google-ads',
    category: 'marketing',
    label: 'Google Ads (Search + PMax)',
    amountBRL: 2000,
    detail: 'Persona Pousadeiro Tradicional + Airbnb Moderno',
    isRecurring: true,
  },
  {
    id: 'team-dev',
    category: 'team',
    label: 'Equipe desenvolvimento',
    amountBRL: 6000,
    detail: '1 dev fullstack + 1 tech lead parcial',
    isRecurring: true,
  },
  {
    id: 'team-marketing',
    category: 'team',
    label: 'Equipe marketing',
    amountBRL: 2000,
    detail: '1 growth marketer parcial + copywriter',
    isRecurring: true,
  },
  {
    id: 'other-domain',
    category: 'other',
    label: 'Domínio + DNS Cloudflare',
    amountBRL: 30,
    detail: 'smart-hotel-zehla.vercel.app + custom domain',
    isRecurring: true,
  },
];

// ── Helper ──────────────────────────────────────────────────────

const PLAN_PRICING: Record<string, { pix: number; cartao: number }> = {
  lite: { pix: 197, cartao: 197 },
  pro: { pix: 397, cartao: 397 },
  max: { pix: 797, cartao: 797 },
  parceiro: { pix: 247, cartao: 247 },
};

const PLAN_DEFAULT_METHOD: Record<string, 'pix' | 'cartao'> = {
  lite: 'pix',
  parceiro: 'pix',
  pro: 'cartao',
  max: 'cartao',
};

function getEffectiveGatewayFee(
  paymentMethod: 'pix' | 'cartao',
  planType: string,
  amountBRL: number
): { fee: GatewayFee; feeBRL: number } {
  let method: GatewayFee['paymentMethod'];
  if (paymentMethod === 'pix') method = 'pix';
  else if (planType === 'max') method = 'credito_internacional'; // MAX usa Payment Gateway (internacional)
  else method = 'credito';

  const fee = GATEWAY_FEES.find((f) => f.paymentMethod === method) ?? GATEWAY_FEES[0];
  const feeBRL = (amountBRL * fee.ratePct) / 100 + fee.fixedFeeBRL;

  return { fee, feeBRL };
}

function calcTax(grossRevenueBRL: number): { taxes: TaxBreakdown[]; totalBRL: number } {
  // Simples Nacional Anexo III — faixa 1 (até R$ 180k/ano)
  const annualRevenue = grossRevenueBRL * 12;
  const isFaixa1 = annualRevenue <= 180_000;
  const simplesRate = isFaixa1 ? 6.0 : 11.2;
  const simplesAmount = (grossRevenueBRL * simplesRate) / 100;

  const taxes: TaxBreakdown[] = [
    {
      name: 'Simples Nacional · Anexo III',
      description: `Faixa ${isFaixa1 ? '1' : '2'} (${isFaixa1 ? 'até R$ 180k/ano' : 'R$ 180k-360k/ano'}). Tributo federal unificado (IRPJ, CSLL, PIS, COFINS, CPP, ISS).`,
      ratePct: simplesRate,
      baseBRL: grossRevenueBRL,
      amountBRL: simplesAmount,
      isPracaGrandeSpecific: false,
    },
    {
      name: 'ISS Praia Grande',
      description: 'Alíquota municipal de 5% para serviços de TI/SaaS. Já embutida no Simples Nacional — não há cobrança separada.',
      ratePct: 0,
      baseBRL: grossRevenueBRL,
      amountBRL: 0,
      isPracaGrandeSpecific: true,
    },
    {
      name: 'PIS/COFINS Cumulativo',
      description: '0.74% efetivo já embutido na alíquota do Simples Nacional Anexo III.',
      ratePct: 0,
      baseBRL: grossRevenueBRL,
      amountBRL: 0,
      isPracaGrandeSpecific: false,
    },
  ];

  return { taxes, totalBRL: simplesAmount };
}

// ── HTTP Handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const dbOk = await isDatabaseAvailable();

    // ── Coletar dados de assinaturas ativas ────────────────────
    let subscriptions: Array<{
      plan: string;
      paymentMethod: string;
      amount: number;
    }> = [];

    if (dbOk) {
      try {
        const tenants = await db.tenant.findMany({
          where: { status: 'active' },
          select: {
            plan: true,
            subscriptions: {
              where: { status: 'active' },
              select: { paymentMethod: true, amount: true, planType: true },
              take: 1,
            },
            airbSubscriptions: {
              where: { status: 'active' },
              select: { amount: true },
              take: 1,
            },
          },
        });

        for (const t of tenants) {
          const planRaw = (t.plan || '').toLowerCase();
          const sub = t.subscriptions[0] ?? t.airbSubscriptions[0];
          const price = sub?.amount ?? PLAN_PRICING[planRaw]?.[PLAN_DEFAULT_METHOD[planRaw] ?? 'pix'] ?? 0;
          const method = sub?.paymentMethod ?? PLAN_DEFAULT_METHOD[planRaw] ?? 'pix';

          subscriptions.push({
            plan: planRaw,
            paymentMethod: method,
            amount: price,
          });
        }
      } catch {
        // ignore — use mock
      }
    }

    // Mock fallback se DB vazio
    if (subscriptions.length === 0) {
      subscriptions = [
        { plan: 'lite', paymentMethod: 'pix', amount: 197 },
        { plan: 'lite', paymentMethod: 'pix', amount: 197 },
        { plan: 'lite', paymentMethod: 'cartao', amount: 197 },
        { plan: 'pro', paymentMethod: 'cartao', amount: 397 },
        { plan: 'pro', paymentMethod: 'cartao', amount: 397 },
        { plan: 'pro', paymentMethod: 'pix', amount: 397 },
        { plan: 'max', paymentMethod: 'cartao', amount: 797 },
        { plan: 'max', paymentMethod: 'cartao', amount: 797 },
        { plan: 'parceiro', paymentMethod: 'pix', amount: 247 },
      ];
    }

    // ── Calcular gross revenue ──────────────────────────────────
    const grossRevenueBRL = subscriptions.reduce((s, sub) => s + sub.amount, 0);

    // ── Calcular taxas de gateway por método ───────────────────
    const gatewayFeesByMethod = new Map<string, {
      fee: GatewayFee;
      transactionCount: number;
      volumeBRL: number;
      feeBRL: number;
    }>();

    for (const sub of subscriptions) {
      const { fee, feeBRL } = getEffectiveGatewayFee(
        sub.paymentMethod as 'pix' | 'cartao',
        sub.plan,
        sub.amount
      );

      const key = `${fee.gateway}:${fee.paymentMethod}`;
      if (!gatewayFeesByMethod.has(key)) {
        gatewayFeesByMethod.set(key, {
          fee,
          transactionCount: 0,
          volumeBRL: 0,
          feeBRL: 0,
        });
      }
      const entry = gatewayFeesByMethod.get(key)!;
      entry.transactionCount++;
      entry.volumeBRL += sub.amount;
      entry.feeBRL += feeBRL;
    }

    const gatewayFees = [...gatewayFeesByMethod.values()].map((e) => ({
      gateway: e.fee.gateway,
      paymentMethod: e.fee.paymentMethod,
      label: e.fee.label,
      ratePct: e.fee.ratePct,
      fixedFeeBRL: e.fee.fixedFeeBRL,
      effectiveRatePct: e.fee.effectiveRatePct,
      transactionCount: e.transactionCount,
      volumeBRL: e.volumeBRL,
      feeBRL: e.feeBRL,
    }));

    const totalGatewayFeesBRL = gatewayFees.reduce((s, g) => s + g.feeBRL, 0);

    // ── Calcular impostos (Praia Grande/SP) ─────────────────────
    const { taxes, totalBRL: totalTaxesBRL } = calcTax(grossRevenueBRL);

    // ── Outras despesas operacionais ───────────────────────────
    const totalOtherExpensesBRL = DEFAULT_OPERATIONAL_EXPENSES.reduce(
      (s, e) => s + e.amountBRL,
      0
    );

    // ── Resumo ─────────────────────────────────────────────────
    const totalExpensesBRL = totalGatewayFeesBRL + totalTaxesBRL + totalOtherExpensesBRL;
    const netRevenueBRL = grossRevenueBRL - totalExpensesBRL;
    const marginPct = grossRevenueBRL > 0
      ? Math.round((netRevenueBRL / grossRevenueBRL) * 1000) / 10
      : 0;

    // ── Breakdown por plano ────────────────────────────────────
    const perPlanMap = new Map<string, {
      plan: string;
      priceBRL: number;
      paymentMethod: string;
      gateway: string;
      gatewayFeeBRL: number;
      taxBRL: number;
      netPerClientBRL: number;
      clientCount: number;
      totalNetBRL: number;
    }>();

    for (const sub of subscriptions) {
      const { fee, feeBRL } = getEffectiveGatewayFee(
        sub.paymentMethod as 'pix' | 'cartao',
        sub.plan,
        sub.amount
      );
      const taxBRL = (sub.amount * 6) / 100; // Simples Nacional 6%
      const netPerClient = sub.amount - feeBRL - taxBRL;

      const key = `${sub.plan}:${sub.paymentMethod}:${fee.gateway}`;
      if (!perPlanMap.has(key)) {
        perPlanMap.set(key, {
          plan: sub.plan.toUpperCase(),
          priceBRL: sub.amount,
          paymentMethod: sub.paymentMethod,
          gateway: fee.gateway,
          gatewayFeeBRL: feeBRL,
          taxBRL,
          netPerClientBRL: netPerClient,
          clientCount: 0,
          totalNetBRL: 0,
        });
      }
      const entry = perPlanMap.get(key)!;
      entry.clientCount++;
      entry.totalNetBRL += netPerClient;
    }

    const perPlanBreakdown = [...perPlanMap.values()];

    const response: ExpensesResponse = {
      gatewayFees,
      totalGatewayFeesBRL,
      taxes,
      totalTaxesBRL,
      otherExpenses: DEFAULT_OPERATIONAL_EXPENSES,
      totalOtherExpensesBRL,
      grossRevenueBRL,
      totalExpensesBRL,
      netRevenueBRL,
      marginPct,
      jurisdiction: {
        city: 'Praia Grande',
        state: 'SP',
        country: 'BR',
        taxRegime: 'Simples Nacional',
        anexo: 'III',
        annualRevenueBracket: grossRevenueBRL * 12 <= 180_000 ? 'Faixa 1 (até R$ 180k/ano)' : 'Faixa 2 (R$ 180k-360k/ano)',
        effectiveTaxRatePct: grossRevenueBRL * 12 <= 180_000 ? 6.0 : 11.2,
      },
      perPlanBreakdown,
    };

    return NextResponse.json({
      success: true,
      data: response,
      meta: {
        source: dbOk ? 'db' : 'demo',
        generatedAt: new Date().toISOString(),
        note: 'Taxas de gateway e impostos calculados conforme Praia Grande/SP · Simples Nacional Anexo III',
      },
    });
  } catch (error) {
    console.error('[ZCC Finance Expenses] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro ao calcular taxas e impostos',
      },
      { status: 500 }
    );
  }
}
