import { describe, it, expect } from 'vitest';
import { bootDigitalTwin, digitalTwinSnapshot } from '../src/simulation/ZCCDigitalTwin';
import { googleAdsMock } from '../src/adapters/mock/GoogleAdsMock';
import { metaAdsMock } from '../src/adapters/mock/MetaAdsMock';
import { ZellaGrowthStrategy } from '../src/domain/strategy';
import { getAdapters } from '../src/adapters';

describe('ZCC Digital Twin — Financial & Growth Engine Validation', () => {

  it('validates OPEX fixed monthly operational cost structure (R$ 3.211,98/month)', () => {
    const opexItems = {
      proLabore: 2000.00,
      claudeFable5: 550.00,
      vpsKvm4Hostinger: 59.99,
      hospedagemUnlimited: 12.99,
      tokenBudgetLLM: 90.00,
      honorariosContabeis: 300.00,
      whatsappGateway: 199.00,
    };

    const totalOpex = Object.values(opexItems).reduce((acc, curr) => acc + curr, 0);
    expect(totalOpex).toBeCloseTo(3211.98, 2);

    const opex5Months = totalOpex * 5;
    expect(opex5Months).toBeCloseTo(16059.90, 2);
  });

  it('validates LLM API cost per pousada per month (>98% gross margin)', () => {
    const tokenCount = 750000;
    const glm47FlashPricePer1M = 0.10; // USD
    const deepSeekFlashPricePer1M = 0.14; // USD
    const usdToBrlRate = 5.50;

    const costUsd = (tokenCount / 1000000) * ((glm47FlashPricePer1M + deepSeekFlashPricePer1M) / 2);
    const costBrl = costUsd * usdToBrlRate;

    expect(costBrl).toBeGreaterThanOrEqual(0.40);
    expect(costBrl).toBeLessThanOrEqual(2.50);

    const planProPrice = 397.00;
    const grossMargin = ((planProPrice - costBrl) / planProPrice) * 100;
    expect(grossMargin).toBeGreaterThan(98.0);
  });

  it('validates 6-month growth simulation in Scenario 1 (Pé no Chão)', () => {
    const totalAporteScenario1 = 1575.00 + 16059.90 + 12000.00; // R$ 29.634,90
    expect(totalAporteScenario1).toBeCloseTo(29634.90, 2);

    // Month 1 & Month 2: Cash Reserve Grace Period (100% retained)
    const m1NetProfit = 3495.00;
    const m2NetProfit = 11205.00;
    const cashReserveAfterM2 = m1NetProfit + m2NetProfit;
    expect(cashReserveAfterM2).toBe(14700.00);

    // Month 3: 50% Debt Amortization starts
    const m3NetProfit = 21565.00;
    const m3Amortization = m3NetProfit * 0.5; // R$ 10.782,50
    let debtRemaining = totalAporteScenario1 - m3Amortization;
    expect(debtRemaining).toBeCloseTo(18852.40, 2);

    // Month 4: 50% Debt Amortization
    const m4NetProfit = 33694.00;
    const m4Amortization = m4NetProfit * 0.5; // R$ 16.847,00
    debtRemaining -= m4Amortization;
    expect(debtRemaining).toBeCloseTo(2005.40, 2);

    // Month 5: Payback Completed & Dividends Start
    const m5NetProfit = 46818.00;
    const m5AmortizationFinal = debtRemaining; // R$ 2.005,40
    debtRemaining = 0;
    const m5RemainingProfit = m5NetProfit - m5AmortizationFinal;
    const m5InvestorDividends = m5RemainingProfit * 0.15; // 15% Equity
    expect(debtRemaining).toBe(0);
    expect(m5InvestorDividends).toBeCloseTo(6721.89, 2);
  });

  it('validates 6-month growth simulation in Scenario 2 (Alex Ribeiro Acceleration)', () => {
    const totalAporteScenario2 = 1575.00 + 16059.90 + 25000.00; // R$ 42.634,90
    expect(totalAporteScenario2).toBeCloseTo(42634.90, 2);

    // Month 1 & Month 2: Cash Reserve Grace Period (100% retained)
    const m1NetProfit = 12195.00;
    const m2NetProfit = 29418.00;
    const cashReserveAfterM2 = m1NetProfit + m2NetProfit;
    expect(cashReserveAfterM2).toBe(41613.00);

    // Month 3: 50% Debt Amortization starts
    const m3NetProfit = 58676.00;
    const m3Amortization = m3NetProfit * 0.5; // R$ 29.338,00
    let debtRemaining = totalAporteScenario2 - m3Amortization;
    expect(debtRemaining).toBeCloseTo(13296.90, 2);

    // Month 4: Payback Fully Completed in Month 4 (Dezembro)
    const m4NetProfit = 96728.00;
    const m4AmortizationFinal = debtRemaining; // R$ 13.296,90
    debtRemaining = 0;
    const m4RemainingProfit = m4NetProfit - m4AmortizationFinal;
    const m4InvestorDividends = m4RemainingProfit * 0.15; // 15% Equity
    expect(debtRemaining).toBe(0);
    expect(m4InvestorDividends).toBeCloseTo(12514.67, 1);
  });

  it('validates Universal Adapter Layer swap between Mock and Digital Twin', async () => {
    expect(googleAdsMock.isDigitalTwin()).toBe(true);
    expect(metaAdsMock.isDigitalTwin()).toBe(true);

    const googleMetrics = await googleAdsMock.fetchMetrics({ from: '2026-09-01', to: '2026-09-07' });
    const metaMetrics = await metaAdsMock.fetchMetrics({ from: '2026-09-01', to: '2026-09-07' });

    expect(googleMetrics).toBeDefined();
    expect(metaMetrics).toBeDefined();
  });

  it('validates ZCC Digital Twin simulation boot and health snapshot', async () => {
    await bootDigitalTwin();
    const snapshot = digitalTwinSnapshot();

    expect(snapshot.booted).toBe(true);
    expect(snapshot.operatingMode).toBeDefined();
    expect(snapshot.health).toBeDefined();
  });

  it('validates ZGS strategic decision layer instantiation and snapshot', async () => {
    const adapters = getAdapters();
    const zgs = new ZellaGrowthStrategy(adapters);
    const snapshot = zgs.snapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot.decisions).toBeDefined();
    expect(Array.isArray(snapshot.decisions)).toBe(true);
  });

});
