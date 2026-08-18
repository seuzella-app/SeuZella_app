/**
 * SEUZÉLLA — MÓDULO DE INTELIGÊNCIA DE MARKETING & ESTRATÉGIA COMERCIAL (PLAYBOOK)
 * Aplicação contínua da campanha em TODOS OS HOTSPOTS DE ALTO FLUXO DO BRASIL
 * durante os 90 dias (Setembro, Outubro, Novembro 2026).
 *
 * REGRA ABSOLUTA DE MARKETING:
 * PROIBIDO o uso das palavras "IA", "Bot" ou "Inteligência Artificial".
 * Usar sempre: "Seu Zélla", "Zelador Virtual", "Recepcionista no WhatsApp 24h por dia", "Atendimento para Pousadas".
 *
 * ORÇAMENTO OFICIAL APROVADO PELO FUNDADOR:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  MÊS 1 — SETEMBRO 2026 (Total: R$ 2.200,00)                   │
 * │    Semana 1: R$ 500  │ Semana 2: R$ 500                        │
 * │    Semana 3: R$ 600  │ Semana 4: R$ 600                        │
 * │                                                                 │
 * │  MÊS 2 — OUTUBRO 2026 (Total: R$ 3.200,00)                    │
 * │    Semana 1: R$ 600  │ Semana 2: R$ 600                        │
 * │    Semana 3: R$ 1.000 │ Semana 4: R$ 1.000                     │
 * │                                                                 │
 * │  MÊS 3 — NOVEMBRO 2026 (Total: R$ 4.000,00) [+R$200/semana]   │
 * │    Semana 1: R$ 800  │ Semana 2: R$ 800                        │
 * │    Semana 3: R$ 1.200 │ Semana 4: R$ 1.200                     │
 * │                                                                 │
 * │  ══════════════════════════════════════════════                  │
 * │  INVESTIMENTO TOTAL 90 DIAS: R$ 9.400,00                       │
 * └──────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface PermanentHotspotCluster {
  state: string;
  regionName: string;
  hotspots: string[];
  propertyFocus: 'POUSADAS_DOMINANTE' | 'AIRBNB_TEMPORADA_DOMINANTE' | 'HÍBRIDO';
  primaryPain: string;
  salesPitchAngle: string;
}

export interface GoogleAdsKeywordCampaign {
  groupId: number;
  groupName: string;
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  intentCategory: 'HIGH_INTENTION' | 'PROBLEM_AWARE' | 'COMPETITOR' | 'REMARKETING';
  estimatedCPC: number;
  adCopyHeadline: string;
  adCopyDescription: string;
  targetLandingHook: string;
}

export interface WeeklyBudgetEntry {
  weekNumber: number;       // 1 a 12
  monthLabel: string;       // "Setembro", "Outubro", "Novembro"
  monthNumber: number;      // 1, 2, 3
  weeklyBudget: number;     // Valor em R$
  estimatedClicks: number;
  estimatedLeads: number;
  estimatedSales: number;
  estimatedMRR: number;
}

export interface MonthlyProjection {
  month: string;
  monthNumber: number;
  totalBudget: number;
  weeks: WeeklyBudgetEntry[];
  totalClicks: number;
  totalLeads: number;
  landingConvRate: number;
  salesConvRate: number;
  totalSales: number;
  mrrGenerated: number;
  cumulativeMRR: number;    // MRR acumulado de TODOS os meses anteriores + este
  cumulativeSales: number;
}

export interface CampaignFullProjection {
  campaignName: string;
  totalInvestment: number;
  avgCPC: number;
  totalClicks: number;
  totalLeads: number;
  totalSales: number;
  finalCumulativeMRR: number;
  roasRatio: number;
  months: MonthlyProjection[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export class ZellaAdsSimulator {

  // ─── HOTSPOTS PERMANENTES ────────────────────────────────────────────

  /**
   * Mapeamento dos Hotspots Permanentes de Alto Fluxo Turístico no Brasil
   * ATIVOS EM TODOS OS MESES: Setembro, Outubro e Novembro 2026
   */
  static getPermanentHotspotClusters(): PermanentHotspotCluster[] {
    return [
      {
        state: 'SC',
        regionName: 'Litoral Catarinense & Capital',
        hotspots: ['Imbituba', 'Praia do Rosa', 'Garopaba', 'Guarda do Embaú', 'Florianópolis', 'Bombinhas', 'Balneário Camboriú'],
        propertyFocus: 'HÍBRIDO',
        primaryPain: 'Gestão remota de chalés/pousadas e fornecimento instantâneo de chave PIX do anfitrião.',
        salesPitchAngle: 'Atendimento humanizado 24h no WhatsApp para praias de SC sem perda de reservas de fim de semana.',
      },
      {
        state: 'PR',
        regionName: 'Ilha do Mel & Litoral Paranaense',
        hotspots: ['Ilha do Mel', 'Paranaguá'],
        propertyFocus: 'POUSADAS_DOMINANTE',
        primaryPain: 'Dúvidas de travessia de barco, horários de check-in e atendimento fora do horário comercial.',
        salesPitchAngle: 'Responda dúvidas de passeios e travessia 24h por dia e garanta a reserva do hóspede no ato.',
      },
      {
        state: 'SP',
        regionName: 'Litoral Norte SP & Baixada Santista',
        hotspots: ['Ubatuba', 'São Sebastião (Maresias, Juquehy, Camburi)', 'Ilhabela', 'Caraguatatuba', 'Bertioga', 'Praia Grande', 'Santos', 'Guarujá'],
        propertyFocus: 'AIRBNB_TEMPORADA_DOMINANTE',
        primaryPain: 'Perda massiva de reservas no WhatsApp durante as sextas-feiras e madrugadas pré-feriado.',
        salesPitchAngle: 'Recepção 24h no WhatsApp com tom acolhedor para a maior concentração de turistas de SP.',
      },
      {
        state: 'RJ',
        regionName: 'Região dos Lagos & Costa Verde',
        hotspots: ['Saquarema', 'Arraial do Cabo', 'Búzios', 'Paraty', 'Angra dos Reis'],
        propertyFocus: 'HÍBRIDO',
        primaryPain: 'Concorrência acirrada entre pousadas e necessidade de fechamento rápido antes que o hóspede chame outra.',
        salesPitchAngle: 'Atendimento instantâneo de reservas no WhatsApp para não dar margem para a concorrência.',
      },
      {
        state: 'BA',
        regionName: 'Costa do Descobrimento & Litoral Baiano',
        hotspots: ['Porto Seguro', 'Trancoso', 'Arraial d\'Ajuda', 'Itacaré', 'Morro de São Paulo', 'Costa do Sauípe'],
        propertyFocus: 'POUSADAS_DOMINANTE',
        primaryPain: 'Atendimento a turistas de todo o Brasil e envio de dados de pagamento e confirmação.',
        salesPitchAngle: 'O zelador virtual da sua pousada na Bahia: recepção calorosa e confirmação de reserva 24 horas por dia.',
      },
      {
        state: 'AL_PE_CE',
        regionName: 'Rota das Emoções & Caribe Brasileiro',
        hotspots: ['Maragogi', 'Porto de Galinhas', 'Preá', 'Jericoacoara', 'Pipa'],
        propertyFocus: 'HÍBRIDO',
        primaryPain: 'Alta demanda turística o ano inteiro e necessidade de envio de senhas de fechadura eletrônica e chave PIX.',
        salesPitchAngle: 'Automatize a recepção das suas acomodações no Nordeste com a eficiência e a simpatia do Seu Zélla.',
      },
    ];
  }

  // ─── 8 GRUPOS DE ANÚNCIOS SEGMENTADOS POR DOR ───────────────────────

  /**
   * 8 Grupos de Anúncios — Cada grupo ataca UMA DOR ESPECÍFICA do anfitrião/dono de pousada.
   * Ativos em TODOS os Hotspots Permanentes durante TODOS os 3 meses.
   * ZERO palavras proibidas (IA, Bot, Inteligência Artificial).
   */
  static getGoogleAdsCampaigns(): GoogleAdsKeywordCampaign[] {
    return [
      // ── GRUPO 1: Dor da Madrugada ──
      {
        groupId: 1,
        groupName: 'Dor da Madrugada',
        keyword: 'perder reservas madrugada pousada',
        matchType: 'PHRASE',
        intentCategory: 'PROBLEM_AWARE',
        estimatedCPC: 2.40,
        adCopyHeadline: 'Sua Pousada Perde Reservas de Madrugada? | Seu Zélla',
        adCopyDescription: 'O Seu Zélla responde hóspedes às 2h da manhã com o mesmo carinho que você responderia. Teste grátis ao vivo.',
        targetLandingHook: 'Quantas reservas sua pousada perdeu enquanto você dormia na última semana?',
      },
      // ── GRUPO 2: Dor da Distância (Airbnb) ──
      {
        groupId: 2,
        groupName: 'Dor da Distância (Airbnb)',
        keyword: 'gerenciar airbnb a distância whatsapp',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.60,
        adCopyHeadline: 'Gerencie seu Airbnb de Longe | Seu Zélla',
        adCopyDescription: 'Envie senhas da fechadura eletrônica, forneça a chave PIX e atenda hóspedes sem sair de casa. 24h por dia.',
        targetLandingHook: 'Seu imóvel de temporada atende hóspedes mesmo quando você está a 500 km de distância.',
      },
      // ── GRUPO 3: Dor do Overbooking ──
      {
        groupId: 3,
        groupName: 'Dor do Overbooking',
        keyword: 'evitar overbooking pousada',
        matchType: 'EXACT',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 4.20,
        adCopyHeadline: 'Chega de Overbooking na Sua Pousada | Seu Zélla',
        adCopyDescription: 'O Seu Zélla verifica disponibilidade em tempo real antes de confirmar a reserva no WhatsApp. Sem erros.',
        targetLandingHook: 'Overbooking é prejuízo e vergonha. O Seu Zélla nunca deixa isso acontecer.',
      },
      // ── GRUPO 4: Dor do PIX Manual ──
      {
        groupId: 4,
        groupName: 'Dor do PIX Manual',
        keyword: 'enviar pix automatico hospede pousada',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.10,
        adCopyHeadline: 'Envie a Chave PIX da Pousada em Segundos | Seu Zélla',
        adCopyDescription: 'O hóspede perguntou o PIX? O Seu Zélla fornece a chave PIX do anfitrião na hora, sem você mexer no celular.',
        targetLandingHook: 'Pare de copiar e colar chave PIX manualmente. O Seu Zélla faz isso por você.',
      },
      // ── GRUPO 5: Dor da Concorrência ──
      {
        groupId: 5,
        groupName: 'Dor da Concorrência',
        keyword: 'responder hospede antes da concorrência',
        matchType: 'PHRASE',
        intentCategory: 'PROBLEM_AWARE',
        estimatedCPC: 2.80,
        adCopyHeadline: 'Responda Antes da Concorrência | Seu Zélla',
        adCopyDescription: 'Enquanto a pousada do lado demora 3 horas pra responder, o Seu Zélla responde em 8 segundos. Quem ganha?',
        targetLandingHook: 'O hóspede reserva na primeira pousada que responde. Seja sempre a primeira.',
      },
      // ── GRUPO 6: Dor do Feriado Prolongado ──
      {
        groupId: 6,
        groupName: 'Dor do Feriado Prolongado',
        keyword: 'atendimento pousada feriado prolongado',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.90,
        adCopyHeadline: 'Feriado Chegando? Seu Zélla Atende Por Você',
        adCopyDescription: 'Independência, Finados, Proclamação... O WhatsApp da sua pousada lotado? O Seu Zélla cuida de tudo 24h.',
        targetLandingHook: 'Nos feriados, o WhatsApp bomba. O Seu Zélla transforma cada mensagem em reserva confirmada.',
      },
      // ── GRUPO 7: Dor da Fechadura / Check-in Remoto ──
      {
        groupId: 7,
        groupName: 'Dor da Fechadura / Check-in Remoto',
        keyword: 'check-in remoto pousada fechadura eletrônica',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 4.00,
        adCopyHeadline: 'Check-in Sem Recepção Presencial | Seu Zélla',
        adCopyDescription: 'O Seu Zélla envia a senha da fechadura eletrônica no horário certo do check-in. Sem atrasos, sem stress.',
        targetLandingHook: 'Hóspede chegou de madrugada? Senha enviada automaticamente. Zero problemas.',
      },
      // ── GRUPO 8: Remarketing ──
      {
        groupId: 8,
        groupName: 'Remarketing (Retargeting Landing Page)',
        keyword: 'remarketing_visitantes_landing_seuzella',
        matchType: 'BROAD',
        intentCategory: 'REMARKETING',
        estimatedCPC: 1.50,
        adCopyHeadline: 'Ainda Pensando? Veja o Seu Zélla em Ação Ao Vivo',
        adCopyDescription: 'Você visitou o SeuZélla.com e não fechou. Veja agora uma demonstração ao vivo no WhatsApp da sua pousada.',
        targetLandingHook: 'Volte e teste grátis: mande uma mensagem pro Seu Zélla agora e veja a mágica acontecer.',
      },
    ];
  }

  // ─── EXTENSÕES DE SITELINK ──────────────────────────────────────────

  /**
   * Extensões de Sitelink (aparecem abaixo do anúncio principal no Google)
   */
  static getSitelinks(): Array<{ title: string; description: string; url: string }> {
    return [
      { title: 'Planos e Preços', description: 'A partir de R$ 197/mês. Veja qual plano é ideal pro seu tamanho.', url: '/planos' },
      { title: 'Teste ao Vivo no WhatsApp', description: 'Mande uma mensagem agora e veja o Seu Zélla responder em segundos.', url: '/demo-whatsapp' },
      { title: 'Depoimentos de Pousadas', description: 'Veja o que dizem os donos de pousadas que já usam o Seu Zélla.', url: '/depoimentos' },
      { title: 'Como Funciona', description: 'Em 3 minutos você entende tudo. Simples como mandar uma mensagem.', url: '/como-funciona' },
    ];
  }

  // ─── ORÇAMENTO SEMANAL OFICIAL (12 SEMANAS) ─────────────────────────

  /**
   * Roadmap Semanal OFICIAL — Aprovado pelo Fundador
   * Retorna as 12 semanas com valor exato de investimento.
   */
  static getOfficialWeeklyBudgetRoadmap(): Array<{ week: number; month: string; monthNumber: number; budget: number }> {
    return [
      // ── MÊS 1: SETEMBRO 2026 (R$ 2.200) ──
      { week: 1,  month: 'Setembro', monthNumber: 1, budget: 500 },
      { week: 2,  month: 'Setembro', monthNumber: 1, budget: 500 },
      { week: 3,  month: 'Setembro', monthNumber: 1, budget: 600 },
      { week: 4,  month: 'Setembro', monthNumber: 1, budget: 600 },
      // ── MÊS 2: OUTUBRO 2026 (R$ 3.200) ──
      { week: 5,  month: 'Outubro',  monthNumber: 2, budget: 600 },
      { week: 6,  month: 'Outubro',  monthNumber: 2, budget: 600 },
      { week: 7,  month: 'Outubro',  monthNumber: 2, budget: 1000 },
      { week: 8,  month: 'Outubro',  monthNumber: 2, budget: 1000 },
      // ── MÊS 3: NOVEMBRO 2026 (R$ 4.000) [+R$ 200/semana vs Outubro] ──
      { week: 9,  month: 'Novembro', monthNumber: 3, budget: 800 },
      { week: 10, month: 'Novembro', monthNumber: 3, budget: 800 },
      { week: 11, month: 'Novembro', monthNumber: 3, budget: 1200 },
      { week: 12, month: 'Novembro', monthNumber: 3, budget: 1200 },
    ];
  }

  // ─── PROJEÇÃO COMPLETA DE 90 DIAS ───────────────────────────────────

  /**
   * Projeção Completa de 90 Dias — Semana a Semana, Mês a Mês
   *
   * PREMISSAS POR MÊS:
   * ┌─────────────┬───────────┬──────────────────┬──────────────────┬──────────────────────────────────────────────┐
   * │ MÊS         │ CPC MÉDIO │ CONV. LANDING    │ CONV. VENDAS     │ JUSTIFICATIVA                                │
   * ├─────────────┼───────────┼──────────────────┼──────────────────┼──────────────────────────────────────────────┤
   * │ Setembro    │ R$ 3,50   │ 14%              │ 20%              │ Mês de entrada: construindo audiência,       │
   * │             │           │                  │                  │ landing nova, sem remarketing ainda.          │
   * ├─────────────┼───────────┼──────────────────┼──────────────────┼──────────────────────────────────────────────┤
   * │ Outubro     │ R$ 3,30   │ 16%              │ 22%              │ Remarketing ativo (CPC R$1,50 puxa média     │
   * │             │           │                  │                  │ pra baixo), leads mais aquecidos.             │
   * ├─────────────┼───────────┼──────────────────┼──────────────────┼──────────────────────────────────────────────┤
   * │ Novembro    │ R$ 3,10   │ 18%              │ 25%              │ Pré-alta temporada (urgência do anfitrião),   │
   * │             │           │                  │                  │ remarketing maduro, segmentação por dor       │
   * │             │           │                  │                  │ qualifica mais, +R$ 200/sem amplifica tudo.   │
   * └─────────────┴───────────┴──────────────────┴──────────────────┴──────────────────────────────────────────────┘
   */
  static calculate90DaysFullProjection(): CampaignFullProjection {
    const roadmap = ZellaAdsSimulator.getOfficialWeeklyBudgetRoadmap();
    const ticketPRO = 397;

    // Premissas por mês
    const monthParams: Record<number, { cpc: number; landingConv: number; salesConv: number }> = {
      1: { cpc: 3.50, landingConv: 0.14, salesConv: 0.20 },  // Setembro
      2: { cpc: 3.30, landingConv: 0.16, salesConv: 0.22 },  // Outubro
      3: { cpc: 3.10, landingConv: 0.18, salesConv: 0.25 },  // Novembro (+R$200/sem)
    };

    // Calcular semana a semana
    const weeklyEntries: WeeklyBudgetEntry[] = roadmap.map(w => {
      const params = monthParams[w.monthNumber];
      const clicks = Math.floor(w.budget / params.cpc);
      const leads = Math.floor(clicks * params.landingConv);
      const sales = Math.floor(leads * params.salesConv);
      const mrr = sales * ticketPRO;

      return {
        weekNumber: w.week,
        monthLabel: w.month,
        monthNumber: w.monthNumber,
        weeklyBudget: w.budget,
        estimatedClicks: clicks,
        estimatedLeads: leads,
        estimatedSales: sales,
        estimatedMRR: mrr,
      };
    });

    // Agrupar por mês
    let cumulativeSales = 0;
    let cumulativeMRR = 0;

    const months: MonthlyProjection[] = [1, 2, 3].map(mn => {
      const monthLabel = mn === 1 ? 'Setembro 2026' : mn === 2 ? 'Outubro 2026' : 'Novembro 2026';
      const weeks = weeklyEntries.filter(w => w.monthNumber === mn);
      const totalBudget = weeks.reduce((s, w) => s + w.weeklyBudget, 0);
      const totalClicks = weeks.reduce((s, w) => s + w.estimatedClicks, 0);
      const totalLeads = weeks.reduce((s, w) => s + w.estimatedLeads, 0);
      const totalSales = weeks.reduce((s, w) => s + w.estimatedSales, 0);
      const mrrGenerated = totalSales * ticketPRO;

      cumulativeSales += totalSales;
      cumulativeMRR += mrrGenerated;

      return {
        month: monthLabel,
        monthNumber: mn,
        totalBudget,
        weeks,
        totalClicks,
        totalLeads,
        landingConvRate: monthParams[mn].landingConv,
        salesConvRate: monthParams[mn].salesConv,
        totalSales,
        mrrGenerated,
        cumulativeMRR,
        cumulativeSales,
      };
    });

    const totalInvestment = months.reduce((s, m) => s + m.totalBudget, 0);
    const totalClicks = months.reduce((s, m) => s + m.totalClicks, 0);
    const totalLeads = months.reduce((s, m) => s + m.totalLeads, 0);
    const totalSales = months.reduce((s, m) => s + m.totalSales, 0);
    const avgCPC = parseFloat((totalInvestment / totalClicks).toFixed(2));
    const roasRatio = parseFloat((cumulativeMRR / totalInvestment).toFixed(2));

    return {
      campaignName: 'CAMPANHA HOTSPOTS PERMANENTES — 90 Dias (Set/Out/Nov 2026)',
      totalInvestment,
      avgCPC,
      totalClicks,
      totalLeads,
      totalSales,
      finalCumulativeMRR: cumulativeMRR,
      roasRatio,
      months,
    };
  }

  // ─── MÉTODO LEGADO (compatibilidade com testes antigos) ─────────────

  /**
   * Mantido para não quebrar os testes existentes.
   */
  static calculate90DaysContinuousHotspotCampaign() {
    const full = ZellaAdsSimulator.calculate90DaysFullProjection();
    return {
      totalInvestment: full.totalInvestment,
      totalClicks: full.totalClicks,
      totalLeads: full.totalLeads,
      totalClosedSalesPRO: full.totalSales,
      monthlyMRRGenerated: full.finalCumulativeMRR,
      roasRatio: full.roasRatio,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJEÇÃO DE FECHAMENTO DE 2026 (SET → DEZ) COM CHURN MENSAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Projeção de Fechamento de 2026 — Setembro a Dezembro
   *
   * DEZEMBRO: Alta Temporada (+R$ 200/semana seguindo o padrão progressivo)
   * ┌──────────────────────────────────────────────────────────────────┐
   * │  DEZEMBRO 2026 (Total: R$ 4.800,00) [+R$ 200/semana vs Nov]    │
   * │    Semana 13: R$ 1.000  │ Semana 14: R$ 1.000                  │
   * │    Semana 15: R$ 1.400  │ Semana 16: R$ 1.400                  │
   * └──────────────────────────────────────────────────────────────────┘
   *
   * PREMISSAS DE DEZEMBRO:
   * → CPC sobe para R$ 3,40 (competição de anúncios de fim de ano)
   * → Conversão Landing sobe para 20% (urgência MÁXIMA: Réveillon em 3 semanas)
   * → Conversão Vendas sobe para 28% (dono de pousada PRECISA automatizar antes do pico)
   *
   * CHURN MENSAL: 5% (padrão SaaS B2B hoteleiro)
   * → A cada mês, 5% dos clientes existentes cancelam.
   * → Novos clientes se somam aos retidos.
   */
  static calculate2026ClosingProjection(): {
    totalInvestment: number;
    totalNewSalesAllMonths: number;
    monthlyBreakdown: Array<{
      month: string;
      budget: number;
      weeks: Array<{ week: number; budget: number; clicks: number; leads: number; sales: number }>;
      cpc: number;
      landingConvRate: number;
      salesConvRate: number;
      newSalesThisMonth: number;
      retainedFromPrevious: number;
      churnedThisMonth: number;
      activePayingClients: number;
      mrrThisMonth: number;
    }>;
    closing2026: {
      activePayingClients: number;
      mrr: number;
      arr: number;
      totalInvested: number;
      roasOnMRR: number;
    };
  } {
    const ticketPRO = 397;
    const churnRate = 0.05; // 5% mensal

    // Parâmetros por mês (1=Set, 2=Out, 3=Nov, 4=Dez)
    const params: Record<number, { cpc: number; landingConv: number; salesConv: number }> = {
      1: { cpc: 3.50, landingConv: 0.14, salesConv: 0.20 },
      2: { cpc: 3.30, landingConv: 0.16, salesConv: 0.22 },
      3: { cpc: 3.10, landingConv: 0.18, salesConv: 0.25 },
      4: { cpc: 3.40, landingConv: 0.20, salesConv: 0.28 },
    };

    // Orçamento semanal completo (16 semanas: Set a Dez)
    const fullRoadmap = [
      // Set
      { week: 1,  monthNum: 1, month: 'Setembro 2026', budget: 500 },
      { week: 2,  monthNum: 1, month: 'Setembro 2026', budget: 500 },
      { week: 3,  monthNum: 1, month: 'Setembro 2026', budget: 600 },
      { week: 4,  monthNum: 1, month: 'Setembro 2026', budget: 600 },
      // Out
      { week: 5,  monthNum: 2, month: 'Outubro 2026', budget: 600 },
      { week: 6,  monthNum: 2, month: 'Outubro 2026', budget: 600 },
      { week: 7,  monthNum: 2, month: 'Outubro 2026', budget: 1000 },
      { week: 8,  monthNum: 2, month: 'Outubro 2026', budget: 1000 },
      // Nov (+R$200/sem)
      { week: 9,  monthNum: 3, month: 'Novembro 2026', budget: 800 },
      { week: 10, monthNum: 3, month: 'Novembro 2026', budget: 800 },
      { week: 11, monthNum: 3, month: 'Novembro 2026', budget: 1200 },
      { week: 12, monthNum: 3, month: 'Novembro 2026', budget: 1200 },
      // Dez (+R$200/sem) — ALTA TEMPORADA
      { week: 13, monthNum: 4, month: 'Dezembro 2026', budget: 1000 },
      { week: 14, monthNum: 4, month: 'Dezembro 2026', budget: 1000 },
      { week: 15, monthNum: 4, month: 'Dezembro 2026', budget: 1400 },
      { week: 16, monthNum: 4, month: 'Dezembro 2026', budget: 1400 },
    ];

    let previousActiveClients = 0;
    const monthlyBreakdown: Array<{
      month: string;
      budget: number;
      weeks: Array<{ week: number; budget: number; clicks: number; leads: number; sales: number }>;
      cpc: number;
      landingConvRate: number;
      salesConvRate: number;
      newSalesThisMonth: number;
      retainedFromPrevious: number;
      churnedThisMonth: number;
      activePayingClients: number;
      mrrThisMonth: number;
    }>  = [];

    for (let mn = 1; mn <= 4; mn++) {
      const p = params[mn];
      const monthWeeks = fullRoadmap.filter(w => w.monthNum === mn);
      const monthLabel = monthWeeks[0].month;
      const budget = monthWeeks.reduce((s, w) => s + w.budget, 0);

      const weeks = monthWeeks.map(w => {
        const clicks = Math.floor(w.budget / p.cpc);
        const leads = Math.floor(clicks * p.landingConv);
        const sales = Math.floor(leads * p.salesConv);
        return { week: w.week, budget: w.budget, clicks, leads, sales };
      });

      const newSales = weeks.reduce((s, w) => s + w.sales, 0);
      const retained = Math.floor(previousActiveClients * (1 - churnRate));
      const churned = previousActiveClients - retained;
      const activeClients = retained + newSales;
      const mrr = activeClients * ticketPRO;

      monthlyBreakdown.push({
        month: monthLabel,
        budget,
        weeks,
        cpc: p.cpc,
        landingConvRate: p.landingConv,
        salesConvRate: p.salesConv,
        newSalesThisMonth: newSales,
        retainedFromPrevious: retained,
        churnedThisMonth: churned,
        activePayingClients: activeClients,
        mrrThisMonth: mrr,
      });

      previousActiveClients = activeClients;
    }

    const totalInvestment = fullRoadmap.reduce((s, w) => s + w.budget, 0);
    const totalNewSales = monthlyBreakdown.reduce((s, m) => s + m.newSalesThisMonth, 0);
    const finalMonth = monthlyBreakdown[monthlyBreakdown.length - 1];

    return {
      totalInvestment,
      totalNewSalesAllMonths: totalNewSales,
      monthlyBreakdown,
      closing2026: {
        activePayingClients: finalMonth.activePayingClients,
        mrr: finalMonth.mrrThisMonth,
        arr: finalMonth.mrrThisMonth * 12,
        totalInvested: totalInvestment,
        roasOnMRR: parseFloat((finalMonth.mrrThisMonth / totalInvestment).toFixed(2)),
      },
    };
  }
}

/**
 * INTEGRAÇÃO COM O PLAYBOOK DE ESTRUTURAÇÃO COMERCIAL (FULL SALES SYSTEM)
 * Mapeamento dos grupos de anúncios Google Ads aos roteiros de SPIN Selling e esteira de produtos.
 */
export const FULL_SALES_SYSTEM_ADS_INTEGRATION = {
  productTierMatrix: {
    isca: { name: 'VSL Diagnóstico + Teste WhatsApp', price: 0, target: 'Leads de Topo de Funil / Ads' },
    frontEnd: { name: 'Plano PRO (Carro Chefe)', price: 397, target: 'Pousadas 6 a 12 quartos / Anfitriões' },
    parceiroPro: { name: 'Plano Zélla Parceiro PRO', price: 247, target: 'Primeiras 100 pousadas da região' },
    backEnd: { name: 'Conciliação PIX + Locks API', price: 150, target: 'Clientes ativos buscando automação total' },
    highEnd: { name: 'Imersão & Mentoria Hoteleira', price: 2500, target: 'Grandes redes e gerenciadores de >15 imóveis' },
  },

  spinSellingByAdsGroup: {
    1: { group: 'Madrugada', spinStage: 'Implicação', question: 'Quantas reservas você perdeu no mês passado por responder apenas de manhã?' },
    2: { group: 'Distância', spinStage: 'Problema', question: 'Como você faz para entregar senhas quando o hóspede chega fora do horário?' },
    3: { group: 'Overbooking', spinStage: 'Implicação', question: 'Qual foi o prejuízo financeiro e em nota da pousada no último overbooking?' },
    4: { group: 'PIX Manual', spinStage: 'Necessidade', question: 'Se o PIX do hóspede fosse validado em 5s, quanto tempo sua equipe economizaria?' },
    5: { group: 'Concorrência', spinStage: 'Situação', question: 'Em quanto tempo a sua pousada responde o primeiro contato no WhatsApp?' },
    6: { group: 'Feriado', spinStage: 'Problema', question: 'Como sua recepção lida com 50 cotações simultâneas antes do feriado?' },
    7: { group: 'Fechadura Eletrônica', spinStage: 'Necessidade', question: 'Gostaria que o Seu Zélla enviasse o PIN da fechadura assim que a reserva for paga?' },
    8: { group: 'Remarketing', spinStage: 'Fechamento', question: 'Pronto para transformar seu WhatsApp em um canal 24h sem comissão das OTAs?' },
  },

  slaResponseSeconds: 10,
  sdrHandoffThresholdRooms: 6, // Pousadas com >6 quartos agendam call com Closer humano
};

