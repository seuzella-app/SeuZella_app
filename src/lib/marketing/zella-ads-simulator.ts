/**
 * SEUZÉLLA — MÓDULO DE INTELIGÊNCIA DE MARKETING & ESTRATÉGIA COMERCIAL (PLAYBOOK)
 * Aplicação contínua da campanha em TODOS OS HOTSPOTS DE ALTO FLUXO DO BRASIL durante os 90 dias (Setembro, Outubro, Novembro).
 *
 * REGRA ABSOLUTA DE MARKETING:
 * PROIBIDO o uso das palavras "IA", "Bot" ou "Inteligência Artificial".
 * Usar sempre: "Seu Zélla", "Zelador Virtual", "Recepcionista no WhatsApp 24h por dia", "Atendimento para Pousadas".
 */

export interface PermanentHotspotCluster {
  state: string;
  regionName: string;
  hotspots: string[];
  propertyFocus: 'POUSADAS_DOMINANTE' | 'AIRBNB_TEMPORADA_DOMINANTE' | 'HÍBRIDO';
  primaryPain: string;
  salesPitchAngle: string;
}

export interface GoogleAdsKeywordCampaign {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  intentCategory: 'HIGH_INTENTION' | 'PROBLEM_AWARE' | 'COMPETITOR';
  estimatedCPC: number;
  adCopyHeadline: string;
  adCopyDescription: string;
  targetLandingHook: string;
}

export class ZellaAdsSimulator {
  /**
   * Mapeamento dos Hotspots Permanentes de Alto Fluxo Turístico no Brasil (Ativos em Set, Out e Nov 2026)
   */
  static getPermanentHotspotClusters(): PermanentHotspotCluster[] {
    return [
      // 1. Santa Catarina
      {
        state: 'SC',
        regionName: 'Litoral Catarinense & Capital',
        hotspots: ['Imbituba', 'Praia do Rosa', 'Garopaba', 'Guarda do Embaú', 'Florianópolis', 'Bombinhas', 'Balneário Camboriú'],
        propertyFocus: 'HÍBRIDO',
        primaryPain: 'Gestão remota de chalés/pousadas e fornecimento instantâneo de chave PIX do anfitrião.',
        salesPitchAngle: 'Atendimento humanizado 24h no WhatsApp para praias de SC sem perda de reservas de fim de semana.',
      },
      // 2. Paraná
      {
        state: 'PR',
        regionName: 'Ilha do Mel & Litoral Paranaense',
        hotspots: ['Ilha do Mel', 'Paranaguá'],
        propertyFocus: 'POUSADAS_DOMINANTE',
        primaryPain: 'Dúvidas de travessia de barco, horários de check-in e atendimento fora do horário comercial.',
        salesPitchAngle: 'Responda dúvidas de passeios e travessia 24h por dia e garanta a reserva do hóspede no ato.',
      },
      // 3. São Paulo (Litoral Norte & Baixada Santista)
      {
        state: 'SP',
        regionName: 'Litoral Norte SP & Baixada Santista',
        hotspots: ['Ubatuba', 'São Sebastião (Maresias, Juquehy, Camburi)', 'Ilhabela', 'Caraguatatuba', 'Bertioga', 'Praia Grande', 'Santos', 'Guarujá'],
        propertyFocus: 'AIRBNB_TEMPORADA_DOMINANTE',
        primaryPain: 'Perda massiva de reservas no WhatsApp durante as sextas-feiras e madrugadas pré-feriado.',
        salesPitchAngle: 'Recepção 24h no WhatsApp com tom acolhedor para a maior concentração de turistas de SP.',
      },
      // 4. Rio de Janeiro
      {
        state: 'RJ',
        regionName: 'Região dos Lagos & Costa Verde',
        hotspots: ['Saquarema', 'Arraial do Cabo', 'Búzios', 'Paraty', 'Angra dos Reis'],
        propertyFocus: 'HÍBRIDO',
        primaryPain: 'Concorrência acirrada entre pousadas e necessidade de fechamento rápido antes que o hóspede chame outra.',
        salesPitchAngle: 'Atendimento instantâneo de reservas no WhatsApp para não dar margem para a concorrência.',
      },
      // 5. Bahia
      {
        state: 'BA',
        regionName: 'Costa do Descobrimento & Litoral Baiano',
        hotspots: ['Porto Seguro', 'Trancoso', 'Arraial d’Ajuda', 'Itacaré', 'Morro de São Paulo', 'Costa do Sauípe'],
        propertyFocus: 'POUSADAS_DOMINANTE',
        primaryPain: 'Atendimento a turistas de todo o Brasil e envio de dados de pagamento e confirmação.',
        salesPitchAngle: 'O zelador virtual da sua pousada na Bahia: recepção calorosa e confirmação de reserva 24 horas por dia.',
      },
      // 6. Alagoas / Pernambuco / Ceará
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

  /**
   * Campanhas de Anúncios Direcionadas nos Hotspots (Zero palavras proibidas!)
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
   * Simulação de Investimento de R$ 1.000/semana em 90 dias (Set, Out, Nov 2026) nos Hotspots Continuos
   */
  static calculate90DaysContinuousHotspotCampaign(): {
    totalInvestment: number;
    totalClicks: number;
    totalLeads: number;
    totalClosedSalesPRO: number;
    monthlyMRRGenerated: number;
    roasRatio: number;
  } {
    const totalInvestment = 12000; // R$ 1.000/semana x 12 semanas
    const avgCPC = 3.50;
    const totalClicks = Math.floor(totalInvestment / avgCPC); // ~3.428 cliques
    const landingConvRate = 0.15; // 15% conversão nos Hotspots Fixos
    const totalLeads = Math.floor(totalClicks * landingConvRate); // ~514 leads
    const salesConvRate = 0.22; // 22% fecham o Plano PRO (R$ 397/mês)
    const totalClosedSalesPRO = Math.floor(totalLeads * salesConvRate); // ~113 vendas
    const monthlyMRRGenerated = totalClosedSalesPRO * 397; // R$ 44.861/mês MRR
    const roasRatio = parseFloat((monthlyMRRGenerated / totalInvestment).toFixed(2));

    return {
      totalInvestment,
      totalClicks,
      totalLeads,
      totalClosedSalesPRO,
      monthlyMRRGenerated,
      roasRatio,
    };
  }
}
