// ============================================================================
// IGoogleAdsAdapter — contract for Google Ads integration
// ----------------------------------------------------------------------------
// The Growth Cortex and ZGS depend on this interface. They never know whether
// the implementation is `GoogleAdsMock` (Digital Twin) or `GoogleAdsReal`
// (production API). The contract is identical.
// ============================================================================

export interface GoogleAdsCampaignInput {
  name: string;
  budgetDailyBRL: number;
  /** e.g. 'pousada-praia-grande', 'airbnb-gramado' */
  adGroupKey: string;
  keywords: string[];
  matchType?: 'broad' | 'phrase' | 'exact';
  /** Where the campaign will be shown. */
  geoTargets: string[];
  /** A URL the simulated user would land on. */
  landingUrl: string;
  /** Optional ad copy variants for A/B testing. */
  copyVariants?: { headline: string; description: string }[];
}

export interface GoogleAdsCampaignOutput {
  campaignId: string;
  status: 'active' | 'paused' | 'ended';
  budgetDailyBRL: number;
  adGroupKey: string;
  startedAt: string;
}

export interface GoogleAdsMetric {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpcBRL: number;
  spendBRL: number;
  conversions: number;
  cpaBRL: number;
  /** Cost per acquisition, computed once a conversion becomes a paying customer. */
  cacBRL?: number;
}

export interface GoogleAdsQueryRange {
  campaignId?: string;
  from: string;
  to: string;
}

export interface IGoogleAdsAdapter {
  /**
   * Create a campaign. In Real mode this calls the Google Ads API.
   * In Digital Twin mode this generates a campaign with statistically
   * realistic metrics derived from configured distributions.
   */
  createCampaign(input: GoogleAdsCampaignInput): Promise<GoogleAdsCampaignOutput>;

  /**
   * Pause a campaign.
   */
  pauseCampaign(campaignId: string): Promise<void>;

  /**
   * Adjust the daily budget of an active campaign.
   */
  adjustBudget(campaignId: string, newBudgetDailyBRL: number): Promise<void>;

  /**
   * Fetch metrics for a date range. Returns one row per campaign per day.
   * In Digital Twin mode the metrics are generated using the configured
   * statistical distributions (CTR ~ Beta, CPC ~ LogNormal, etc.).
   */
  fetchMetrics(range: GoogleAdsQueryRange): Promise<GoogleAdsMetric[]>;

  /**
   * Returns whether this adapter is the Digital Twin or the Real thing.
   * Cortexes should never branch on this — it exists for observability.
   */
  isDigitalTwin(): boolean;
}
