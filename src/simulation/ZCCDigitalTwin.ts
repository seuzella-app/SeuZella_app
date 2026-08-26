// ============================================================================
// ZCC Digital Twin — top-level orchestrator
// ----------------------------------------------------------------------------
// The Digital Twin is the *permanent* simulation environment. Even after
// production, it stays alive: every new feature first runs here against
// millions of synthetic events.
//
// What this module does:
//   1. Boots the entire cognitive stack in `digital-twin` mode.
//   2. Loads Synthetic Brazil into memory (pousadas, guests, competitors).
//   3. Wires the Simulation Lab to run on a schedule.
//   4. Exposes a single entry point: `bootDigitalTwin()` that the ZCC uses
//      on startup.
//
// What this module does NOT do:
//   - Make any external API call. Ever.
//   - Persist data to a production database. (Twin data is in-memory only.)
//   - Replace the Real adapter when production mode is enabled.
// ============================================================================

import { zcc, type OperatingMode } from '@/domain/zcc';
import { buildAllCortexes } from '@/domain/cortex';
import { ZellaGrowthStrategy } from '@/domain/strategy';
import { getAdapters, buildAdapterBundle, resolveModeMap } from '@/adapters';
import { simulationLab } from './ZCCSimulationLab';
import { adsSimulator } from './AdsSimulator';
import { nationalSimulator } from './NationalSimulator';
import { behavioralEngine } from './BehavioralEngine';
import { generateSyntheticBrazil } from './SyntheticBrazil';

export interface DigitalTwinBootOptions {
  /** Operating mode. Default: digital-twin. */
  operatingMode?: OperatingMode;
  /** Whether to auto-start the Simulation Lab. Default false. */
  autoStartLab?: boolean;
  /** Whether to seed Synthetic Brazil on boot. Default true. */
  seedSyntheticBrazil?: boolean;
  /** Heartbeat interval (ms). Default 60_000. */
  heartbeatMs?: number;
}

let booted = false;

/**
 * Boot the entire cognitive stack.
 * This is the single entry point used by the API routes on cold start.
 */
export async function bootDigitalTwin(opts: DigitalTwinBootOptions = {}): Promise<void> {
  if (booted) return;

  const operatingMode: OperatingMode = opts.operatingMode ?? 'digital-twin';

  // 1. Configure ZCC.
  zcc.configure({
    operatingMode,
    heartbeatMs: opts.heartbeatMs,
    autoStartLab: opts.autoStartLab,
  });

  // 2. Register the Simulation Lab runner.
  zcc.registerLabRunner(async () => {
    // Default lab run: simulate 1000 leads and check that the Growth Cortex
    // publishes at least one piece of knowledge.
    const result = await simulationLab.run({
      experimentId: `nightly_${new Date().toISOString().slice(0, 10)}`,
      hypothesis: 'Cortexes remain healthy overnight — at least 1 knowledge entry published per 1000 leads',
      feature: 'cortex-health',
      eventCount: 1000,
      durationCapMs: 30_000,
      metrics: {
        knowledgePublished: (events) =>
          events.filter((e) => e.type === 'knowledge.published').length,
      },
      approvalThresholds: {
        knowledgePublished: { minDeltaPct: 0 }, // at least 1
      },
      baseline: { knowledgePublished: 1 },
    });
     
    console.log('[DigitalTwin] Lab run completed:', result.verdict);
  });

  // 3. Build adapters (will resolve to Mock by default).
  const adapters = getAdapters();

  // 4. Register all cortexes + ZGS in boot order.
  const cortexes = buildAllCortexes(adapters);
  for (const c of cortexes) {
    zcc.registerCortex({
      id: c.id,
      start: () => c.start(),
      stop: () => c.stop(),
    });
  }
  const zgs = new ZellaGrowthStrategy(adapters);
  zcc.registerCortex({
    id: 'zgs',
    start: () => zgs.start(),
    stop: () => zgs.stop(),
  });

  // 5. Boot.
  await zcc.boot();

  // 6. Optionally seed Synthetic Brazil.
  if (opts.seedSyntheticBrazil !== false) {
    // Generate a small slice on boot — the full 250k guests would be too
    // heavy for a cold start. The Lab can request a larger slice on demand.
    const brazil = generateSyntheticBrazil({
      cityCount: 50,
      pousadaCount: 500,
      airbnbCount: 4000,
      guestCount: 5000,
      competitorCount: 20,
      historyYears: 0,
    });
     
    console.log(
      `[DigitalTwin] Synthetic Brazil seeded: ${brazil.cities.length} cities, ${brazil.pousadas.length} pousadas, ${brazil.airbnbs.length} airbnbs, ${brazil.guests.length} guests, ${brazil.competitors.length} competitors`
    );
  }

  booted = true;
}

/**
 * Whether the Digital Twin has been booted.
 */
export function isDigitalTwinBooted(): boolean {
  return booted;
}

/**
 * Top-level snapshot for observability.
 */
export function digitalTwinSnapshot() {
  return {
    booted,
    operatingMode: zcc.getOperatingMode(),
    modeMap: resolveModeMap(),
    health: zcc.health(),
    labResults: simulationLab.getResults().slice(-10),
  };
}

// Re-export the key simulators so callers have a single import.
export { simulationLab, adsSimulator, nationalSimulator, behavioralEngine, generateSyntheticBrazil };
export { zcc } from '@/domain/zcc';
export { getAdapters, buildAdapterBundle } from '@/adapters';
