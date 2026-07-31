import { describe, it, expect } from 'vitest';
import { ZellaAdsSimulator } from '../src/lib/marketing/zella-ads-simulator';

describe('SUÍTE DE INTELIGÊNCIA DE MARKETING & GOOGLE ADS SIMULATOR', () => {
  it('1. Campanhas de Pesquisa: Deve retornar palavras-chave de alta intenção e estratégias de anúncio', () => {
    const campaigns = ZellaAdsSimulator.getGoogleAdsCampaigns();
    expect(campaigns.length).toBeGreaterThan(0);

    const highIntent = campaigns.filter(c => c.intentCategory === 'HIGH_INTENTION');
    expect(highIntent.length).toBeGreaterThanOrEqual(3);

    const mainCampaign = campaigns.find(c => c.keyword.includes('automação whatsapp pousada'));
    expect(mainCampaign).toBeDefined();
    expect(mainCampaign?.adCopyHeadline).toContain('SeuZélla');
  });

  it('2. Segmentação de Público-Alvo: Deve refletir perfis reais extraídos do Litoral SP e SC', () => {
    const profiles = ZellaAdsSimulator.getTargetAudienceProfiles();
    expect(profiles).toHaveLength(2);

    const spProfile = profiles.find(p => p.region.includes('Litoral Norte de SP'));
    expect(spProfile).toBeDefined();
    expect(spProfile?.cities).toContain('Ubatuba');
    expect(spProfile?.cities).toContain('São Sebastião');
  });

  it('3. Simulador Financeiro de Teste (ROI & ROAS): Deve calcular investimento inicial de R$ 50/dia com retorno positivo', () => {
    const simulation = ZellaAdsSimulator.calculateTestCampaignBudget(50); // R$ 50/dia (R$ 1.500/mês)

    expect(simulation.monthlyInvestment).toBe(1500);
    expect(simulation.estimatedClicks).toBeGreaterThan(400);
    expect(simulation.estimatedLeads).toBeGreaterThan(40);
    expect(simulation.estimatedClosedSales).toBeGreaterThan(8);
    expect(simulation.projectedMRR).toBeGreaterThan(3000); // Faturamento recorrente > R$ 3.000/mês
    expect(simulation.roasRatio).toBeGreaterThan(2.0); // Retorno sobre investimento > 2x no primeiro mês!
  });
});
