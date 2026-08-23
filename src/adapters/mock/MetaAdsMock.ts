// ============================================================================
// MetaAdsMock — ZCC Digital Twin implementation of IMetaAdsAdapter
// ----------------------------------------------------------------------------
// Meta typically has higher CTR but lower intent than Google Ads.
//   - CTR ~ Beta(α=3, β=50)   → mean ~6%
//   - CPC ~ LogNormal(μ=-1.6, σ=0.5) → mean ~R$ 0.80 (cheaper than Google)
//   - Conversion rate ~ Beta(α=2, β=120) → ~1.7% (lower intent)
// ============================================================================

import type {
  IMetaAdsAdapter,
  MetaAdsCampaignInput,
  MetaAdsCampaignOutput,
  MetaAdsMetric,
  MetaAdsQueryRange,
} from '../interfaces';
import {
  mulberry32,
  seedFromString,
  beta,
  logNormal,
  uniform,
  timeOfDayLift,
  dayOfWeekLift,
  seasonalLift,
} from './_stats';

interface PersistedMetaCampaign extends MetaAdsCampaignOutput {
  name: string;
  audienceKey: string;
  placement: MetaAdsCampaignInput['placement'];
  budgetDailyBRL: number;
  qualityFactor: number;
}

class MetaAdsMock implements IMetaAdsAdapter {
  private campaigns = new Map<string, PersistedMetaCampaign>();

  async createCampaign(input: MetaAdsCampaignInput): Promise<MetaAdsCampaignOutput> {
    const campaignId = `meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const qualityFactor =
      input.placement === 'instagram_stories' ? 1.1 : input.placement === 'instagram_feed' ? 1.05 : 1.0;
    const campaign: PersistedMetaCampaign = {
      campaignId,
      name: input.name,
      status: 'active',
      budgetDailyBRL: input.budgetDailyBRL,
      audienceKey: input.audienceKey,
      placement: input.placement,
      qualityFactor,
      startedAt: new Date().toISOString(),
    };
    this.campaigns.set(campaignId, campaign);
    return {
      campaignId,
      status: 'active',
      budgetDailyBRL: input.budgetDailyBRL,
      audienceKey: input.audienceKey,
      startedAt: campaign.startedAt,
    };
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    const c = this.campaigns.get(campaignId);
    if (c) c.status = 'paused';
  }

  async adjustBudget(campaignId: string, newBudgetDailyBRL: number): Promise<void> {
    const c = this.campaigns.get(campaignId);
    if (c) c.budgetDailyBRL = newBudgetDailyBRL;
  }

  async fetchMetrics(range: MetaAdsQueryRange): Promise<MetaAdsMetric[]> {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const out: MetaAdsMetric[] = [];

    const targets = range.campaignId
      ? [this.campaigns.get(range.campaignId)].filter(Boolean) as PersistedMetaCampaign[]
      : Array.from(this.campaigns.values());

    for (const c of targets) {
      const startedAt = new Date(c.startedAt);
      const effectiveFrom = from < startedAt ? startedAt : from;
      const loopStart = effectiveFrom <= to ? effectiveFrom : from;
      for (let d = new Date(loopStart); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d < startedAt || c.status !== 'active') {
          out.push(this.zeroMetric(c.campaignId, d));
          continue;
        }
        out.push(this.synthesizeMetric(c, d));
      }
    }
    return out;
  }

  isDigitalTwin(): boolean {
    return true;
  }

  private synthesizeMetric(c: PersistedMetaCampaign, date: Date): MetaAdsMetric {
    const seed = seedFromString(`${c.campaignId}|${date.toISOString().slice(0, 10)}`);
    const rng = mulberry32(seed);

    // Meta impressions are cheaper — R$ 1 ≈ 80-150 impressions.
    const baseImpressions = Math.floor(c.budgetDailyBRL * uniform(rng, 80, 150));
    const todLift = timeOfDayLift(uniform(rng, 0, 24));
    const dowLift = dayOfWeekLift(date.getUTCDay());
    const seasonLift = seasonalLift(date.getUTCMonth() + 1);
    const impressions = Math.floor(baseImpressions * todLift * dowLift * seasonLift);

    // Reach is typically 60-80% of impressions (frequency > 1).
    const reach = Math.floor(impressions * uniform(rng, 0.6, 0.8));

    const baseCtr = beta(rng, 3, 50); // ~6%
    const ctr = Math.min(0.3, baseCtr * c.qualityFactor);

    const clicks = Math.floor(impressions * ctr);
    const cpcBRL = Math.max(0.15, logNormal(rng, -1.6, 0.5));
    const spendBRL = Math.min(c.budgetDailyBRL, clicks * cpcBRL);

    const convRate = beta(rng, 2, 120); // ~1.7%
    const conversions = Math.floor(clicks * convRate);
    const cpaBRL = conversions > 0 ? spendBRL / conversions : spendBRL;

    const payingCustomers = Math.floor(conversions * 0.5); // 50% of conversions become customers
    const cacBRL = payingCustomers > 0 ? spendBRL / payingCustomers : undefined;

    return {
      campaignId: c.campaignId,
      date: date.toISOString().slice(0, 10),
      impressions,
      reach,
      clicks,
      ctr: Number(ctr.toFixed(4)),
      cpcBRL: Number(cpcBRL.toFixed(2)),
      spendBRL: Number(spendBRL.toFixed(2)),
      conversions,
      cpaBRL: Number(cpaBRL.toFixed(2)),
      cacBRL: cacBRL !== undefined ? Number(cacBRL.toFixed(2)) : undefined,
    };
  }

  private zeroMetric(campaignId: string, date: Date): MetaAdsMetric {
    return {
      campaignId,
      date: date.toISOString().slice(0, 10),
      impressions: 0,
      reach: 0,
      clicks: 0,
      ctr: 0,
      cpcBRL: 0,
      spendBRL: 0,
      conversions: 0,
      cpaBRL: 0,
      cacBRL: 0,
    };
  }
}

export const metaAdsMock = new MetaAdsMock();
