// ============================================================================
// IMetaAdsAdapter — contract for Meta (Facebook/Instagram) Ads integration
// ============================================================================

export interface MetaAdsCampaignInput {
  name: string;
  budgetDailyBRL: number;
  /** e.g. 'lookalike-pousada-sp', 'remarketing-airbnb' */
  audienceKey: string;
  placement: 'facebook_feed' | 'instagram_feed' | 'instagram_stories' | 'audience_network';
  creative: { headline: string; body: string; imageUrl?: string };
  geoTargets: string[];
  landingUrl: string;
}

export interface MetaAdsCampaignOutput {
  campaignId: string;
  status: 'active' | 'paused' | 'ended';
  budgetDailyBRL: number;
  audienceKey: string;
  startedAt: string;
}

export interface MetaAdsMetric {
  campaignId: string;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpcBRL: number;
  spendBRL: number;
  conversions: number;
  cpaBRL: number;
  cacBRL?: number;
}

export interface MetaAdsQueryRange {
  campaignId?: string;
  from: string;
  to: string;
}

export interface IMetaAdsAdapter {
  createCampaign(input: MetaAdsCampaignInput): Promise<MetaAdsCampaignOutput>;
  pauseCampaign(campaignId: string): Promise<void>;
  adjustBudget(campaignId: string, newBudgetDailyBRL: number): Promise<void>;
  fetchMetrics(range: MetaAdsQueryRange): Promise<MetaAdsMetric[]>;
  isDigitalTwin(): boolean;
}
