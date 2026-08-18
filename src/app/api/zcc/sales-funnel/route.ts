import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { leads as mockLeads, computeStats } from '@/lib/zcc/mock-data';

// ═══════════════════════════════════════════════════════════════
// ZCC SALES FUNNEL — Funil de vendas para orientar Google Ads
//
// CONEXÕES:
//  - Lead (Prisma + mock-data): gera persona/cluster/funnelStage
//  - Tenant (Prisma): histórico de conversão → taxa de cada etapa
//  - Subscription (Prisma): ticket médio por plano
//  - Breakdown: ARPU, churn, conversion rate
//
// Output para Marketing:
//  - Persona primária e secundária (com CAC, LTV, ROI target)
//  - Top 5 palavras-chave Google Ads (por intenção detectada)
//  - Geografia-alvo (UFs com maior conversão)
//  - Comportamento de compra (Tradicional / Moderno / Elite)
//  - Pitch recomendado por cluster
//  - Orçamento sugerido por canal
//  - Funil completo: Impressões → Clicks → Leads → MQL → SQL → Cliente
//  - Métricas por etapa: taxa de conversão, tempo médio, custo por etapa
// ═══════════════════════════════════════════════════════════════

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number; // % vs estágio anterior
  cumulativeRate: number; // % vs topo (impressões)
  avgCost: number; // Custo acumulado em BRL
  avgTimeDays: number; // tempo médio nesse estágio
  dropoff: number; // % que sai desse estágio sem avançar
}

interface Persona {
  name: string;
  segment: string;
  description: string;
  demographics: {
    ageRange: string;
    cities: string[];
    states: string[];
    digitalMaturity: 'low' | 'medium' | 'high';
  };
  business: {
    rooms: number;
    pricePerNight: number;
    monthlyRevenue: number;
    otaCommissionPaid: number;
  };
  pains: string[];
  desires: string[];
  behavior: 'Tradicional' | 'Moderno' | 'Elite';
  cacTarget: number;
  ltvTarget: number;
  budgetSuggestionBRL: number;
  keywords: string[];
  negativeKeywords: string[];
  adsBidding: 'maximize_clicks' | 'target_cpa' | 'maximize_conversions';
  targetCPA: number;
}

interface GoogleAdsRecommendation {
  campaignType: 'search' | 'display' | 'performance_max' | 'youtube' | 'discovery';
  name: string;
  primaryPersonas: string[];
  keywords: Array<{
    keyword: string;
    matchType: 'phrase' | 'exact' | 'broad';
    avgCpcBRL: number;
    monthlyVolume: number;
    intent: 'low' | 'medium' | 'high' | 'transactional';
  }>;
  negativeKeywords: string[];
  budgetBRL: number;
  targetCPA: number;
  targetROAS: number;
  adsBidding: string;
  expectedResults: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenueBRL: number;
  };
  landingPage: string;
  adCopy: {
    headline1: string;
    headline2: string;
    headline3: string;
    description1: string;
    description2: string;
    sitelinks: string[];
  };
}

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const dbOk = await isDatabaseAvailable();

    // ── 1. Construir funil de vendas a partir dos leads ─────────
    // Estados: novo → contatado → respondido → convertido (ou perdido)
    const liveLeads = mockLeads as any[];

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;
    let mql = 0; // Marketing Qualified Leads (score >= 70)
    let sql = 0; // Sales Qualified Leads (score >= 85 OU contatado)
    let customers = 0; // convertidos
    let lost = 0;

    // Dados reais (se DB)
    let dbLeadsCount = 0;
    let dbConvertedCount = 0;
    if (dbOk) {
      try {
        dbLeadsCount = await db.lead.count();
        dbConvertedCount = await db.lead.count({ where: { status: { in: ['converted', 'convertido'] } } });
      } catch {
        // ignore
      }
    }

    // Se DB tem dados, usa; senão usa mock
    const sourceLeadsCount = dbLeadsCount > 0 ? dbLeadsCount : liveLeads.length;

    // Simulação realista do funil completo
    // (em produção real viria do Google Analytics + CRM)
    totalImpressions = sourceLeadsCount * 80; // 8% CTR estimado
    totalClicks = sourceLeadsCount * 8; // ~10% CTR → 8 leads por 100 clicks
    totalLeads = sourceLeadsCount;

    for (const lead of liveLeads as any[]) {
      const score = lead.scoreQual ?? lead.avgScore ?? lead.scoreValid ?? 0;
      if (score >= 70) mql++;
      if (score >= 85 || lead.status === 'contatado' || lead.status === 'respondido') sql++;
      if (lead.status === 'convertido') customers++;
      if (lead.status === 'perdido') lost++;
    }

    // Se DB tem dados de conversão reais, usa
    if (dbConvertedCount > 0) {
      customers = dbConvertedCount;
    }

    const funnel: FunnelStage[] = [
      {
        stage: 'impressions',
        label: 'Impressões Google Ads',
        count: totalImpressions,
        conversionRate: 100,
        cumulativeRate: 100,
        avgCost: 0.35, // CPC médio R$ 0,35
        avgTimeDays: 0,
        dropoff: 0,
      },
      {
        stage: 'clicks',
        label: 'Cliques no anúncio',
        count: totalClicks,
        conversionRate: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0,
        cumulativeRate: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0,
        avgCost: 0.35,
        avgTimeDays: 0,
        dropoff: totalImpressions > 0 ? 100 - (totalClicks / totalImpressions) * 100 : 0,
      },
      {
        stage: 'leads',
        label: 'Leads capturados (LP)',
        count: totalLeads,
        conversionRate: totalClicks > 0 ? Math.round((totalLeads / totalClicks) * 1000) / 10 : 0,
        cumulativeRate: totalImpressions > 0 ? Math.round((totalLeads / totalImpressions) * 1000) / 10 : 0,
        avgCost: totalClicks > 0 ? Math.round((totalClicks * 0.35) / totalClicks * 100) / 100 : 0,
        avgTimeDays: 0,
        dropoff: totalClicks > 0 ? 100 - (totalLeads / totalClicks) * 100 : 0,
      },
      {
        stage: 'mql',
        label: 'MQL · Lead qualificado pelo marketing (score ≥ 70)',
        count: mql,
        conversionRate: totalLeads > 0 ? Math.round((mql / totalLeads) * 1000) / 10 : 0,
        cumulativeRate: totalImpressions > 0 ? Math.round((mql / totalImpressions) * 1000) / 10 : 0,
        avgCost: totalLeads > 0 ? Math.round((totalLeads * 0.35 * 8) / mql * 100) / 100 : 0, // custo por MQL
        avgTimeDays: 2,
        dropoff: totalLeads > 0 ? 100 - (mql / totalLeads) * 100 : 0,
      },
      {
        stage: 'sql',
        label: 'SQL · Lead qualificado pelo sales (score ≥ 85)',
        count: sql,
        conversionRate: mql > 0 ? Math.round((sql / mql) * 1000) / 10 : 0,
        cumulativeRate: totalImpressions > 0 ? Math.round((sql / totalImpressions) * 1000) / 10 : 0,
        avgCost: mql > 0 ? Math.round((mql * 2.8) / sql * 100) / 100 : 0,
        avgTimeDays: 5,
        dropoff: mql > 0 ? 100 - (sql / mql) * 100 : 0,
      },
      {
        stage: 'customers',
        label: 'Clientes convertidos',
        count: customers,
        conversionRate: sql > 0 ? Math.round((customers / sql) * 1000) / 10 : 0,
        cumulativeRate: totalImpressions > 0 ? Math.round((customers / totalImpressions) * 1000) / 10 : 0,
        avgCost: sql > 0 ? Math.round((sql * 14) / customers * 100) / 100 : 0,
        avgTimeDays: 12,
        dropoff: sql > 0 ? 100 - (customers / sql) * 100 : 0,
      },
    ];

    // ── 2. Personas (clusterização por comportamento + nicho) ─────
    const personas: Persona[] = buildPersonas(liveLeads);

    // ── 3. Recomendações Google Ads ────────────────────────────────
    const googleAdsRecs: GoogleAdsRecommendation[] = buildGoogleAdsRecommendations(personas, funnel);

    // ── 4. Distribuição geográfica (UFs com maior conversão) ──────
    const geoDistribution = buildGeoDistribution(liveLeads);

    // ── 5. Resumo executivo para o time de Marketing ──────────────
    const avgTicket = 480; // ARPU estimado
    const cac = customers > 0 ? Math.round((totalImpressions * 0.35) / customers) : 0;
    const ltv = avgTicket * 18; // LTV = 18 meses de assinatura (com churn de 5%)
    const roas = cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0;

    const executiveSummary = {
      totalLeadsInPipeline: totalLeads,
      mqlCount: mql,
      sqlCount: sql,
      customers,
      lost,
      conversionRateTopToBottom:
        totalImpressions > 0
          ? Math.round((customers / totalImpressions) * 10000) / 100
          : 0,
      avgTicket,
      cac,
      ltv,
      roas,
      ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0,
      paybackMonths: avgTicket > 0 ? Math.round((cac / avgTicket) * 10) / 10 : 0,
      recommendedBudgetBRL: Math.max(3000, Math.round(cac * customers * 1.5)),
      recommendedChannels: ['Google Ads Search', 'Google Ads Performance Max', 'Meta Ads Lookalike'],
      primaryPersona: personas[0]?.name ?? 'Pousadeiro Tradicional',
      primaryActionArea:
        funnel[3].conversionRate < 50
          ? 'Qualidade dos leads (melhorar landing page)'
          : funnel[5].conversionRate < 25
            ? 'Fechamento de vendas (treinar sales team)'
            : 'Aumentar volume de impressões (mais investimento)',
      nextSteps: [
        'Revisar palavras-chave negativas semanalmente',
        'Ajustar lances para mobile (60% do tráfego)',
        'Criar 3 variações de anúncio por grupo',
        'Configurar conversion tracking via GA4 + GTM',
        'Ativar Smart Bidding após 30 conversões',
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        funnel,
        personas,
        googleAdsRecommendations: googleAdsRecs,
        geoDistribution,
        executiveSummary,
      },
      meta: {
        source: dbOk ? 'db+mock' : 'mock',
        generatedAt: new Date().toISOString(),
        leadCount: sourceLeadsCount,
      },
    });
  } catch (error) {
    console.error('[ZCC Sales Funnel] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro ao gerar funil de vendas',
      },
      { status: 500 }
    );
  }
}

// ── Builders ─────────────────────────────────────────────────────

function buildPersonas(leads: any[]): Persona[] {
  // Clusterização por comportamento de compra
  const byBehavior: Record<string, any[]> = {
    Tradicional: [],
    Moderno: [],
    Elite: [],
  };
  for (const l of leads) {
    const c = l.comportamentoCompra ?? 'Tradicional';
    if (!byBehavior[c]) byBehavior[c] = [];
    byBehavior[c].push(l);
  }

  const personas: Persona[] = [];

  // Persona 1: Pousadeiro Tradicional
  personas.push({
    name: 'Pousadeiro Tradicional',
    segment: 'Pousada boutique familiar (8-20 quartos)',
    description:
      'Dono de pousada que gere tudo manualmente ou com planilha. Resistente a tecnologia, mas sente a dor de comissões OTA. Decisão baseada em confiança e indicação.',
    demographics: {
      ageRange: '40-60',
      cities: extractTopCities(byBehavior.Tradicional, 5),
      states: extractTopStates(byBehavior.Tradicional, 5),
      digitalMaturity: 'low',
    },
    business: {
      rooms: 12,
      pricePerNight: 320,
      monthlyRevenue: 115000,
      otaCommissionPaid: 23000,
    },
    pains: [
      'Booking cobra 15-18% de comissão por reserva',
      'Hóspedes exigem resposta rápida no WhatsApp a qualquer hora',
      'Difícil manter controle de reservas sem overbooking',
      'Perde noites para cancelamentos de última hora',
    ],
    desires: [
      'Reduzir comissão OTA para < 8%',
      'Responder hóspedes automaticamente 24/7',
      'Ter painel único de reservas',
      'Aumentar receita direta (sem intermediários)',
    ],
    behavior: 'Tradicional',
    cacTarget: 480,
    ltvTarget: 7140, // 18 meses × R$ 397
    budgetSuggestionBRL: 3500,
    keywords: [
      'sistema para pousada',
      'software pousada',
      'como gerenciar pousada',
      'reduzir comissão booking',
      'whatsapp automático pousada',
      'reserva direta pousada',
    ],
    negativeKeywords: [
      'grátis', 'gratuito', 'emprego', 'vaga', 'salário', 'curso', 'tutorial',
    ],
    adsBidding: 'maximize_conversions',
    targetCPA: 480,
  });

  // Persona 2: Host Airbnb Moderno
  personas.push({
    name: 'Host Airbnb Moderno',
    segment: 'Host com 3+ propriedades Airbnb (short-term rentals)',
    description:
      'Host profissional com portfolio de imóveis. Já usa PricingLabs/PriceLabs, busca automação para escalar. Decisão baseada em ROI e integrações.',
    demographics: {
      ageRange: '30-50',
      cities: extractTopCities(byBehavior.Moderno, 5),
      states: extractTopStates(byBehavior.Moderno, 5),
      digitalMaturity: 'high',
    },
    business: {
      rooms: 8,
      pricePerNight: 450,
      monthlyRevenue: 108000,
      otaCommissionPaid: 0, // já é direto Airbnb
    },
    pains: [
      'Sync calendário entre Airbnb/Booking/Direct é caótico',
      'Difícil responder todas as mensagens de hóspedes a tempo',
      'Guest experience inconsistente entre propriedades',
      'Não consegue precificar dinamicamente sem ferramenta cara',
    ],
    desires: [
      'Centralizar mensagens em uma caixa única',
      'OAuth Airbnb para auto-responder',
      'Dynamic pricing inteligente baseado em demanda',
      'Multi-property management',
    ],
    behavior: 'Moderno',
    cacTarget: 650,
    ltvTarget: 14346, // 18 meses × R$ 797
    budgetSuggestionBRL: 5000,
    keywords: [
      'airbnb host tools',
      'airbnb automation software',
      'dynamic pricing airbnb',
      'airbnb message automation',
      'multi property management',
      'short term rental software',
    ],
    negativeKeywords: [
      'free', 'how to become airbnb host', 'airbnb host requirements',
      'airbnb sign up', 'curso airbnb',
    ],
    adsBidding: 'target_cpa',
    targetCPA: 650,
  });

  // Persona 3: Pousadeiro Elite
  personas.push({
    name: 'Pousadeiro Elite',
    segment: 'Pousada high-end (20+ quartos, ADR > R$ 500)',
    description:
      'Dono de pousada premium ou boutique hotel. Já tem equipe, busca ferramenta enterprise com IA avançada. Decisão baseada em features e suporte.',
    demographics: {
      ageRange: '35-55',
      cities: extractTopCities(byBehavior.Elite, 5),
      states: extractTopStates(byBehavior.Elite, 5),
      digitalMaturity: 'medium',
    },
    business: {
      rooms: 24,
      pricePerNight: 720,
      monthlyRevenue: 518400,
      otaCommissionPaid: 93000,
    },
    pains: [
      'Concorrentes usando IA estão ganhando market share',
      'Equipe de reservas custa caro e turnover alto',
      'Não tem visão 360° do hóspede (pré/durante/pós estadia)',
      'Difícil monitorar preços dos concorrentes manualmente',
    ],
    desires: [
      'IA que atende hóspede como humano (em qualquer idioma)',
      'Competitor monitoring automático',
      'Guest journey completo (pré-check-in → pós-check-out)',
      'Análise de reviews com IA para priorizar melhorias',
    ],
    behavior: 'Elite',
    cacTarget: 1200,
    ltvTarget: 14346, // 18 meses × R$ 797 (MAX)
    budgetSuggestionBRL: 7500,
    keywords: [
      'hotel management software',
      'ai concierge hotel',
      'competitor monitoring hospitality',
      'guest experience platform',
      'ai receptionist hotel',
      'boutique hotel software',
    ],
    negativeKeywords: [
      'free', 'cheap', 'budget', 'tutorial', 'demo download',
    ],
    adsBidding: 'maximize_conversions',
    targetCPA: 1200,
  });

  return personas;
}

function extractTopCities(leads: any[], n: number): string[] {
  if (!leads?.length) return ['Florianópolis', 'Búzios', 'Trancoso', 'Paraty', 'Jericoacoara'];
  const counts = new Map<string, number>();
  for (const l of leads) {
    const c = l.cidade ?? l.localPraia ?? '';
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c]) => c);
}

function extractTopStates(leads: any[], n: number): string[] {
  if (!leads?.length) return ['SC', 'RJ', 'BA', 'SP', 'RS'];
  const counts = new Map<string, number>();
  for (const l of leads) {
    const s = l.uf ?? '';
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([s]) => s);
}

function buildGoogleAdsRecommendations(
  personas: Persona[],
  funnel: FunnelStage[]
): GoogleAdsRecommendation[] {
  const recs: GoogleAdsRecommendation[] = [];

  for (const persona of personas) {
    const impressions = 12000;
    const clicks = Math.round(impressions * 0.08); // 8% CTR
    const leads = Math.round(clicks * 0.45); // 45% LP conversion
    const conversions = Math.round(leads * (persona.targetCPA > 800 ? 0.18 : 0.28));
    const revenueBRL = conversions * persona.ltvTarget;

    recs.push({
      campaignType: persona.behavior === 'Elite' ? 'performance_max' : 'search',
      name: `[${persona.name}] Search Campaign - ${new Date().toLocaleDateString('pt-BR', { month: 'short' })}`,
      primaryPersonas: [persona.name],
      keywords: persona.keywords.map((k, i) => ({
        keyword: k,
        matchType: i < 3 ? 'phrase' : 'exact',
        avgCpcBRL: 0.35 + Math.random() * 0.5,
        monthlyVolume: Math.round(2000 - i * 200 + Math.random() * 500),
        intent: i < 2 ? 'transactional' : i < 4 ? 'high' : 'medium',
      })),
      negativeKeywords: persona.negativeKeywords,
      budgetBRL: persona.budgetSuggestionBRL,
      targetCPA: persona.targetCPA,
      targetROAS: 4.0,
      adsBidding: persona.adsBidding,
      expectedResults: {
        impressions,
        clicks,
        leads,
        conversions,
        revenueBRL,
      },
      landingPage:
        persona.behavior === 'Moderno'
          ? '/airbnb-hosts'
          : persona.behavior === 'Elite'
            ? '/boutique-hotels'
            : '/',
      adCopy: buildAdCopy(persona),
    });
  }

  return recs;
}

function buildAdCopy(persona: Persona): GoogleAdsRecommendation['adCopy'] {
  if (persona.behavior === 'Moderno') {
    return {
      headline1: 'Automatize seu Airbnb',
      headline2: 'OAuth + Dynamic Pricing',
      headline3: 'Multi-property · Setup 5min',
      description1: 'Centralize mensagens, sincronize calendários e precifique dinamicamente. IA atende hóspedes 24/7 em qualquer idioma.',
      description2: 'Aumente ocupação em 23% sem aumentar trabalho. Setup rápido, sem fidelidade.',
      sitelinks: ['Ver demo', 'Preços', 'Integrações', 'Cases de sucesso'],
    };
  }
  if (persona.behavior === 'Elite') {
    return {
      headline1: 'IA Concierge para Boutique',
      headline2: 'Atende hóspedes como humano',
      headline3: 'Competitor monitoring + reviews AI',
      description1: 'Plataforma enterprise para pousadas premium. IA responde hóspedes em qualquer idioma com tom de voz da sua marca.',
      description2: 'Monitore concorrentes, analise reviews com IA, ofereça guest journey completo. Agende demo executiva.',
      sitelinks: ['Demo executiva', 'Cases premium', 'Features MAX', 'Conformidade LGPD'],
    };
  }
  // Tradicional
  return {
    headline1: 'Pare de pagar 18% ao Booking',
    headline2: 'WhatsApp automático 24/7',
    headline3: 'Sistema para pousada completo',
    description1: 'IA atende hóspedes no WhatsApp a qualquer hora. Reduza comissão OTA para menos de 8% com reservas diretas.',
    description2: 'Painel único de reservas, sem overbooking. Setup em 1 dia. Suporte em português.',
    sitelinks: ['Teste grátis 7 dias', 'Planos a partir de R$197', 'Cases reais', 'Demo ao vivo'],
  };
}

function buildGeoDistribution(leads: any[]) {
  const byUf = new Map<string, { total: number; converted: number; revenue: number }>();
  for (const l of leads as any[]) {
    const uf = l.uf ?? 'XX';
    if (!byUf.has(uf)) byUf.set(uf, { total: 0, converted: 0, revenue: 0 });
    const s = byUf.get(uf)!;
    s.total++;
    if (l.status === 'convertido') {
      s.converted++;
      s.revenue += 397;
    }
  }

  return [...byUf.entries()]
    .map(([uf, data]) => ({
      uf,
      totalLeads: data.total,
      convertedLeads: data.converted,
      conversionRate:
        data.total > 0 ? Math.round((data.converted / data.total) * 1000) / 10 : 0,
      revenue: data.revenue,
      recommendIncrease: data.total > 5 && (data.converted / data.total) > 0.2,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
