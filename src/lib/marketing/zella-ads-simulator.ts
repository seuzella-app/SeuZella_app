/**
 * SEUZÉLLA — MÓDULO DE INTELIGÊNCIA E SIMULAÇÃO DE GOOGLE ADS & FUNIL DE POUSADAS BR
 * Calibrado estritamente conforme a planilha oficial de 10.175 pousadas (Planilha_Funil_pousadas_BR_.xlsx).
 *
 * REGRA ABSOLUTA DE MARKETING:
 * PROIBIDO o uso das palavras "IA", "Bot" ou "Inteligência Artificial".
 * Usar sempre: "Seu Zélla", "Zelador Virtual", "Recepcionista no WhatsApp 24h por dia", "Atendimento para Pousadas".
 */

export interface GoogleAdsKeywordCampaign {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  intentCategory: 'HIGH_INTENTION' | 'PROBLEM_AWARE' | 'COMPETITOR';
  estimatedCPC: number;
  adCopyHeadline: string;
  adCopyDescription: string;
  targetLandingHook: string;
}

export interface WeeklyBudgetPlan {
  month: 1 | 2;
  week: 1 | 2 | 3 | 4;
  investmentBRL: number;
  expectedClicks: number;
  expectedLeads: number;
  expectedSalesPRO: number;
  projectedMRR: number;
}

export class ZellaAdsSimulator {
  /**
   * Mapeamento de Campanhas da Rede de Pesquisa (Zero palavras proibidas!)
   */
  static getGoogleAdsCampaigns(): GoogleAdsKeywordCampaign[] {
    return [
      {
        keyword: 'automação whatsapp pousada',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.80,
        adCopyHeadline: 'Recepcionista no WhatsApp 24h por dia para Pousadas | Seu Zélla',
        adCopyDescription: 'Responda hóspedes em segundos com tom de voz humano, forneça a chave PIX do anfitrião e evite overbooking.',
        targetLandingHook: 'Cansado de perder reservas de madrugada no WhatsApp da sua pousada?',
      },
      {
        keyword: 'atendimento whatsapp para airbnb',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.20,
        adCopyHeadline: 'Atendimento Automático para Airbnb | Seu Zélla',
        adCopyDescription: 'O Zelador Virtual que envia senha de fechadura eletrônica e atende seus hóspedes 24 horas por dia.',
        targetLandingHook: 'Transforme o WhatsApp do seu imóvel de temporada numa máquina de reservas.',
      },
      {
        keyword: 'sistema atendimento pousada whatsapp',
        matchType: 'EXACT',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 4.50,
        adCopyHeadline: 'Sistema de Atendimento para Pousadas | Seu Zélla',
        adCopyDescription: 'Plano PRO ideal para 6 a 12 quartos por R$ 397/mês. Experimente o Seu Zélla ao vivo.',
        targetLandingHook: 'Conheça o Seu Zélla: o zelador da sua pousada 24h por dia.',
      },
      {
        keyword: 'como responder hospedes rapido no whatsapp',
        matchType: 'PHRASE',
        intentCategory: 'PROBLEM_AWARE',
        estimatedCPC: 2.10,
        adCopyHeadline: 'Nunca Mais Perca uma Reserva de Madrugada',
        adCopyDescription: 'Deixe o Seu Zélla responder dúvidas de check-in, localização e chave PIX do anfitrião com educação.',
        targetLandingHook: 'Atendimento instantâneo para hóspedes sem você precisar encostar no celular.',
      },
    ];
  }

  /**
   * Retorna os dados estatísticos consolidados da planilha oficial Planilha_Funil_pousadas_BR_.xlsx (10.175 leads)
   */
  static getFunnelDatabaseSummary() {
    return {
      totalLeads: 10175,
      tierProCount: 1415,    // Pousadas 6-12 quartos (Plano PRO R$ 397/mês)
      tierMaxCount: 8703,    // Pousadas 13-20 quartos (Plano MAX R$ 797/mês)
      tierLiteCount: 57,     // Imóveis 1-4 quartos (Plano LITE R$ 197/mês)
      hotFunnelCount: 8703,  // Leads com alta intenção de contratação
      warmFunnelCount: 1415,
      topRegions: ['Bahia (Corumbau, Trancoso, Itacaré)', 'Litoral Norte SP (Ubatuba, Maresias)', 'Santa Catarina (Praia do Rosa, Floripa)'],
    };
  }

  /**
   * Cronograma de Orçamento Semanal Real de Vendas (Mês 1 e Mês 2)
   */
  static getWeeklyBudgetRoadmap(): WeeklyBudgetPlan[] {
    const avgCPC = 3.50;
    const landingConvRate = 0.12; // 12% conversão na Landing Page
    const salesConvRate = 0.18;   // 18% fecha Plano PRO (R$ 397/mês) ou Parceiro PRO (R$ 247/mês)
    const proTicket = 397;

    const rawPlan = [
      { month: 1, week: 1, investmentBRL: 500 },
      { month: 1, week: 2, investmentBRL: 500 },
      { month: 1, week: 3, investmentBRL: 600 },
      { month: 1, week: 4, investmentBRL: 600 },
      { month: 2, week: 1, investmentBRL: 600 },
      { month: 2, week: 2, investmentBRL: 600 },
      { month: 2, week: 3, investmentBRL: 1000 },
      { month: 2, week: 4, investmentBRL: 1000 },
    ];

    let accumulatedSales = 0;

    return rawPlan.map(item => {
      const clicks = Math.floor(item.investmentBRL / avgCPC);
      const leads = Math.floor(clicks * landingConvRate);
      const sales = Math.max(1, Math.floor(leads * salesConvRate));
      accumulatedSales += sales;
      const mrr = accumulatedSales * proTicket;

      return {
        month: item.month as 1 | 2,
        week: item.week as 1 | 2 | 3 | 4,
        investmentBRL: item.investmentBRL,
        expectedClicks: clicks,
        expectedLeads: leads,
        expectedSalesPRO: sales,
        projectedMRR: mrr,
      };
    });
  }
}
