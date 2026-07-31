/**
 * SEUZÉLLA — MÓDULO DE SIMULAÇÃO E INTELIGÊNCIA DE GOOGLE ADS & AUDIÊNCIA
 * Treina o Cérebro Zélla para entender termos de busca de alta intenção,
 * segmentação geográfica (ex: Ubatuba, Maresias, Praia do Rosa) e perfis das planilhas reais.
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

export interface TargetAudienceProfile {
  region: string;
  cities: string[];
  averageRooms: string;
  primaryPainPoint: string;
  winningAngle: string;
}

export class ZellaAdsSimulator {
  /**
   * Mapeamento de Campanhas de Rede de Pesquisa de Alta Intenção no Google Ads
   */
  static getGoogleAdsCampaigns(): GoogleAdsKeywordCampaign[] {
    return [
      {
        keyword: 'automação whatsapp pousada',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.80,
        adCopyHeadline: 'Recepção 24h no WhatsApp para Pousadas | SeuZélla AI',
        adCopyDescription: 'Responda hóspedes em segundos com tom de voz humano, forneça a chave PIX e evite overbooking.',
        targetLandingHook: 'Cansado de perder reservas de madrugada no WhatsApp da sua pousada?',
      },
      {
        keyword: 'bot whatsapp para airbnb',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 3.20,
        adCopyHeadline: 'Atendimento Automático para Airbnb | SeuZélla',
        adCopyDescription: 'O Zelador Virtual que envia senha de fechadura eletrônica e atende seus hóspedes 24 horas.',
        targetLandingHook: 'Transforme o WhatsApp do seu imóvel de temporada numa máquina de reservas.',
      },
      {
        keyword: 'sistema atendimento pousada whatsapp',
        matchType: 'EXACT',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 4.50,
        adCopyHeadline: 'Sistema de Atendimento para Pousadas | SeuZélla PRO',
        adCopyDescription: 'Plano PRO ideal para 6 a 12 quartos por R$ 397/mês. Experimente o SeuZélla ao vivo.',
        targetLandingHook: 'Conheça o SeuZélla: o zelador inteligente da sua pousada no WhatsApp.',
      },
      {
        keyword: 'como responder hospedes rapido no whatsapp',
        matchType: 'PHRASE',
        intentCategory: 'PROBLEM_AWARE',
        estimatedCPC: 2.10,
        adCopyHeadline: 'Nunca Mais Perca uma Reserva de Madrugada',
        adCopyDescription: 'Deixe o Seu Zélla responder dúvidas de check-in, localização e chave PIX com educação.',
        targetLandingHook: 'Atendimento instantâneo para hóspedes sem você precisar encostar no celular.',
      },
    ];
  }

  /**
   * Perfis de Público-Alvo Extraídos das Planilhas de Leads Validadas
   */
  static getTargetAudienceProfiles(): TargetAudienceProfile[] {
    return [
      {
        region: 'Litoral Norte de SP (352 Ubatuba, 333 São Sebastião/Maresias, 154 Caraguatatuba)',
        cities: ['Ubatuba', 'São Sebastião', 'Caraguatatuba', 'Bertioga', 'Ilhabela'],
        averageRooms: '6 a 12 quartos (Perfil Plano PRO R$ 397/mês)',
        primaryPainPoint: 'Perda de reservas de fim de semana por demora na resposta no WhatsApp durante a alta temporada.',
        winningAngle: 'Recepção 24h atenta para garantir reservas de turistas de SP e Vale do Paraíba instantaneamente.',
      },
      {
        region: 'Santa Catarina (Praia do Rosa / Imbituba / Floripa)',
        cities: ['Imbituba', 'Florianópolis', 'Garopaba'],
        averageRooms: '4 a 10 chalés/pousadas',
        primaryPainPoint: 'Gestão remota de hóspedes e fornecimento de senha de fechadura eletrônica/chave PIX.',
        winningAngle: 'Automatize o atendimento dos seus chalés e pousadas na praia sem perder o atendimento humanizado.',
      },
    ];
  }

  /**
   * Calcula o Retorno Estimado sobre Investimento (ROAS) em Campanhas de Teste Inicial
   */
  static calculateTestCampaignBudget(dailyBudgetBRL: number): {
    monthlyInvestment: number;
    estimatedClicks: number;
    estimatedLeads: number;
    estimatedClosedSales: number;
    projectedMRR: number;
    roasRatio: number;
  } {
    const monthlyInvestment = dailyBudgetBRL * 30;
    const avgCPC = 3.40;
    const estimatedClicks = Math.floor(monthlyInvestment / avgCPC);
    const landingPageConvRate = 0.12; // 12% de conversão na Landing Page com o widget do Zélla
    const estimatedLeads = Math.floor(estimatedClicks * landingPageConvRate);
    const salesConvRate = 0.20; // 20% dos leads fecham o Plano PRO (R$ 397/mês) ou Oferta Parceiro (R$ 247/mês)
    const estimatedClosedSales = Math.floor(estimatedLeads * salesConvRate);
    const avgTicket = 397; // Plano PRO Carro Chefe
    const projectedMRR = estimatedClosedSales * avgTicket;
    const roasRatio = projectedMRR > 0 ? projectedMRR / monthlyInvestment : 0;

    return {
      monthlyInvestment,
      estimatedClicks,
      estimatedLeads,
      estimatedClosedSales,
      projectedMRR,
      roasRatio: parseFloat(roasRatio.toFixed(2)),
    };
  }
}
