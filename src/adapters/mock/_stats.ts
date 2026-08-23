// ============================================================================
// Statistical Primitives — used by every Mock adapter
// ----------------------------------------------------------------------------
// The Digital Twin must produce metrics that look real, not random.
// These primitives model the actual distributions observed in performance
// marketing and conversion funnels:
//
//   - CTR ~ Beta(α, β)              — bounded in [0,1], long-tailed
//   - CPC ~ LogNormal(μ, σ)         — always positive, heavy right tail
//   - Conversion rate ~ Beta(α, β)
//   - Session duration ~ Exponential(λ)
//   - Time-of-day lift ~ mixture of Gaussians (morning + evening peaks)
//
// All distributions are seeded by an RNG so experiments are reproducible.
// ============================================================================

/** Mulberry32 — tiny, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a uint32 seed. */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Uniform sample in [min, max). */
export function uniform(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Sample from a Gaussian via Box-Muller. */
export function gaussian(rng: () => number, mean = 0, stdDev = 1): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/** Sample from a Beta(α, β) distribution via the gamma-ratio method. */
export function beta(rng: () => number, alpha: number, betaParam: number): number {
  // Gamma sample via Marsaglia-Tsang.
  const sampleGamma = (k: number, theta: number): number => {
    if (k < 1) {
      // Use the boosting trick.
      const u = rng();
      return sampleGamma(k + 1, theta) * Math.pow(u, 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    let x: number;
    let v: number;
    while (true) {
      do {
        x = gaussian(rng, 0, 1);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v * theta;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * theta;
    }
  };
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(betaParam, 1);
  return x / (x + y);
}

/** Sample from a LogNormal(μ, σ). */
export function logNormal(rng: () => number, mu: number, sigma: number): number {
  return Math.exp(gaussian(rng, mu, sigma));
}

/** Sample from an Exponential(λ). */
export function exponential(rng: () => number, lambda: number): number {
  return -Math.log(1 - rng()) / lambda;
}

/** Pick a random element from an array. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Weighted pick. `weights` aligns with `arr` and need not be normalised. */
export function weightedPick<T>(rng: () => number, arr: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

/**
 * Time-of-day lift factor. Brazilian hospitality traffic peaks around
 * 10-12h and 19-22h. `hourUTC` adjusted to local time by `utcOffset`.
 */
export function timeOfDayLift(hourLocal: number): number {
  // Two Gaussian bumps centred at 11h and 20h.
  const morning = Math.exp(-Math.pow(hourLocal - 11, 2) / 8);
  const evening = Math.exp(-Math.pow(hourLocal - 20, 2) / 8);
  return 0.4 + 0.8 * Math.max(morning, evening);
}

/**
 * Day-of-week lift factor. Weekends are ~1.6x for hospitality.
 */
export function dayOfWeekLift(dayOfWeek: number): number {
  // 0 = Sunday, 6 = Saturday.
  if (dayOfWeek === 0 || dayOfWeek === 6) return 1.6;
  if (dayOfWeek === 5) return 1.25; // Friday ramp-up.
  return 1.0;
}

/**
 * Seasonal lift factor for Brazilian tourism.
 * - Dec/Jan: peak summer → 1.8x
 * - Jul: school holidays → 1.3x
 * - Apr/May/Sep/Oct: shoulder → 1.0x
 * - Feb/Mar/Nov: 1.1x
 * - Jun/Aug/Nov: 0.9x
 */
export function seasonalLift(month: number): number {
  switch (month) {
    case 12:
    case 1:
      return 1.8;
    case 7:
      return 1.3;
    case 6:
    case 8:
      return 0.9;
    case 2:
    case 3:
    case 11:
      return 1.1;
    default:
      return 1.0;
  }
}
