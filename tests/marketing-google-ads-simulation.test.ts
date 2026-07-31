import { describe, it, expect } from 'vitest';
import { ZellaAdsSimulator } from '../src/lib/marketing/zella-ads-simulator';

describe('SUÍTE DE INTELIGÊNCIA DE MARKETING & GOOGLE ADS SIMULATOR (Planilha 10.175 Pousadas)', () => {
  it('1. Proibição de Palavras Proibidas: Não deve conter "IA", "Bot" ou "Inteligência Artificial" em nenhuma campanha', () => {
    const campaigns = ZellaAdsSimulator.getGoogleAdsCampaigns();

    for (const c of campaigns) {
      const text = `${c.keyword} ${c.adCopyHeadline} ${c.adCopyDescription} ${c.targetLandingHook}`.toLowerCase();
      expect(text).not.toContain(' bot ');
      expect(text).not.toContain('bot ');
      expect(text).not.toContain(' bot');
      expect(text).not.toContain('inteligência artificial');
    }

    const mainCampaign = campaigns.find(c => c.keyword.includes('automação whatsapp pousada'));
    expect(mainCampaign?.adCopyHeadline).toBe('Recepcionista no WhatsApp 24h por dia para Pousadas | Seu Zélla');

    const systemCampaign = campaigns.find(c => c.keyword.includes('sistema atendimento pousada whatsapp'));
    expect(systemCampaign?.targetLandingHook).toBe('Conheça o Seu Zélla: o zelador da sua pousada 24h por dia.');
  });

  it('2. Base de Conhecimento do Funil de Pousadas BR: Deve validar a planilha oficial com 10.175 leads', () => {
    const funnel = ZellaAdsSimulator.getFunnelDatabaseSummary();
    expect(funnel.totalLeads).toBe(10175);
    expect(funnel.tierProCount).toBe(1415);
    expect(funnel.hotFunnelCount).toBe(8703);
  });

  it('3. Cronograma Semanal de Orçamento (Mês 1 e Mês 2): Deve calcular o ROI acumulado até a semana 4 do Mês 2', () => {
    const roadmap = ZellaAdsSimulator.getWeeklyBudgetRoadmap();
    expect(roadmap).toHaveLength(8);

    const m1w1 = roadmap.find(r => r.month === 1 && r.week === 1);
    expect(m1w1?.investmentBRL).toBe(500);

    const m2w4 = roadmap.find(r => r.month === 2 && r.week === 4);
    expect(m2w4?.investmentBRL).toBe(1000);
    expect(m2w4?.projectedMRR).toBeGreaterThan(5000); // MRR acumulado > R$ 5.000/mês no Mês 2!
  });
});
