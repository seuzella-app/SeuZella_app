// ============================================================================
// Statistical Ads Simulator
// ----------------------------------------------------------------------------
// Wraps the GoogleAdsMock and MetaAdsMock adapters to:
//   - Run simulated campaigns for a configurable period
//   - Emit `metrics.googleAds` / `metrics.metaAds` events on the ZCB
//     so the Growth Cortex ingests them
//   - Support A/B experiments (campaign A vs campaign B over N days)
//
// This module is what teaches the ZGS about CAC, CTR, CPA BEFORE any real
// Google Ads account exists.
// ============================================================================

import type { CognitiveEvent } from '@/domain/zcc';
import { zcb } from '@/domain/zcc';
import { getAdapters } from '@/adapters';
import { mulberry32, seedFromString } from '@/adapters/mock';

export interface AdsSimulationConfig {
  /** Number of days to simulate. Default 30. */
  days?: number;
  /** Google Ads campaigns to simulate. Each gets a R$50/day default budget. */
  googleAdsCampaigns?: { name: string; budgetDailyBRL: number; adGroupKey: string; keywords: string[] }[];
  /** Meta Ads campaigns to simulate. */
  metaAdsCampaigns?: { name: string; budgetDailyBRL: number; audienceKey: string; placement: 'facebook_feed' | 'instagram_feed' | 'instagram_stories' | 'audience_network' }[];
  /** Seed for reproducibility. */
  seed?: number;
  /** Whether to publish events on the ZCB. Default true. */
  publishEvents?: boolean;
  /** Start date (ISO). Default: today minus `days`. */
  startDate?: string;
}

export interface AdsSimulationResult {
  googleAds: {
    campaignId: string;
    name: string;
    totalSpendBRL: number;
    totalConversions: number;
    avgCPC: number;
    avgCTR: number;
    avgCPA: number;
    avgCAC: number;
  }[];
  metaAds: {
    campaignId: string;
    name: string;
    totalSpendBRL: number;
    totalConversions: number;
    avgCPC: number;
    avgCTR: number;
    avgCPA: number;
    avgCAC: number;
  }[];
  eventsEmitted: number;
}

export class AdsSimulator {
  /**
   * Run a multi-day simulation of Google Ads + Meta Ads campaigns.
   */
  async run(config: AdsSimulationConfig = {}): Promise<AdsSimulationResult> {
    const days = config.days ?? 30;
    const seed = config.seed ?? 42;
    const publish = config.publishEvents ?? true;
    const startDate = config.startDate
      ? new Date(config.startDate)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    const range = { from: startDate.toISOString(), to: endDate.toISOString() };

    const { googleAds, metaAds } = getAdapters();

    // 1. Create Google Ads campaigns (or reuse if already created).
    const gAdsCampaigns: { campaignId: string; name: string }[] = [];
    for (const c of config.googleAdsCampaigns ?? [{ name: 'Sim Default GAds', budgetDailyBRL: 50, adGroupKey: 'pousada-praia-grande', keywords: ['pousada praia grande'] }]) {
      const out = await googleAds.createCampaign({
        name: c.name,
        budgetDailyBRL: c.budgetDailyBRL,
        adGroupKey: c.adGroupKey,
        keywords: c.keywords,
        matchType: 'phrase',
        geoTargets: ['BR'],
        landingUrl: 'https://zella.com.br/l/pousada-praia-grande',
      });
      gAdsCampaigns.push({ campaignId: out.campaignId, name: c.name });
    }

    // 2. Create Meta campaigns.
    const metaCampaigns: { campaignId: string; name: string }[] = [];
    for (const c of config.metaAdsCampaigns ?? [{ name: 'Sim Default Meta', budgetDailyBRL: 50, audienceKey: 'lookalike-pousada-sp', placement: 'instagram_feed' as const }]) {
      const out = await metaAds.createCampaign({
        name: c.name,
        budgetDailyBRL: c.budgetDailyBRL,
        audienceKey: c.audienceKey,
        placement: c.placement,
        creative: { headline: 'Conheça o Zélla', body: 'Assistente inteligente para pousadas' },
        geoTargets: ['BR'],
        landingUrl: 'https://zella.com.br/l/pousada-praia-grande',
      });
      metaCampaigns.push({ campaignId: out.campaignId, name: c.name });
    }

    // 3. Fetch metrics for the range.
    const gMetrics = await googleAds.fetchMetrics(range);
    const mMetrics = await metaAds.fetchMetrics(range);

    // 4. Emit events.
    let eventsEmitted = 0;
    if (publish) {
      for (const m of gMetrics) {
        await zcb.publish(this.makeMetricEvent('metrics.googleAds', m));
        eventsEmitted++;
      }
      for (const m of mMetrics) {
        await zcb.publish(this.makeMetricEvent('metrics.metaAds', m));
        eventsEmitted++;
      }
    }

    // 5. Aggregate.
    const googleAgg = this.aggregateGAds(gAdsCampaigns, gMetrics);
    const metaAgg = this.aggregateMeta(metaCampaigns, mMetrics);

    return {
      googleAds: googleAgg,
      metaAds: metaAgg,
      eventsEmitted,
    };
  }

  private makeMetricEvent(type: string, m: Record<string, unknown> | object): CognitiveEvent {
    const seed = seedFromString(`${type}:${(m as { campaignId?: string }).campaignId}:${(m as { date?: string }).date}`);
    const rng = mulberry32(seed);
    return {
      id: `evt_metrics_${type.replace(/\./g, '_')}_${(m as { campaignId?: string }).campaignId}_${(m as { date?: string }).date}_${Math.floor(rng() * 1e6).toString(36)}`,
      source: 'growth',
      type,
      severity: 'info',
      payload: m,
      occurredAt: new Date().toISOString(),
    };
  }

  private aggregateGAds(campaigns: { campaignId: string; name: string }[], metrics: any[]): AdsSimulationResult['googleAds'] {
    return campaigns.map((c) => {
      const rows = metrics.filter((m) => m.campaignId === c.campaignId);
      const totalSpend = rows.reduce((s, r) => s + r.spendBRL, 0);
      const totalConv = rows.reduce((s, r) => s + r.conversions, 0);
      const avgCPC = rows.length > 0 ? rows.reduce((s, r) => s + r.cpcBRL, 0) / rows.length : 0;
      const avgCTR = rows.length > 0 ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0;
      const avgCPA = totalConv > 0 ? totalSpend / totalConv : 0;
      const cacRows = rows.filter((r) => r.cacBRL !== undefined && r.cacBRL > 0);
      const avgCAC = cacRows.length > 0 ? cacRows.reduce((s, r) => s + r.cacBRL, 0) / cacRows.length : 0;
      return {
        campaignId: c.campaignId,
        name: c.name,
        totalSpendBRL: Number(totalSpend.toFixed(2)),
        totalConversions: totalConv,
        avgCPC: Number(avgCPC.toFixed(2)),
        avgCTR: Number(avgCTR.toFixed(4)),
        avgCPA: Number(avgCPA.toFixed(2)),
        avgCAC: Number(avgCAC.toFixed(2)),
      };
    });
  }

  private aggregateMeta(campaigns: { campaignId: string; name: string }[], metrics: any[]): AdsSimulationResult['metaAds'] {
    return campaigns.map((c) => {
      const rows = metrics.filter((m) => m.campaignId === c.campaignId);
      const totalSpend = rows.reduce((s, r) => s + r.spendBRL, 0);
      const totalConv = rows.reduce((s, r) => s + r.conversions, 0);
      const avgCPC = rows.length > 0 ? rows.reduce((s, r) => s + r.cpcBRL, 0) / rows.length : 0;
      const avgCTR = rows.length > 0 ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0;
      const avgCPA = totalConv > 0 ? totalSpend / totalConv : 0;
      const cacRows = rows.filter((r) => r.cacBRL !== undefined && r.cacBRL > 0);
      const avgCAC = cacRows.length > 0 ? cacRows.reduce((s, r) => s + r.cacBRL, 0) / cacRows.length : 0;
      return {
        campaignId: c.campaignId,
        name: c.name,
        totalSpendBRL: Number(totalSpend.toFixed(2)),
        totalConversions: totalConv,
        avgCPC: Number(avgCPC.toFixed(2)),
        avgCTR: Number(avgCTR.toFixed(4)),
        avgCPA: Number(avgCPA.toFixed(2)),
        avgCAC: Number(avgCAC.toFixed(2)),
      };
    });
  }
}

export const adsSimulator = new AdsSimulator();
