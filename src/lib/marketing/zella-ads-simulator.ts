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
   * Campanhas de Anúncios Direcionadas nos Hotspots — CAMPANHA A (Base: R$ 1.000/semana)
   * Zero palavras proibidas!
   */
  static getGoogleAdsCampaignsA(): GoogleAdsKeywordCampaign[] {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPANHA B — ORÇAMENTO REFORÇADO: R$ 1.200/semana (+ R$ 200/semana)
  // Todos os Hotspots Permanentes Ativos em Set, Out e Nov 2026
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Campanha B: 8 Grupos de Anúncios Segmentados por Dor do Anfitrião + Remarketing
   * Investimento: R$ 1.200/semana x 12 semanas = R$ 14.400 em 90 dias
   *
   * ESTRUTURA DA CAMPANHA B:
   * ┌────────────────────────────────────────────────────────────────────┐
   * │  GRUPO 1: Dor da Madrugada (Pousadas que perdem reservas à noite)│
   * │  GRUPO 2: Dor da Distância (Airbnb gerido a distância)           │
   * │  GRUPO 3: Dor do Overbooking (Pousadas sem controle de quartos)  │
   * │  GRUPO 4: Dor do PIX Manual (Demora no envio de dados de pgto)   │
   * │  GRUPO 5: Dor da Concorrência (Hóspede vai pra outra pousada)    │
   * │  GRUPO 6: Dor do Feriado (Explosão de msgs em feriados longos)   │
   * │  GRUPO 7: Dor da Fechadura (Check-in sem recepção presencial)    │
   * │  GRUPO 8: Remarketing (Retargeting de quem visitou a landing)    │
   * └────────────────────────────────────────────────────────────────────┘
   */
  static getGoogleAdsCampaignsB(): GoogleAdsKeywordCampaign[] {
    return [
      // ── GRUPO 1: Dor da Madrugada ──
      {
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
        keyword: 'check-in remoto pousada fechadura eletrônica',
        matchType: 'PHRASE',
        intentCategory: 'HIGH_INTENTION',
        estimatedCPC: 4.00,
        adCopyHeadline: 'Check-in Sem Recepção Presencial | Seu Zélla',
        adCopyDescription: 'O Seu Zélla envia a senha da fechadura eletrônica no horário certo do check-in. Sem atrasos, sem stress.',
        targetLandingHook: 'Hóspede chegou de madrugada? Senha enviada automaticamente. Zero problemas.',
      },
      // ── GRUPO 8: Remarketing (Retargeting de visitantes da Landing Page) ──
      {
        keyword: 'remarketing_visitantes_landing_seuzella',
        matchType: 'BROAD',
        intentCategory: 'COMPETITOR',
        estimatedCPC: 1.50,
        adCopyHeadline: 'Ainda Pensando? Veja o Seu Zélla em Ação Ao Vivo',
        adCopyDescription: 'Você visitou o SeuZélla.com e não fechou. Veja agora uma demonstração ao vivo no WhatsApp da sua pousada.',
        targetLandingHook: 'Volte e teste grátis: mande uma mensagem pro Seu Zélla agora e veja a mágica acontecer.',
      },
    ];
  }

  /**
   * Extensões de Sitelink da Campanha B (aparecem abaixo do anúncio no Google)
   */
  static getCampaignBSitelinks(): Array<{ title: string; description: string; url: string }> {
    return [
      { title: 'Planos e Preços', description: 'A partir de R$ 197/mês. Veja qual plano é ideal pro seu tamanho.', url: '/planos' },
      { title: 'Teste ao Vivo no WhatsApp', description: 'Mande uma mensagem agora e veja o Seu Zélla responder em segundos.', url: '/demo-whatsapp' },
      { title: 'Depoimentos de Pousadas', description: 'Veja o que dizem os donos de pousadas que já usam o Seu Zélla.', url: '/depoimentos' },
      { title: 'Como Funciona', description: 'Em 3 minutos você entende tudo. Simples como mandar uma mensagem.', url: '/como-funciona' },
    ];
  }

  /**
   * Distribuição Semanal do Orçamento da Campanha B (R$ 1.200/semana x 12 semanas)
   *
   * ESTRATÉGIA DE ALOCAÇÃO POR GRUPO:
   * - 30% → Grupos de Alta Intenção (Overbooking, Fechadura, Feriado) = R$ 360/sem
   * - 30% → Grupos de Dor Principal (Madrugada, PIX, Concorrência) = R$ 360/sem
   * - 25% → Grupos de Airbnb/Temporada (Distância, Remarketing) = R$ 300/sem
   * - 15% → Remarketing puro (Retargeting de visitantes) = R$ 180/sem
   */
  static getCampaignBWeeklyBudgetAllocation(): Array<{
    groupName: string;
    weeklyBudget: number;
    percentOfTotal: number;
    targetGroups: string[];
  }> {
    return [
      {
        groupName: 'Alta Intenção (Overbooking + Fechadura + Feriado)',
        weeklyBudget: 360,
        percentOfTotal: 30,
        targetGroups: ['Grupo 3: Overbooking', 'Grupo 7: Fechadura', 'Grupo 6: Feriado'],
      },
      {
        groupName: 'Dor Principal (Madrugada + PIX + Concorrência)',
        weeklyBudget: 360,
        percentOfTotal: 30,
        targetGroups: ['Grupo 1: Madrugada', 'Grupo 4: PIX Manual', 'Grupo 5: Concorrência'],
      },
      {
        groupName: 'Airbnb & Temporada (Distância + Captação)',
        weeklyBudget: 300,
        percentOfTotal: 25,
        targetGroups: ['Grupo 2: Distância Airbnb', 'Grupo 8: Remarketing'],
      },
      {
        groupName: 'Remarketing Puro (Retargeting Landing Page)',
        weeklyBudget: 180,
        percentOfTotal: 15,
        targetGroups: ['Grupo 8: Remarketing'],
      },
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULAÇÕES DE INVESTIMENTO: CAMPANHA A vs. CAMPANHA B
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Simulação CAMPANHA A — R$ 1.000/semana x 12 semanas = R$ 12.000 em 90 dias
   */
  static calculate90DaysCampaignA(): {
    campaignName: string;
    weeklyBudget: number;
    totalInvestment: number;
    avgCPC: number;
    totalClicks: number;
    landingConvRate: number;
    totalLeads: number;
    salesConvRate: number;
    totalClosedSalesPRO: number;
    ticketMensal: number;
    monthlyMRRGenerated: number;
    roasRatio: number;
  } {
    const weeklyBudget = 1000;
    const totalInvestment = weeklyBudget * 12;
    const avgCPC = 3.50;
    const totalClicks = Math.floor(totalInvestment / avgCPC);
    const landingConvRate = 0.15;
    const totalLeads = Math.floor(totalClicks * landingConvRate);
    const salesConvRate = 0.22;
    const totalClosedSalesPRO = Math.floor(totalLeads * salesConvRate);
    const ticketMensal = 397;
    const monthlyMRRGenerated = totalClosedSalesPRO * ticketMensal;
    const roasRatio = parseFloat((monthlyMRRGenerated / totalInvestment).toFixed(2));

    return {
      campaignName: 'CAMPANHA A — Base Hotspots Contínuos',
      weeklyBudget,
      totalInvestment,
      avgCPC,
      totalClicks,
      landingConvRate,
      totalLeads,
      salesConvRate,
      totalClosedSalesPRO,
      ticketMensal,
      monthlyMRRGenerated,
      roasRatio,
    };
  }

  /**
   * Simulação CAMPANHA B — R$ 1.200/semana x 12 semanas = R$ 14.400 em 90 dias
   *
   * HIPÓTESE DO AUMENTO DE +R$ 200/SEMANA:
   * → CPC médio cai ligeiramente (de R$ 3,50 para R$ 3,30) porque o remarketing (CPC R$ 1,50) puxa a média para baixo.
   * → Conversão da Landing Page sobe de 15% para 17% porque o remarketing traz visitantes já aquecidos.
   * → Taxa de fechamento sobe de 22% para 24% porque os anúncios segmentados por dor específica
   *   geram leads mais qualificados (quem busca "evitar overbooking" já sabe que TEM o problema).
   */
  static calculate90DaysCampaignB(): {
    campaignName: string;
    weeklyBudget: number;
    totalInvestment: number;
    avgCPC: number;
    totalClicks: number;
    landingConvRate: number;
    totalLeads: number;
    salesConvRate: number;
    totalClosedSalesPRO: number;
    ticketMensal: number;
    monthlyMRRGenerated: number;
    roasRatio: number;
    incrementalVsCampaignA: {
      extraInvestment: number;
      extraClicks: number;
      extraLeads: number;
      extraSales: number;
      extraMRR: number;
    };
  } {
    const weeklyBudget = 1200;
    const totalInvestment = weeklyBudget * 12; // R$ 14.400
    const avgCPC = 3.30; // CPC menor graças ao remarketing (CPC R$1,50) puxando a média
    const totalClicks = Math.floor(totalInvestment / avgCPC); // ~4.363 cliques
    const landingConvRate = 0.17; // 17% conversão (remarketing traz leads já aquecidos)
    const totalLeads = Math.floor(totalClicks * landingConvRate); // ~741 leads
    const salesConvRate = 0.24; // 24% fechamento (anúncios segmentados por dor = lead mais qualificado)
    const totalClosedSalesPRO = Math.floor(totalLeads * salesConvRate); // ~177 vendas
    const ticketMensal = 397;
    const monthlyMRRGenerated = totalClosedSalesPRO * ticketMensal; // R$ 70.269/mês MRR
    const roasRatio = parseFloat((monthlyMRRGenerated / totalInvestment).toFixed(2));

    // Comparação incremental com Campanha A
    const campA = ZellaAdsSimulator.calculate90DaysCampaignA();

    return {
      campaignName: 'CAMPANHA B — Hotspots + Segmentação por Dor + Remarketing',
      weeklyBudget,
      totalInvestment,
      avgCPC,
      totalClicks,
      landingConvRate,
      totalLeads,
      salesConvRate,
      totalClosedSalesPRO,
      ticketMensal,
      monthlyMRRGenerated,
      roasRatio,
      incrementalVsCampaignA: {
        extraInvestment: totalInvestment - campA.totalInvestment,
        extraClicks: totalClicks - campA.totalClicks,
        extraLeads: totalLeads - campA.totalLeads,
        extraSales: totalClosedSalesPRO - campA.totalClosedSalesPRO,
        extraMRR: monthlyMRRGenerated - campA.monthlyMRRGenerated,
      },
    };
  }

  /**
   * Método legado — mantido para compatibilidade com testes existentes.
   * Redireciona para calculate90DaysCampaignA().
   */
  static calculate90DaysContinuousHotspotCampaign() {
    const a = ZellaAdsSimulator.calculate90DaysCampaignA();
    return {
      totalInvestment: a.totalInvestment,
      totalClicks: a.totalClicks,
      totalLeads: a.totalLeads,
      totalClosedSalesPRO: a.totalClosedSalesPRO,
      monthlyMRRGenerated: a.monthlyMRRGenerated,
      roasRatio: a.roasRatio,
    };
  }

  /**
   * Método legado — mantido para compatibilidade com testes existentes.
   */
  static getGoogleAdsCampaigns(): GoogleAdsKeywordCampaign[] {
    return ZellaAdsSimulator.getGoogleAdsCampaignsA();
  }
}
