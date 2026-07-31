import { describe, it, expect } from 'vitest';
import { ZellaAdsSimulator } from '../src/lib/marketing/zella-ads-simulator';
import { ZellaSalesBrain } from '../src/lib/cerebro/zella-sales-brain';

describe('SUÍTE DE INTELIGÊNCIA DE MARKETING: FERIADOS PROLONGADOS & HOTSPOTS (Set, Out, Nov 2026)', () => {
  it('1. Treinamento de Feriados no Cérebro Zélla: Deve responder sobre feriados prolongados e pré-alta temporada', async () => {
    const res = await ZellaSalesBrain.processMessage('Como o Seu Zélla funciona no feriado de 7 de setembro?', []);
    expect(res.success).toBe(true);
    expect(res.reply).toContain('feriados prolongados');
    expect(res.reply).toContain('chave PIX');
  });

  it('2. 3 Campanhas Mensais de Feriados nos Hotspots: Deve conter estratégias focadas para Set, Out, Nov 2026', () => {
    const campaigns = ZellaAdsSimulator.getMonthlyHolidayCampaigns();
    expect(campaigns).toHaveLength(3);

    const sept = campaigns.find(c => c.monthName === 'Setembro');
    expect(sept?.targetHotspots).toContain('Ubatuba (SP)');
    expect(sept?.targetHotspots).toContain('Praia do Rosa (SC)');

    const oct = campaigns.find(c => c.monthName === 'Outubro');
    expect(oct?.targetHotspots).toContain('Campos do Jordão (SP)');
    expect(oct?.targetHotspots).toContain('Caldas Novas (GO)');

    const nov = campaigns.find(c => c.monthName === 'Novembro');
    expect(nov?.targetHotspots).toContain('Trancoso (BA)');
    expect(nov?.targetHotspots).toContain('Gramado (RS)');
  });

  it('3. Simulador de 90 Dias nos Hotspots (R$ 1.000/semana): Deve projetar faturamento recorrente > R$ 35.000/mês', () => {
    const simulation = ZellaAdsSimulator.calculate90DaysHotspotCampaign();
    expect(simulation.totalInvestment).toBe(12000);
    expect(simulation.totalClicks).toBeGreaterThan(3000);
    expect(simulation.totalLeads).toBeGreaterThan(400);
    expect(simulation.totalClosedSalesPRO).toBeGreaterThan(80);
    expect(simulation.monthlyMRRGenerated).toBeGreaterThan(35000); // MRR > R$ 35.000/mês
    expect(simulation.roasRatio).toBeGreaterThan(3.0); // ROAS > 3x
  });
});
