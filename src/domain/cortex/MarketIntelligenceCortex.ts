// ============================================================================
// Market Intelligence Cortex
// ----------------------------------------------------------------------------
// Continuously observes the market. Publishes validated knowledge that the
// Growth, Sales, Revenue, and Finance cortexes all consume.
//
// Observes:
//   - Search trends (Google Trends-style)
//   - Seasonality (Brazilian holidays, school breaks, festivals)
//   - Competitor activity (ad spend, landing page changes, pricing)
//   - Keyword performance (volume, difficulty, CPC)
//   - Landing page benchmarks (CTR, CPA, conversion rate)
//   - Public comments / reviews / social mentions
//
// Subscriptions:
//   - `competitor.*`       → ingest competitor activity
//   - `trend.*`            → ingest search trend signals
//   - `seasonality.*`      → ingest seasonal event calendar
//   - `keyword.*`          → ingest keyword metrics
// ============================================================================

import { CortexBase } from './CortexBase';
import type { AdapterBundle } from '@/adapters';
import { runLearningCycle, type CognitiveEvent } from '@/domain/zcc';

interface CompetitorSignal {
  competitorId: string;
  signal: string; // 'ad-spend-up', 'landing-changed', 'price-cut', 'review-burst'
  intensity: number; // 0..1
  observedAt: string;
}

interface SeasonalWindow {
  name: string; // 'high-season-summer', 'carnaval', 'reveillon'
  city?: string;
  startsAt: string;
  endsAt: string;
  demandLift: number;
}

interface KeywordIntel {
  keyword: string;
  avgMonthlyVolume: number;
  competition: 'low' | 'medium' | 'high';
  suggestedCpcBRL: number;
  updatedAt: string;
}

export class MarketIntelligenceCortex extends CortexBase {
  readonly id = 'market-intelligence' as const;

  private competitors = new Map<string, CompetitorSignal[]>();
  private seasonalWindows: SeasonalWindow[] = [];
  private keywordIntel = new Map<string, KeywordIntel>();

  protected async onStart(): Promise<void> {
    this.subscribe('competitor.signal', (e) => this.handleCompetitorSignal(e));
    this.subscribe('seasonality.window', (e) => this.handleSeasonalWindow(e));
    this.subscribe('keyword.intel', (e) => this.handleKeywordIntel(e));

    // Seed the Brazilian seasonal calendar.
    this.seedBrazilianSeasonality();
  }

  // ---- Event handlers ----------------------------------------------------

  private async handleCompetitorSignal(event: CognitiveEvent): Promise<void> {
    const { competitorId, signal, intensity } = event.payload as {
      competitorId: string;
      signal: string;
      intensity: number;
    };
    const list = this.competitors.get(competitorId) ?? [];
    list.push({
      competitorId,
      signal,
      intensity,
      observedAt: new Date().toISOString(),
    });
    // Keep only the last 200 signals per competitor.
    if (list.length > 200) list.splice(0, list.length - 200);
    this.competitors.set(competitorId, list);
    await this.emit('market.competitor.observed', { competitorId, signal, intensity });

    // If a competitor cuts price significantly, publish knowledge immediately.
    if (signal === 'price-cut' && intensity > 0.5) {
      await this.publishCompetitorPriceCut(competitorId, intensity);
    }
  }

  private async handleSeasonalWindow(event: { payload: Record<string, unknown> | object }): Promise<void> {
    const w = event.payload as SeasonalWindow;
    this.seasonalWindows.push(w);
    await this.emit('market.seasonality.window', w);
  }

  private async handleKeywordIntel(event: { payload: Record<string, unknown> | object }): Promise<void> {
    const k = event.payload as KeywordIntel;
    this.keywordIntel.set(k.keyword, { ...k, updatedAt: new Date().toISOString() });

    // Publish knowledge for high-value keywords.
    if (k.avgMonthlyVolume > 5000 && k.competition === 'low') {
      await this.publishKeywordOpportunity(k);
    }
  }

  // ---- Knowledge publication ---------------------------------------------

  private async publishCompetitorPriceCut(competitorId: string, intensity: number): Promise<void> {
    await runLearningCycle(
      {
        cortex: 'market-intelligence',
        knowledgeId: `market.competitor.price-cut.${competitorId}`,
        knowledgeType: 'competitor.price-cut',
        knowledgeTitle: `Competitor ${competitorId} cut prices`,
      },
      {
        observation: {
          description: `Competitor ${competitorId} reduced prices with intensity ${intensity}`,
          data: { competitorId, intensity },
          sourceEventIds: [],
        },
        inference: {
          statement: `Competitor ${competitorId} is competing on price — expect lead cost pressure`,
          method: 'threshold-classifier',
          priorConfidence: 0.6,
        },
        hypothesis: {
          prediction: 'Our CAC will rise 10-25% in the next 14 days unless we respond',
          variables: ['competitor pricing'],
          expectedEffect: 'CAC rise 10-25%',
          testType: 'before-after',
        },
        test: {
          outcome: 'inconclusive',
          sampleSize: 1,
          effectSize: intensity,
          pValue: NaN,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: 0.65,
          publishable: true,
          notes: 'Single signal; monitor CAC over next 14 days',
        },
        body: { competitorId, intensity, recommendedAction: 'evaluate-pricing-or-positioning' } as Record<string, unknown>,
      }
    );
  }

  private async publishKeywordOpportunity(k: KeywordIntel): Promise<void> {
    await runLearningCycle(
      {
        cortex: 'market-intelligence',
        knowledgeId: `market.keyword.opportunity.${k.keyword.replace(/\s+/g, '_')}`,
        knowledgeType: 'keyword.opportunity',
        knowledgeTitle: `High-volume / low-competition keyword: ${k.keyword}`,
      },
      {
        observation: {
          description: `Keyword "${k.keyword}" has ${k.avgMonthlyVolume} monthly searches and low competition`,
          data: k,
          sourceEventIds: [],
        },
        inference: {
          statement: `Keyword "${k.keyword}" is an underexploited opportunity`,
          method: 'volume-vs-competition-ratio',
          priorConfidence: 0.7,
        },
        hypothesis: {
          prediction: 'Bidding on this keyword will yield CPA below portfolio average',
          variables: ['keyword'],
          expectedEffect: 'CPA below portfolio average',
          testType: 'ab',
        },
        test: {
          outcome: 'inconclusive',
          sampleSize: 1,
          effectSize: k.avgMonthlyVolume / Math.max(1, k.suggestedCpcBRL),
          pValue: NaN,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: 0.7,
          publishable: true,
          notes: 'Keyword metrics look favourable; recommend controlled test campaign',
        },
        body: { ...k, recommendedAction: 'launch-test-campaign' } as Record<string, unknown>,
      }
    );
  }

  // ---- Brazilian seasonality seed ----------------------------------------

  private seedBrazilianSeasonality(): void {
    const year = new Date().getUTCFullYear();
    const windows: SeasonalWindow[] = [
      { name: 'high-season-summer', startsAt: `${year}-12-15`, endsAt: `${year + 1}-02-15`, demandLift: 1.8 },
      { name: 'carnaval', startsAt: `${year}-02-08`, endsAt: `${year}-02-14`, demandLift: 2.2 },
      { name: 'reveillon', startsAt: `${year}-12-28`, endsAt: `${year + 1}-01-02`, demandLift: 2.5 },
      { name: 'school-holidays-jul', startsAt: `${year}-07-01`, endsAt: `${year}-07-31`, demandLift: 1.4 },
      { name: 'easter', startsAt: `${year}-03-25`, endsAt: `${year}-04-05`, demandLift: 1.3 },
      { name: 'tiradentes-april-21', startsAt: `${year}-04-19`, endsAt: `${year}-04-23`, demandLift: 1.2 },
    ];
    this.seasonalWindows.push(...windows);
  }

  // ---- Public introspection ----------------------------------------------

  getCompetitorSignals(competitorId?: string): CompetitorSignal[] {
    if (competitorId) return this.competitors.get(competitorId) ?? [];
    return Array.from(this.competitors.values()).flat();
  }

  getSeasonalWindows(): SeasonalWindow[] {
    return [...this.seasonalWindows];
  }

  getKeywordIntel(): KeywordIntel[] {
    return Array.from(this.keywordIntel.values());
  }

  /** Snapshot for the Simulation Lab. */
  snapshot() {
    return {
      competitors: this.getCompetitorSignals(),
      seasonalWindows: this.getSeasonalWindows(),
      keywordIntel: this.getKeywordIntel(),
    };
  }
}
