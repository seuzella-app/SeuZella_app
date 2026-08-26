// ============================================================================
// National Simulator
// ----------------------------------------------------------------------------
// Pick a city (e.g. "Praia Grande") → generate that city's full ecosystem:
//   - N pousadas (default: proportional to tourism intensity, ~500 max)
//   - 8x Airbnb properties
//   - Local guests
//   - Local competitors
//   - Run the ads simulator against this city
//   - Run the behavioral engine for the city's leads
//   - Emit all events on the ZCB so cortexes learn this city's dynamics
//
// Use cases:
//   - "Validate Praia Grande before launching there"
//   - "Compare Gramado vs Bonito synthetic performance"
//   - "Rehearse the ZGS's budget allocation for Fernando de Noronha"
// ============================================================================

import type { CognitiveEvent } from '@/domain/zcc';
import { zcb } from '@/domain/zcc';
import { ANCHOR_CITIES, type BrazilianCity } from '../SyntheticBrazil';
import {
  generateSyntheticBrazil,
  seedForCity,
  type SyntheticBrazilSnapshot,
  type SyntheticPousada,
  type SyntheticAirbnbProperty,
  type SyntheticGuest,
  type SyntheticCompetitor,
} from '../SyntheticBrazil';
import { behavioralEngine } from '../BehavioralEngine';
import { adsSimulator } from '../AdsSimulator';
import { mulberry32 } from '@/adapters/mock';

export interface NationalSimulationConfig {
  /** City name (must exist in ANCHOR_CITIES). */
  city: string;
  /** Number of pousadas to simulate in this city. Default: scaled by tourism. */
  pousadaCount?: number;
  /** Number of leads to simulate. Default: pousadaCount * 30. */
  leadCount?: number;
  /** Number of days to run the ads simulation. Default 30. */
  adsDays?: number;
  /** Daily budget per ad campaign. Default 50. */
  adsBudgetDailyBRL?: number;
  /** Whether to publish events on the ZCB. Default true. */
  publishEvents?: boolean;
  /** Seed for reproducibility. */
  seed?: number;
}

export interface NationalSimulationResult {
  city: BrazilianCity;
  pousadaCount: number;
  airbnbCount: number;
  guestCount: number;
  competitorCount: number;
  leadsSimulated: number;
  eventsEmitted: number;
  adsSummary: {
    googleAds: { totalSpendBRL: number; totalConversions: number; avgCAC: number }[];
    metaAds: { totalSpendBRL: number; totalConversions: number; avgCAC: number }[];
  };
  topPersonas: { personaId: string; conversionRate: number }[];
}

export class NationalSimulator {
  /**
   * Run a full national simulation for one city.
   */
  async run(config: NationalSimulationConfig): Promise<NationalSimulationResult> {
    const city = ANCHOR_CITIES.find((c) => c.name.toLowerCase() === config.city.toLowerCase());
    if (!city) {
      throw new Error(`City "${config.city}" not found in ANCHOR_CITIES. Available: ${ANCHOR_CITIES.map((c) => c.name).join(', ')}`);
    }
    const seed = config.seed ?? seedForCity(city.name);
    const rng = mulberry32(seed);
    const publish = config.publishEvents ?? true;

    // Default counts scale with tourism intensity.
    const pousadaCount = config.pousadaCount ?? Math.floor(50 + city.tourismIntensity * 450);
    const airbnbCount = pousadaCount * 8;
    const guestCount = pousadaCount * 30;
    const leadCount = config.leadCount ?? pousadaCount * 30;
    const competitorCount = Math.min(15, Math.max(3, Math.floor(city.tourismIntensity * 15)));

    // 1. Generate the city slice of Synthetic Brazil.
    const brazil: SyntheticBrazilSnapshot = generateSyntheticBrazil({
      seed,
      cityCount: ANCHOR_CITIES.length, // just the anchors for a city-level run
      pousadaCount,
      airbnbCount,
      guestCount,
      competitorCount,
      historyYears: 0,
    });

    const localPousadas: SyntheticPousada[] = brazil.pousadas;
    const localAirbnbs: SyntheticAirbnbProperty[] = brazil.airbnbs;
    const localGuests: SyntheticGuest[] = brazil.guests;
    const localCompetitors: SyntheticCompetitor[] = brazil.competitors;

    // 2. Emit `market.competitor.signal` events for the local competitors.
    if (publish) {
      for (const c of localCompetitors) {
        await zcb.publish({
          id: `evt_market_competitor_${c.id}`,
          source: 'market-intelligence',
          type: 'competitor.signal',
          severity: 'info',
          payload: {
            competitorId: c.id,
            signal: 'active-in-region',
            intensity: c.marketSharePct / 100,
            city: city.name,
            stateCode: city.stateCode,
          },
          occurredAt: new Date().toISOString(),
        });
      }
    }

    // 3. Run the ads simulator for this city.
    const adCampaignsConfig = {
      days: config.adsDays ?? 30,
      seed,
      publishEvents: publish,
      googleAdsCampaigns: [
        { name: `GAds ${city.name} - Pousada`, budgetDailyBRL: config.adsBudgetDailyBRL ?? 50, adGroupKey: `pousada-${city.name.toLowerCase().replace(/\s+/g, '-')}`, keywords: [`pousada ${city.name.toLowerCase()}`, `hotel ${city.name.toLowerCase()}`] },
      ],
      metaAdsCampaigns: [
        { name: `Meta ${city.name} - Pousada`, budgetDailyBRL: config.adsBudgetDailyBRL ?? 50, audienceKey: `lookalike-pousada-${city.stateCode.toLowerCase()}`, placement: 'instagram_feed' as const },
      ],
    };
    const adsResult = await adsSimulator.run(adCampaignsConfig);

    // 4. Run the behavioral engine for `leadCount` leads distributed by persona.
    const personaDistribution = [
      { personaId: 'curious', weight: 0.30 },
      { personaId: 'impulsive', weight: 0.20 },
      { personaId: 'skeptical', weight: 0.15 },
      { personaId: 'price-only', weight: 0.15 },
      { personaId: 'chain', weight: 0.10 },
      { personaId: 'airbnb', weight: 0.10 },
    ];
    const journeyEvents = behavioralEngine.generateJourneys(
      leadCount,
      personaDistribution,
      {
        source: rng() < 0.5 ? 'google_ads' : 'meta_ads',
        niche: city.coastal ? (rng() < 0.7 ? 'pousada' : 'airbnb') : 'pousada',
        city: city.name,
        stateCode: city.stateCode,
      },
      seed
    );

    if (publish) {
      // Publish in batches to avoid starving the event loop.
      const batchSize = 500;
      for (let i = 0; i < journeyEvents.length; i += batchSize) {
        const batch = journeyEvents.slice(i, i + batchSize);
        await Promise.all(batch.map((e) => zcb.publish(e)));
      }
    }

    // 5. Compute persona conversion rates from the events.
    const personaStats: Record<string, { leads: number; converted: number }> = {};
    for (const e of journeyEvents) {
      if (e.type === 'lead.created') {
        const {personaId} = (e.payload as { personaId: string });
        personaStats[personaId] = personaStats[personaId] ?? { leads: 0, converted: 0 };
        personaStats[personaId].leads += 1;
      }
      if (e.type === 'lead.converted') {
        const {personaId} = (e.payload as { personaId: string });
        if (personaStats[personaId]) personaStats[personaId].converted += 1;
      }
    }
    const topPersonas = Object.entries(personaStats)
      .map(([personaId, s]) => ({
        personaId,
        conversionRate: s.leads > 0 ? s.converted / s.leads : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate);

    return {
      city,
      pousadaCount: localPousadas.length,
      airbnbCount: localAirbnbs.length,
      guestCount: localGuests.length,
      competitorCount: localCompetitors.length,
      leadsSimulated: leadCount,
      eventsEmitted: journeyEvents.length + adsResult.eventsEmitted + localCompetitors.length,
      adsSummary: {
        googleAds: adsResult.googleAds.map((c) => ({
          totalSpendBRL: c.totalSpendBRL,
          totalConversions: c.totalConversions,
          avgCAC: c.avgCAC,
        })),
        metaAds: adsResult.metaAds.map((c) => ({
          totalSpendBRL: c.totalSpendBRL,
          totalConversions: c.totalConversions,
          avgCAC: c.avgCAC,
        })),
      },
      topPersonas,
    };
  }

  /**
   * Compare multiple cities side-by-side. Useful for "where should we launch next".
   */
  async compare(cities: string[], opts: { leadCount?: number; adsDays?: number; seed?: number } = {}): Promise<{
    results: NationalSimulationResult[];
    ranking: { city: string; avgCAC: number; conversionRate: number }[];
  }> {
    const results: NationalSimulationResult[] = [];
    for (const city of cities) {
      try {
        const r = await this.run({
          city,
          leadCount: opts.leadCount,
          adsDays: opts.adsDays,
          seed: opts.seed,
          publishEvents: false, // don't pollute ZCB during comparison
        });
        results.push(r);
      } catch (err) {
         
        console.error(`[NationalSimulator] city ${city} failed:`, err);
      }
    }
    const ranking = results.map((r) => {
      const allCACs = [
        ...r.adsSummary.googleAds.map((c) => c.avgCAC),
        ...r.adsSummary.metaAds.map((c) => c.avgCAC),
      ].filter((c) => c > 0);
      const avgCAC = allCACs.length > 0 ? allCACs.reduce((a, b) => a + b, 0) / allCACs.length : 0;
      const conversionRate = r.topPersonas.length > 0
        ? r.topPersonas.reduce((s, p) => s + p.conversionRate, 0) / r.topPersonas.length
        : 0;
      return { city: r.city.name, avgCAC, conversionRate };
    }).sort((a, b) => a.avgCAC - b.avgCAC); // lower CAC is better
    return { results, ranking };
  }
}

export const nationalSimulator = new NationalSimulator();
