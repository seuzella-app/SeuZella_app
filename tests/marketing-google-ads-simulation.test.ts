import { describe, it, expect } from 'vitest';
import { ZellaAdsSimulator } from '../src/lib/marketing/zella-ads-simulator';
import { ZellaSalesBrain } from '../src/lib/cerebro/zella-sales-brain';

// ═══════════════════════════════════════════════════════════════════════════
// PILAR 1: HOTSPOTS PERMANENTES & CÉREBRO ZÉLLA
// ═══════════════════════════════════════════════════════════════════════════

describe('PILAR 1: Hotspots Permanentes & Treinamento do Cérebro Zélla', () => {
  it('1. Cérebro Zélla deve responder sobre Airbnb com fechadura e chave PIX', async () => {
    const res = await ZellaSalesBrain.processMessage('Como o Seu Zélla funciona para quem tem chalé no Airbnb em Maresias?', []);
    expect(res.success).toBe(true);
    expect(res.reply).toContain('fechaduras eletrônicas');
    expect(res.reply).toContain('chave PIX');
  });

  it('2. Deve mapear 6 clusters de hotspots permanentes (SC, PR, SP, RJ, BA, AL/PE/CE)', () => {
    const clusters = ZellaAdsSimulator.getPermanentHotspotClusters();
    expect(clusters.length).toBe(6);

    const states = clusters.map(c => c.state);
    expect(states).toContain('SC');
    expect(states).toContain('PR');
    expect(states).toContain('SP');
    expect(states).toContain('RJ');
    expect(states).toContain('BA');
    expect(states).toContain('AL_PE_CE');
  });

  it('3. Cluster SC deve incluir Praia do Rosa, Imbituba e Florianópolis', () => {
    const sc = ZellaAdsSimulator.getPermanentHotspotClusters().find(c => c.state === 'SC');
    expect(sc?.hotspots).toContain('Praia do Rosa');
    expect(sc?.hotspots).toContain('Imbituba');
    expect(sc?.hotspots).toContain('Florianópolis');
  });

  it('4. Cluster SP deve incluir Ubatuba, Maresias e Praia Grande', () => {
    const sp = ZellaAdsSimulator.getPermanentHotspotClusters().find(c => c.state === 'SP');
    expect(sp?.hotspots).toContain('Ubatuba');
    expect(sp?.hotspots.some(h => h.includes('Maresias'))).toBe(true);
    expect(sp?.hotspots).toContain('Praia Grande');
  });

  it('5. Cluster BA deve incluir Trancoso, Itacaré e Morro de São Paulo', () => {
    const ba = ZellaAdsSimulator.getPermanentHotspotClusters().find(c => c.state === 'BA');
    expect(ba?.hotspots).toContain('Trancoso');
    expect(ba?.hotspots).toContain('Itacaré');
    expect(ba?.hotspots).toContain('Morro de São Paulo');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PILAR 2: 8 GRUPOS DE ANÚNCIOS SEGMENTADOS POR DOR
// ═══════════════════════════════════════════════════════════════════════════

describe('PILAR 2: 8 Grupos de Anúncios Segmentados por Dor do Anfitrião', () => {
  it('6. Deve conter exatamente 8 grupos de anúncios', () => {
    const campaigns = ZellaAdsSimulator.getGoogleAdsCampaigns();
    expect(campaigns.length).toBe(8);
  });

  it('7. Cada grupo deve ter um ID único de 1 a 8', () => {
    const campaigns = ZellaAdsSimulator.getGoogleAdsCampaigns();
    const ids = campaigns.map(c => c.groupId);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('8. ZERO palavras proibidas (IA, Bot, Inteligência Artificial) em todos os anúncios', () => {
    const campaigns = ZellaAdsSimulator.getGoogleAdsCampaigns();
    const forbidden = ['\\bIA\\b', '\\bBot\\b', 'Inteligência Artificial'];

    for (const campaign of campaigns) {
      for (const pattern of forbidden) {
        const regex = new RegExp(pattern, 'i');
        expect(campaign.adCopyHeadline).not.toMatch(regex);
        expect(campaign.adCopyDescription).not.toMatch(regex);
        expect(campaign.targetLandingHook).not.toMatch(regex);
      }
    }
  });

  it('9. Grupo 8 (Remarketing) deve ter CPC <= R$ 1,50 e matchType BROAD', () => {
    const remarketing = ZellaAdsSimulator.getGoogleAdsCampaigns().find(c => c.groupId === 8);
    expect(remarketing).toBeDefined();
    expect(remarketing!.estimatedCPC).toBeLessThanOrEqual(1.50);
    expect(remarketing!.matchType).toBe('BROAD');
    expect(remarketing!.intentCategory).toBe('REMARKETING');
  });

  it('10. Deve conter 4 extensões de sitelink estratégicas', () => {
    const sitelinks = ZellaAdsSimulator.getSitelinks();
    expect(sitelinks.length).toBe(4);
    const titles = sitelinks.map(s => s.title);
    expect(titles).toContain('Planos e Preços');
    expect(titles).toContain('Teste ao Vivo no WhatsApp');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PILAR 3: ORÇAMENTO SEMANAL OFICIAL (12 SEMANAS)
// ═══════════════════════════════════════════════════════════════════════════

describe('PILAR 3: Orçamento Semanal Oficial — Aprovado pelo Fundador', () => {
  const roadmap = ZellaAdsSimulator.getOfficialWeeklyBudgetRoadmap();

  it('11. Deve conter exatamente 12 semanas', () => {
    expect(roadmap.length).toBe(12);
  });

  it('12. Mês 1 (Setembro): R$500 + R$500 + R$600 + R$600 = R$ 2.200', () => {
    const setembro = roadmap.filter(w => w.monthNumber === 1);
    expect(setembro.length).toBe(4);
    expect(setembro[0].budget).toBe(500);
    expect(setembro[1].budget).toBe(500);
    expect(setembro[2].budget).toBe(600);
    expect(setembro[3].budget).toBe(600);
    const total = setembro.reduce((s, w) => s + w.budget, 0);
    expect(total).toBe(2200);
  });

  it('13. Mês 2 (Outubro): R$600 + R$600 + R$1.000 + R$1.000 = R$ 3.200', () => {
    const outubro = roadmap.filter(w => w.monthNumber === 2);
    expect(outubro.length).toBe(4);
    expect(outubro[0].budget).toBe(600);
    expect(outubro[1].budget).toBe(600);
    expect(outubro[2].budget).toBe(1000);
    expect(outubro[3].budget).toBe(1000);
    const total = outubro.reduce((s, w) => s + w.budget, 0);
    expect(total).toBe(3200);
  });

  it('14. Mês 3 (Novembro +R$200/sem): R$800 + R$800 + R$1.200 + R$1.200 = R$ 4.000', () => {
    const novembro = roadmap.filter(w => w.monthNumber === 3);
    expect(novembro.length).toBe(4);
    expect(novembro[0].budget).toBe(800);
    expect(novembro[1].budget).toBe(800);
    expect(novembro[2].budget).toBe(1200);
    expect(novembro[3].budget).toBe(1200);
    const total = novembro.reduce((s, w) => s + w.budget, 0);
    expect(total).toBe(4000);
  });

  it('15. Investimento total dos 90 dias deve ser exatamente R$ 9.400', () => {
    const total = roadmap.reduce((s, w) => s + w.budget, 0);
    expect(total).toBe(9400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PILAR 4: PROJEÇÃO COMPLETA DE 90 DIAS (CLIQUES, LEADS, VENDAS, MRR)
// ═══════════════════════════════════════════════════════════════════════════

describe('PILAR 4: Projeção Completa de 90 Dias — Cliques, Leads, Vendas, MRR', () => {
  const projection = ZellaAdsSimulator.calculate90DaysFullProjection();

  it('16. Investimento total deve ser R$ 9.400', () => {
    expect(projection.totalInvestment).toBe(9400);
  });

  it('17. Projeção deve conter 3 meses', () => {
    expect(projection.months.length).toBe(3);
  });

  it('18. Setembro: CPC R$ 3,50, conversão landing 14%, vendas 20%', () => {
    const set = projection.months[0];
    expect(set.month).toBe('Setembro 2026');
    expect(set.totalBudget).toBe(2200);
    expect(set.landingConvRate).toBe(0.14);
    expect(set.salesConvRate).toBe(0.20);
    expect(set.totalClicks).toBeGreaterThan(0);
    expect(set.totalLeads).toBeGreaterThan(0);
    expect(set.totalSales).toBeGreaterThan(0);
  });

  it('19. Outubro: conversão landing sobe para 16%, vendas para 22% (remarketing ativo)', () => {
    const out = projection.months[1];
    expect(out.month).toBe('Outubro 2026');
    expect(out.totalBudget).toBe(3200);
    expect(out.landingConvRate).toBe(0.16);
    expect(out.salesConvRate).toBe(0.22);
    expect(out.totalClicks).toBeGreaterThan(projection.months[0].totalClicks);
  });

  it('20. Novembro: conversão landing sobe para 18%, vendas para 25% (pré-alta temporada + remarketing maduro)', () => {
    const nov = projection.months[2];
    expect(nov.month).toBe('Novembro 2026');
    expect(nov.totalBudget).toBe(4000);
    expect(nov.landingConvRate).toBe(0.18);
    expect(nov.salesConvRate).toBe(0.25);
    expect(nov.totalClicks).toBeGreaterThan(projection.months[1].totalClicks);
    expect(nov.totalSales).toBeGreaterThan(projection.months[1].totalSales);
  });

  it('21. Cada semana deve ter cliques, leads, vendas e MRR calculados', () => {
    for (const month of projection.months) {
      expect(month.weeks.length).toBe(4);
      for (const week of month.weeks) {
        expect(week.weeklyBudget).toBeGreaterThan(0);
        expect(week.estimatedClicks).toBeGreaterThan(0);
        expect(week.estimatedLeads).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('22. MRR acumulado deve crescer progressivamente a cada mês', () => {
    const mrrSet = projection.months[0].cumulativeMRR;
    const mrrOut = projection.months[1].cumulativeMRR;
    const mrrNov = projection.months[2].cumulativeMRR;
    expect(mrrOut).toBeGreaterThan(mrrSet);
    expect(mrrNov).toBeGreaterThan(mrrOut);
  });

  it('23. Vendas acumuladas devem crescer progressivamente', () => {
    const salesSet = projection.months[0].cumulativeSales;
    const salesOut = projection.months[1].cumulativeSales;
    const salesNov = projection.months[2].cumulativeSales;
    expect(salesOut).toBeGreaterThan(salesSet);
    expect(salesNov).toBeGreaterThan(salesOut);
  });

  it('24. ROAS final deve ser positivo (investimento recuperado)', () => {
    expect(projection.roasRatio).toBeGreaterThan(1);
  });

  it('25. Método legado calculate90DaysContinuousHotspotCampaign() deve manter compatibilidade', () => {
    const legacy = ZellaAdsSimulator.calculate90DaysContinuousHotspotCampaign();
    expect(legacy.totalInvestment).toBe(9400);
    expect(legacy.totalClicks).toBe(projection.totalClicks);
    expect(legacy.totalLeads).toBe(projection.totalLeads);
    expect(legacy.totalClosedSalesPRO).toBe(projection.totalSales);
  });
});
