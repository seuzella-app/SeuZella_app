import { describe, it, expect } from 'vitest';
import { ZellaAdsSimulator } from '../src/lib/marketing/zella-ads-simulator';
import { ZellaSalesBrain } from '../src/lib/cerebro/zella-sales-brain';

describe('SUÍTE DE INTELIGÊNCIA DE MARKETING: HOTSPOTS PERMANENTES & PLAYBOOK COMERCIAL', () => {
  it('1. Treinamento de Airbnb e Temporada no Cérebro Zélla: Deve responder sobre fechadura e automação remota', async () => {
    const res = await ZellaSalesBrain.processMessage('Como o Seu Zélla funciona para quem tem chalé no Airbnb em Maresias?', []);
    expect(res.success).toBe(true);
    expect(res.reply).toContain('fechaduras eletrônicas');
    expect(res.reply).toContain('chave PIX');
  });

  it('2. Clusters Permanentes de Hotspots: Deve mapear todas as regiões turísticas de alto fluxo (SC, PR, SP, RJ, BA, AL, PE, CE)', () => {
    const clusters = ZellaAdsSimulator.getPermanentHotspotClusters();
    expect(clusters.length).toBeGreaterThanOrEqual(6);

    const sc = clusters.find(c => c.state === 'SC');
    expect(sc?.hotspots).toContain('Praia do Rosa');
    expect(sc?.hotspots).toContain('Imbituba');
    expect(sc?.hotspots).toContain('Florianópolis');

    const sp = clusters.find(c => c.state === 'SP');
    expect(sp?.hotspots).toContain('Ubatuba');
    expect(sp?.hotspots.some(h => h.includes('Maresias'))).toBe(true);
    expect(sp?.hotspots).toContain('Praia Grande');

    const ba = clusters.find(c => c.state === 'BA');
    expect(ba?.hotspots).toContain('Trancoso');
    expect(ba?.hotspots).toContain('Itacaré');
    expect(ba?.hotspots).toContain('Morro de São Paulo');
  });

  it('3. Simulador de 90 Dias Contínuos nos Hotspots (R$ 1.000/semana): Deve projetar faturamento recorrente > R$ 40.000/mês', () => {
    const simulation = ZellaAdsSimulator.calculate90DaysContinuousHotspotCampaign();
    expect(simulation.totalInvestment).toBe(12000);
    expect(simulation.totalClicks).toBeGreaterThan(3000);
    expect(simulation.totalLeads).toBeGreaterThan(500);
    expect(simulation.totalClosedSalesPRO).toBeGreaterThan(100);
    expect(simulation.monthlyMRRGenerated).toBeGreaterThan(40000); // MRR > R$ 40.000/mês
    expect(simulation.roasRatio).toBeGreaterThan(3.5); // ROAS > 3.5x
  });
});
