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

  it('3. Simulador Campanha A (R$ 1.000/semana): Deve projetar MRR > R$ 40.000/mês', () => {
    const simulation = ZellaAdsSimulator.calculate90DaysContinuousHotspotCampaign();
    expect(simulation.totalInvestment).toBe(12000);
    expect(simulation.totalClicks).toBeGreaterThan(3000);
    expect(simulation.totalLeads).toBeGreaterThan(500);
    expect(simulation.totalClosedSalesPRO).toBeGreaterThan(100);
    expect(simulation.monthlyMRRGenerated).toBeGreaterThan(40000);
    expect(simulation.roasRatio).toBeGreaterThan(3.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMPANHA B — R$ 1.200/semana (+ R$ 200/semana)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAMPANHA B: ORÇAMENTO REFORÇADO R$ 1.200/SEMANA — Segmentação por Dor + Remarketing', () => {
  it('4. Campanha B deve conter 8 grupos de anúncios segmentados por dor do anfitrião', () => {
    const campaignsB = ZellaAdsSimulator.getGoogleAdsCampaignsB();
    expect(campaignsB.length).toBe(8);

    // Verificar que cada grupo cobre uma dor diferente
    const keywords = campaignsB.map(c => c.keyword);
    expect(keywords).toContain('perder reservas madrugada pousada');
    expect(keywords).toContain('gerenciar airbnb a distância whatsapp');
    expect(keywords).toContain('evitar overbooking pousada');
    expect(keywords).toContain('enviar pix automatico hospede pousada');
    expect(keywords).toContain('responder hospede antes da concorrência');
    expect(keywords).toContain('atendimento pousada feriado prolongado');
    expect(keywords).toContain('check-in remoto pousada fechadura eletrônica');
    expect(keywords).toContain('remarketing_visitantes_landing_seuzella');
  });

  it('5. ZERO palavras proibidas em TODOS os anúncios da Campanha B', () => {
    const campaignsB = ZellaAdsSimulator.getGoogleAdsCampaignsB();
    const forbidden = ['IA', 'Bot', 'Inteligência Artificial'];

    for (const campaign of campaignsB) {
      for (const word of forbidden) {
        // Verificação case-sensitive para "IA" e "Bot" como palavras inteiras
        const regex = new RegExp(`\\b${word}\\b`, word === 'Inteligência Artificial' ? 'i' : undefined);
        expect(campaign.adCopyHeadline).not.toMatch(regex);
        expect(campaign.adCopyDescription).not.toMatch(regex);
        expect(campaign.targetLandingHook).not.toMatch(regex);
      }
    }
  });

  it('6. Remarketing (Grupo 8) deve ter CPC significativamente menor que a média', () => {
    const campaignsB = ZellaAdsSimulator.getGoogleAdsCampaignsB();
    const remarketing = campaignsB.find(c => c.keyword.includes('remarketing'));
    expect(remarketing).toBeDefined();
    expect(remarketing!.estimatedCPC).toBeLessThanOrEqual(1.50);
    expect(remarketing!.matchType).toBe('BROAD');
  });

  it('7. Extensões de Sitelink da Campanha B: Deve conter 4 sitelinks estratégicos', () => {
    const sitelinks = ZellaAdsSimulator.getCampaignBSitelinks();
    expect(sitelinks.length).toBe(4);
    const titles = sitelinks.map(s => s.title);
    expect(titles).toContain('Planos e Preços');
    expect(titles).toContain('Teste ao Vivo no WhatsApp');
    expect(titles).toContain('Depoimentos de Pousadas');
    expect(titles).toContain('Como Funciona');
  });

  it('8. Distribuição de Orçamento Semanal: Deve somar 100% e R$ 1.200/semana', () => {
    const allocation = ZellaAdsSimulator.getCampaignBWeeklyBudgetAllocation();
    const totalPercent = allocation.reduce((sum, a) => sum + a.percentOfTotal, 0);
    const totalBudget = allocation.reduce((sum, a) => sum + a.weeklyBudget, 0);
    expect(totalPercent).toBe(100);
    expect(totalBudget).toBe(1200);
  });

  it('9. Simulação Campanha B (R$ 1.200/semana): Deve projetar MRR > R$ 65.000/mês', () => {
    const simB = ZellaAdsSimulator.calculate90DaysCampaignB();
    expect(simB.campaignName).toContain('CAMPANHA B');
    expect(simB.weeklyBudget).toBe(1200);
    expect(simB.totalInvestment).toBe(14400);
    expect(simB.avgCPC).toBeLessThan(3.50); // CPC menor graças ao remarketing
    expect(simB.totalClicks).toBeGreaterThan(4000);
    expect(simB.landingConvRate).toBeGreaterThan(0.15); // Remarketing aquece leads
    expect(simB.totalLeads).toBeGreaterThan(700);
    expect(simB.salesConvRate).toBeGreaterThan(0.22); // Segmentação por dor = mais qualificação
    expect(simB.totalClosedSalesPRO).toBeGreaterThan(170);
    expect(simB.monthlyMRRGenerated).toBeGreaterThan(65000);
    expect(simB.roasRatio).toBeGreaterThan(4.5); // ROAS superior à Campanha A
  });

  it('10. Comparação Incremental: Campanha B deve gerar mais vendas que A com apenas +R$ 2.400 de investimento extra', () => {
    const simB = ZellaAdsSimulator.calculate90DaysCampaignB();
    const inc = simB.incrementalVsCampaignA;

    expect(inc.extraInvestment).toBe(2400); // +R$ 200/sem x 12 sem = R$ 2.400
    expect(inc.extraClicks).toBeGreaterThan(900);
    expect(inc.extraLeads).toBeGreaterThan(200);
    expect(inc.extraSales).toBeGreaterThan(60);
    expect(inc.extraMRR).toBeGreaterThan(25000); // +R$ 25.000/mês MRR incremental
  });

  it('11. Campanha A (legado) continua funcionando via método getGoogleAdsCampaigns()', () => {
    const campaignsLegacy = ZellaAdsSimulator.getGoogleAdsCampaigns();
    const campaignsA = ZellaAdsSimulator.getGoogleAdsCampaignsA();
    expect(campaignsLegacy.length).toBe(campaignsA.length);
    expect(campaignsLegacy[0].keyword).toBe(campaignsA[0].keyword);
  });
});
