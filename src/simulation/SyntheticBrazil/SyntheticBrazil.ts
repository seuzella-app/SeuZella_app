// ============================================================================
// Synthetic Brazil — generates a full synthetic country
// ----------------------------------------------------------------------------
// Default scale (per the architectural spec):
//   - 27 federative units (26 states + DF)         [deterministic]
//   - 400 cities                                    [deterministic expansion]
//   - 15,000 pousadas                               [proportional to tourism intensity]
//   - 120,000 Airbnb properties                     [8x pousada count, weighted to coastal]
//   - 250,000 guests                                [deterministic generation]
//   - 80 competitors                                [distributed across top cities]
//   - 5 years of historical events                  [backfilled daily]
//
// The generator is seeded so the entire country is reproducible. Running
// the same seed always produces the same Brazil, which is critical for
// Simulation Lab experiments (you can compare two features against the
// exact same synthetic country).
// ============================================================================

import { mulberry32, seedFromString, weightedPick, uniform, gaussian } from '@/adapters/mock';
import { BRAZILIAN_STATES, ANCHOR_CITIES, type BrazilianCity } from './BrazilianGeography';

export interface SyntheticPousada {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  lat: number;
  lng: number;
  roomCount: number;
  avgDailyRateBRL: number;
  niche: 'pousada' | 'small-hotel';
  /** A score 0..1 for how digitally mature the pousada is (affects conversion). */
  digitalMaturity: number;
}

export interface SyntheticAirbnbProperty {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  lat: number;
  lng: number;
  capacity: number;
  avgNightlyRateBRL: number;
  /** "Entire home" vs "Private room" vs "Shared room". */
  listingType: 'entire_home' | 'private_room' | 'shared_room';
  superhost: boolean;
}

export interface SyntheticGuest {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  /** Assigned persona from the Behavioral Engine. */
  personaId: string;
  ageBracket: '18-24' | '25-34' | '35-44' | '45-54' | '55+';
  travelParty: 'solo' | 'couple' | 'family' | 'friends' | 'business';
  /** Average annual trips. */
  avgAnnualTrips: number;
}

export interface SyntheticCompetitor {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  /** What kind of competitor: 'channel-manager' | 'crm' | 'pricing-tool' | 'all-in-one'. */
  category: 'channel-manager' | 'crm' | 'pricing-tool' | 'all-in-one';
  marketSharePct: number;
  /** Average monthly ad spend in BRL. */
  avgMonthlyAdSpendBRL: number;
}

export interface SyntheticBrazilSnapshot {
  generatedAt: string;
  seed: number;
  cities: BrazilianCity[];
  pousadas: SyntheticPousada[];
  airbnbs: SyntheticAirbnbProperty[];
  guests: SyntheticGuest[];
  competitors: SyntheticCompetitor[];
  /** 5-year daily event count (compressed: total events, not actual list). */
  historicalEventCount: number;
}

const PERSONA_IDS = ['curious', 'impulsive', 'skeptical', 'price-only', 'chain', 'airbnb'];

const POUSADA_NAME_PARTS = {
  prefix: ['Pousada', 'Recanto', 'Casa', 'Vila', 'Chalé', 'Hospedaria', 'Refúgio'],
  suffix: ['do Sol', 'da Praia', 'da Serra', 'do Mar', 'do Lago', 'das Flores', 'do Campo', 'Real', 'Brisa', 'Aurora'],
};

const AIRBNB_NAME_PARTS = {
  prefix: ['Apto', 'Casa', 'Loft', 'Studio', 'Chalé', 'Suite'],
  suffix: ['Beira Mar', 'no Centro', 'da Praia', 'do Bosque', 'Premium', 'Exclusivo', 'dos Sonhos'],
};

const COMPETITOR_NAMES = [
  'Stays.net', 'OmniGest', 'HiHub', 'HotelRunner', 'Beds24', 'Clock PMS',
  'Little Hotelier', 'SiteMinder', 'Cloudbeds', 'Ezee', 'Frontdesk Anywhere',
  'RoomMaster', 'WebRezPro', 'ResNexus', 'Easy InnKeeping', 'Preno',
  'Hotelogix', 'Sirvoy', 'RezExpert', 'Hotello', 'RMS', 'RoomKeyPMS',
  'Visual Matrix', 'InnRoad', 'Protel', 'Maestro PMS', 'Agilysys',
  'Mews', 'D-EDGE', 'Sabre', 'Oracle Hospitality', 'StayNTouch',
  'SkyTouch', 'HotelKey', 'Cubilis', 'TheHotelier', 'EzeGDS',
  'Profitroom', 'TravelClick', 'Bookassist', 'GHIX', 'PiiQ',
  'RoomRaccoon', 'Cloudbeds Pro', 'Hostfully', 'Hospitable', 'Guesty',
  'Lodgify', 'Uplisting', 'Tokeet', '365Villas', 'Hostaway', 'AirGMS',
  'YourPorter', 'Vreasy', 'Avantio', 'Kigo', 'Rentals United',
  'MyVR', 'CiiRUS', 'Streamline', 'LiveRez', 'BlackBeltHelp',
  'Inntopia', 'Aspire', 'Springer-Miller', 'Visual Matrix Pro',
  'Quore', 'Hotel Effectiveness', 'HotSOS', 'Amadeus',
];

export interface GenerateSyntheticBrazilOptions {
  seed?: number;
  cityCount?: number;
  pousadaCount?: number;
  airbnbCount?: number;
  guestCount?: number;
  competitorCount?: number;
  historyYears?: number;
}

/**
 * Generate the full Synthetic Brazil.
 */
export function generateSyntheticBrazil(opts: GenerateSyntheticBrazilOptions = {}): SyntheticBrazilSnapshot {
  const seed = opts.seed ?? 42;
  const rng = mulberry32(seed);

  const cityCount = opts.cityCount ?? 400;
  const pousadaCount = opts.pousadaCount ?? 15_000;
  const airbnbCount = opts.airbnbCount ?? 120_000;
  const guestCount = opts.guestCount ?? 250_000;
  const competitorCount = opts.competitorCount ?? 80;
  const historyYears = opts.historyYears ?? 5;

  // 1. Expand cities: anchor cities + satellites generated around them.
  const cities = expandCities(rng, cityCount);

  // 2. Pousadas — distributed by tourism intensity.
  const pousadas: SyntheticPousada[] = [];
  const cityWeights = cities.map((c) => c.tourismIntensity + 0.05);
  for (let i = 0; i < pousadaCount; i++) {
    const city = weightedPick(rng, cities, cityWeights);
    pousadas.push(generatePousada(rng, i, city));
  }

  // 3. Airbnb properties — 8x pousada count, weighted to coastal cities.
  const airbnbs: SyntheticAirbnbProperty[] = [];
  const coastalWeights = cities.map((c) => (c.coastal ? 2.5 : 0.7) * (c.tourismIntensity + 0.05));
  for (let i = 0; i < airbnbCount; i++) {
    const city = weightedPick(rng, cities, coastalWeights);
    airbnbs.push(generateAirbnb(rng, i, city));
  }

  // 4. Guests — distributed by population.
  const guests: SyntheticGuest[] = [];
  const popWeights = cities.map((c) => Math.max(1, c.population / 10_000));
  for (let i = 0; i < guestCount; i++) {
    const city = weightedPick(rng, cities, popWeights);
    guests.push(generateGuest(rng, i, city));
  }

  // 5. Competitors — distributed across top cities by tourism intensity.
  const competitors: SyntheticCompetitor[] = [];
  const topCities = [...cities].sort((a, b) => b.tourismIntensity - a.tourismIntensity).slice(0, 30);
  const topWeights = topCities.map((c) => c.tourismIntensity + 0.1);
  for (let i = 0; i < competitorCount; i++) {
    const city = weightedPick(rng, topCities, topWeights);
    competitors.push(generateCompetitor(rng, i, city));
  }

  // 6. Estimate 5 years of historical events.
  // Average: 500 events/day per city × 365 × 5 ≈ ~36M events.
  // (We don't materialize them; we record the count and let the simulator
  // generate slices on demand.)
  const historicalEventCount = cities.length * 500 * 365 * historyYears;

  return {
    generatedAt: new Date().toISOString(),
    seed,
    cities,
    pousadas,
    airbnbs,
    guests,
    competitors,
    historicalEventCount,
  };
}

function expandCities(rng: () => number, targetCount: number): BrazilianCity[] {
  const result: BrazilianCity[] = [...ANCHOR_CITIES];
  let idx = 0;
  while (result.length < targetCount && idx < ANCHOR_CITIES.length * 20) {
    const anchor = ANCHOR_CITIES[Math.floor(rng() * ANCHOR_CITIES.length)];
    // Generate a satellite within ±0.5 deg of the anchor.
    const lat = anchor.lat + uniform(rng, -0.5, 0.5);
    const lng = anchor.lng + uniform(rng, -0.5, 0.5);
    const name = `${anchor.name} Satélite ${Math.floor(uniform(rng, 1, 99))}`;
    result.push({
      name,
      stateCode: anchor.stateCode,
      lat,
      lng,
      population: Math.floor(uniform(rng, 5_000, 100_000)),
      tourismIntensity: anchor.tourismIntensity * uniform(rng, 0.4, 0.9),
      coastal: anchor.coastal,
      peakSeason: anchor.peakSeason,
    });
    idx++;
  }
  return result.slice(0, targetCount);
}

function generatePousada(rng: () => number, i: number, city: BrazilianCity): SyntheticPousada {
  const prefix = POUSADA_NAME_PARTS.prefix[Math.floor(rng() * POUSADA_NAME_PARTS.prefix.length)];
  const suffix = POUSADA_NAME_PARTS.suffix[Math.floor(rng() * POUSADA_NAME_PARTS.suffix.length)];
  const roomCount = Math.max(3, Math.floor(gaussian(rng, 12, 6)));
  const baseRate = 150 + city.tourismIntensity * 350;
  return {
    id: `pousada_${i.toString().padStart(5, '0')}`,
    name: `${prefix} ${suffix}`,
    city: city.name,
    stateCode: city.stateCode,
    lat: city.lat + uniform(rng, -0.05, 0.05),
    lng: city.lng + uniform(rng, -0.05, 0.05),
    roomCount,
    avgDailyRateBRL: Number((baseRate + uniform(rng, -50, 100)).toFixed(2)),
    niche: rng() < 0.85 ? 'pousada' : 'small-hotel',
    digitalMaturity: Number(uniform(rng, 0.1, 0.95).toFixed(2)),
  };
}

function generateAirbnb(rng: () => number, i: number, city: BrazilianCity): SyntheticAirbnbProperty {
  const prefix = AIRBNB_NAME_PARTS.prefix[Math.floor(rng() * AIRBNB_NAME_PARTS.prefix.length)];
  const suffix = AIRBNB_NAME_PARTS.suffix[Math.floor(rng() * AIRBNB_NAME_PARTS.suffix.length)];
  const baseRate = 120 + city.tourismIntensity * 280;
  const listingRoll = rng();
  return {
    id: `airbnb_${i.toString().padStart(6, '0')}`,
    name: `${prefix} ${suffix}`,
    city: city.name,
    stateCode: city.stateCode,
    lat: city.lat + uniform(rng, -0.05, 0.05),
    lng: city.lng + uniform(rng, -0.05, 0.05),
    capacity: Math.max(1, Math.floor(gaussian(rng, 4, 2))),
    avgNightlyRateBRL: Number((baseRate + uniform(rng, -40, 80)).toFixed(2)),
    listingType: listingRoll < 0.65 ? 'entire_home' : listingRoll < 0.92 ? 'private_room' : 'shared_room',
    superhost: rng() < 0.2,
  };
}

function generateGuest(rng: () => number, i: number, city: BrazilianCity): SyntheticGuest {
  const personaId = PERSONA_IDS[Math.floor(rng() * PERSONA_IDS.length)];
  const ageRoll = rng();
  const ageBracket: SyntheticGuest['ageBracket'] =
    ageRoll < 0.18 ? '18-24' :
    ageRoll < 0.45 ? '25-34' :
    ageRoll < 0.70 ? '35-44' :
    ageRoll < 0.88 ? '45-54' : '55+';
  const partyRoll = rng();
  const travelParty: SyntheticGuest['travelParty'] =
    partyRoll < 0.30 ? 'couple' :
    partyRoll < 0.55 ? 'family' :
    partyRoll < 0.75 ? 'friends' :
    partyRoll < 0.90 ? 'solo' : 'business';
  return {
    id: `guest_${i.toString().padStart(6, '0')}`,
    name: `Hóspede Sintético ${i}`,
    city: city.name,
    stateCode: city.stateCode,
    personaId,
    ageBracket,
    travelParty,
    avgAnnualTrips: Math.max(1, Math.floor(gaussian(rng, 3, 2))),
  };
}

function generateCompetitor(rng: () => number, i: number, city: BrazilianCity): SyntheticCompetitor {
  const name = COMPETITOR_NAMES[i % COMPETITOR_NAMES.length];
  const categoryRoll = rng();
  const category: SyntheticCompetitor['category'] =
    categoryRoll < 0.30 ? 'all-in-one' :
    categoryRoll < 0.55 ? 'channel-manager' :
    categoryRoll < 0.80 ? 'crm' : 'pricing-tool';
  return {
    id: `competitor_${i.toString().padStart(2, '0')}`,
    name,
    city: city.name,
    stateCode: city.stateCode,
    category,
    marketSharePct: Number(uniform(rng, 0.5, 12).toFixed(2)),
    avgMonthlyAdSpendBRL: Math.floor(uniform(rng, 2_000, 80_000)),
  };
}

/**
 * Build a deterministic seed from a city name — used by the National
 * Simulator to pick a city and generate its ecosystem reproducibly.
 */
export function seedForCity(cityName: string): number {
  return seedFromString(`brazil:${cityName}`);
}
