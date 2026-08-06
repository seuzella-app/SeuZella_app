// ============================================================================
// GoogleAdsMock — ZCC Digital Twin implementation of IGoogleAdsAdapter
// ----------------------------------------------------------------------------
// Generates statistically realistic campaign metrics:
//   - CTR ~ Beta(α=2, β=40)  → mean ~5%, long right tail
//   - CPC ~ LogNormal(μ=-1.2, σ=0.4) → mean ~R$ 1.50
//   - Conversion rate ~ Beta(α=2, β=80) → mean ~2.5%
//   - Lifts: time-of-day, day-of-week, seasonality
//
// The Mock persists campaigns and metrics to an in-memory store so
// `fetchMetrics` returns consistent historical data.
// ============================================================================

import type {
  IGoogleAdsAdapter,
  GoogleAdsCampaignInput,
  GoogleAdsCampaignOutput,
  GoogleAdsMetric,
  GoogleAdsQueryRange,
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

interface PersistedCampaign extends GoogleAdsCampaignOutput {
  name: string;
  budgetDailyBRL: number;
  adGroupKey: string;
  keywords: string[];
  landingUrl: string;
  /** Per-campaign quality factor — better keywords/landing → higher CTR. */
  qualityFactor: number;
}

class GoogleAdsMock implements IGoogleAdsAdapter {
  private campaigns = new Map<string, PersistedCampaign>();
  private metrics: GoogleAdsMetric[] = [];

  async createCampaign(input: GoogleAdsCampaignInput): Promise<GoogleAdsCampaignOutput> {
    const campaignId = `gads_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Quality factor: more keywords + copy variants → higher CTR.
    const qualityFactor =
      0.7 +
      Math.min(0.6, input.keywords.length * 0.05) +
      Math.min(0.4, (input.copyVariants?.length ?? 0) * 0.2);
    const campaign: PersistedCampaign = {
      campaignId,
      name: input.name,
      status: 'active',
      budgetDailyBRL: input.budgetDailyBRL,
      adGroupKey: input.adGroupKey,
      keywords: input.keywords,
      landingUrl: input.landingUrl,
      qualityFactor,
      startedAt: new Date().toISOString(),
    };
    this.campaigns.set(campaignId, campaign);
    return {
      campaignId,
      status: 'active',
      budgetDailyBRL: input.budgetDailyBRL,
      adGroupKey: input.adGroupKey,
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

  async fetchMetrics(range: GoogleAdsQueryRange): Promise<GoogleAdsMetric[]> {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const out: GoogleAdsMetric[] = [];

    const targets = range.campaignId
      ? [this.campaigns.get(range.campaignId)].filter(Boolean) as PersistedCampaign[]
      : Array.from(this.campaigns.values());

    for (const c of targets) {
      // The Mock generates metrics for the entire requested range,
      // regardless of when the campaign was created. This is intentional:
      // it lets the Simulation Lab backfill historical data and lets tests
      // verify reproducibility for arbitrary date ranges.
      const startedAt = new Date(c.startedAt);
      const effectiveFrom = from < startedAt ? startedAt : from;
      // If the campaign starts after the requested range, we still emit
      // zero-rows so callers get a consistent response shape.
      const loopStart = effectiveFrom <= to ? effectiveFrom : from;
      for (let d = new Date(loopStart); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d < startedAt || c.status !== 'active') {
          // Generate a zero row for paused / pre-start days.
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

  private synthesizeMetric(c: PersistedCampaign, date: Date): GoogleAdsMetric {
    // Deterministic seed for the same campaign + day.
    const seed = seedFromString(`${c.campaignId}|${date.toISOString().slice(0, 10)}`);
    const rng = mulberry32(seed);

    // Base impressions scale with budget (R$ 1 ≈ 40-80 impressions on average).
    const baseImpressions = Math.floor(c.budgetDailyBRL * uniform(rng, 40, 80));
    const todLift = timeOfDayLift(uniform(rng, 0, 24)); // average across the day
    const dowLift = dayOfWeekLift(date.getUTCDay());
    const seasonLift = seasonalLift(date.getUTCMonth() + 1);
    const impressions = Math.floor(baseImpressions * todLift * dowLift * seasonLift);

    // CTR ~ Beta, lifted by quality factor.
    const baseCtr = beta(rng, 2, 40); // ~5% mean
    const ctr = Math.min(0.25, baseCtr * c.qualityFactor);

    const clicks = Math.floor(impressions * ctr);
    // CPC ~ LogNormal in R$.
    const cpcBRL = Math.max(0.3, logNormal(rng, -1.2, 0.4));
    const spendBRL = Math.min(c.budgetDailyBRL, clicks * cpcBRL);

    // Conversion rate ~ Beta(2, 80) → ~2.5% mean.
    const convRate = beta(rng, 2, 80);
    const conversions = Math.floor(clicks * convRate);
    const cpaBRL = conversions > 0 ? spendBRL / conversions : spendBRL;

    // CAC requires the conversion to become a paying customer — ~60% of conversions do.
    const payingCustomers = Math.floor(conversions * 0.6);
    const cacBRL = payingCustomers > 0 ? spendBRL / payingCustomers : undefined;

    return {
      campaignId: c.campaignId,
      date: date.toISOString().slice(0, 10),
      impressions,
      clicks,
      ctr: Number(ctr.toFixed(4)),
      cpcBRL: Number(cpcBRL.toFixed(2)),
      spendBRL: Number(spendBRL.toFixed(2)),
      conversions,
      cpaBRL: Number(cpaBRL.toFixed(2)),
      cacBRL: cacBRL !== undefined ? Number(cacBRL.toFixed(2)) : undefined,
    };
  }

  private zeroMetric(campaignId: string, date: Date): GoogleAdsMetric {
    return {
      campaignId,
      date: date.toISOString().slice(0, 10),
      impressions: 0,
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

/**
 * Singleton Digital Twin implementation of the Google Ads adapter.
 */
export const googleAdsMock = new GoogleAdsMock();
