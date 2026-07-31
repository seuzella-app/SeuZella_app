/**
 * SEUZÉLLA — MÓDULO DE INTELIGÊNCIA DE MARKETING: 3 CAMPANHAS DE FERIADOS PROLONGADOS & HOTSPOTS
 * Estratégia hiper-focada para os Feriados Prolongados de Setembro, Outubro e Novembro de 2026 nos principais polos turísticos do Brasil.
 *
 * REGRA ABSOLUTA DE MARKETING:
 * PROIBIDO o uso das palavras "IA", "Bot" ou "Inteligência Artificial".
 * Usar sempre: "Seu Zélla", "Zelador Virtual", "Recepcionista no WhatsApp 24h por dia", "Atendimento para Pousadas".
 */

export interface HolidayCampaignSpec {
  monthName: 'Setembro' | 'Outubro' | 'Novembro';
  holidayName: string;
  targetHotspots: string[];
  primaryKeyword: string;
  adCopyHeadline: string;
  adCopyDescription: string;
  landingPageHook: string;
  salesTrigger: string;
}

export class ZellaAdsSimulator {
  /**
   * Retorna as 3 Campanhas Mensais Estratégicas de Feriados Prolongados nos Hotspots do Brasil
   */
  static getMonthlyHolidayCampaigns(): HolidayCampaignSpec[] {
    return [
      // 1. SETEMBRO 2026 — Feriado da Independência (7 de Setembro)
      {
        monthName: 'Setembro',
        holidayName: 'Feriado de 7 de Setembro (Independência - Fim de Semana Prolongado)',
        targetHotspots: [
          'Ubatuba (SP)',
          'São Sebastião / Maresias (SP)',
          'Ilhabela (SP)',
          'Búzios (RJ)',
          'Paraty (RJ)',
          'Praia do Rosa (SC)',
          'Florianópolis (SC)'
        ],
        primaryKeyword: 'recepcionista whatsapp pousada feriado',
        adCopyHeadline: 'Feriado de 7 de Setembro: Recepção 24h | Seu Zélla',
        adCopyDescription: 'Não perca reservas de fim de semana prolongado. O Seu Zélla atende seus hóspedes no WhatsApp e fornece a chave PIX do anfitrião.',
        landingPageHook: 'Sua pousada está pronta para o fluxo de reservas do feriado de 7 de Setembro?',
        salesTrigger: 'Atendimento instantâneo de reservas durante todo o fim de semana prolongado sem você precisar encostar no celular.',
      },

      // 2. OUTUBRO 2026 — Feriado de 12 de Outubro (Nossa Sra. Aparecida / Dia das Crianças)
      {
        monthName: 'Outubro',
        holidayName: 'Feriado de 12 de Outubro (Aparecida / Crianças - Fim de Semana Prolongado)',
        targetHotspots: [
          'Campos do Jordão (SP)',
          'Monte Verde (MG)',
          'Caldas Novas (GO)',
          'Pirenópolis (GO)',
          'Porto de Galinhas (PE)',
          'Maragogi (AL)',
          'Pipa (RN)'
        ],
        primaryKeyword: 'atendimento pousada whatsapp 12 outubro',
        adCopyHeadline: 'Feriado de 12 de Outubro na Pousada | Seu Zélla',
        adCopyDescription: 'Recepcionista no WhatsApp 24h por dia para atender famílias e confirmar reservas instantaneamente.',
        landingPageHook: 'Não deixe o WhatsApp da sua hospedagem congestionar no feriado de 12 de Outubro!',
        salesTrigger: 'Evite filas no check-in e responda dúvidas sobre quartos, localização e senhas de fechadura 24 horas por dia.',
      },

      // 3. NOVEMBRO 2026 — Feriados de 02 e 15/20 de Novembro + Esquenta Alta Temporada de Réveillon
      {
        monthName: 'Novembro',
        holidayName: 'Feriados de Novembro (Finados & Proclamação) + Esquenta Réveillon / Verão',
        targetHotspots: [
          'Trancoso (BA)',
          'Itacaré (BA)',
          'Arraial d’Ajuda (BA)',
          'Gramado (RS)',
          'Canela (RS)',
          'Maresias (SP)',
          'Praia do Rosa (SC)',
          'Jericoacoara (CE)'
        ],
        primaryKeyword: 'sistema atendimento pousada reveillon',
        adCopyHeadline: 'Esquenta Réveillon & Novembro | Seu Zélla PRO',
        adCopyDescription: 'Garanta o Seu Zélla na sua pousada por R$ 247/mês antes da explosão de reservas da Alta Temporada de Verão.',
        landingPageHook: 'Prepare a recepção da sua pousada para a maior Alta Temporada do ano com o Seu Zélla.',
        salesTrigger: 'Aproveite os feriados de Novembro para testar o Seu Zélla antes da loucura do Réveillon e Janeiro.',
      },
    ];
  }

  /**
   * Simulação de Investimento de R$ 1.000/semana em 90 dias (Set, Out, Nov 2026) nos Hotspots
   */
  static calculate90DaysHotspotCampaign(): {
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
    const landingConvRate = 0.14; // 14% de conversão nos Hotspots nos Feriados
    const totalLeads = Math.floor(totalClicks * landingConvRate); // ~480 leads
    const salesConvRate = 0.20; // 20% fecham o Plano PRO (R$ 397/mês)
    const totalClosedSalesPRO = Math.floor(totalLeads * salesConvRate); // ~96 vendas
    const monthlyMRRGenerated = totalClosedSalesPRO * 397; // R$ 38.112/mês MRR
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
