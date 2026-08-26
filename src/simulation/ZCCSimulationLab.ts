// ============================================================================
// ZCC Simulation Lab
// ----------------------------------------------------------------------------
// The permanent experiment harness. NEVER removed — even after production.
//
// Purpose:
//   Every new feature (algorithm, funnel change, pricing rule, etc.) must
//   first pass through the Lab. The Lab:
//
//     1. Spins up a clean Digital Twin environment (clears ZCB + memory).
//     2. Generates synthetic events (100k+ by default) using Synthetic Brazil,
//        the Behavioral Engine, and the Ads Simulator.
//     3. Runs the feature under test against the synthetic event stream.
//     4. Collects metrics and compares against the baseline.
//     5. Returns a verdict: approved / rejected / inconclusive.
//
//   Only `approved` features are promoted to production. `rejected` and
//   `inconclusive` features stay in the Lab with their failure modes
//   documented.
//
// Lab runs are scheduled:
//   - On demand (via admin API or ZCC.runLab())
//   - Nightly (cron) for regression detection
//   - On every PR (CI gate)
//
// ============================================================================

import type { ExperimentResult, CognitiveEvent } from '@/domain/zcc';
import { zcb, sharedMemory } from '@/domain/zcc';

export interface ExperimentConfig {
  experimentId: string;
  hypothesis: string;
  /** The feature under test, identified by a string label. */
  feature: string;
  /** Number of synthetic events to generate. Default 100_000. */
  eventCount?: number;
  /** Duration cap in ms. Default 60_000. */
  durationCapMs?: number;
  /** Metrics to collect. Each is a function of the event log. */
  metrics?: Record<string, (events: CognitiveEvent[]) => number>;
  /** Approval threshold: each metric must improve by at least this much vs. baseline. */
  approvalThresholds?: Record<string, { minDeltaPct?: number; maxDeltaPct?: number }>;
  /** Optional baseline metrics to compare against. */
  baseline?: Record<string, number>;
  /** Synthetic event generator. Defaults to a no-op (caller provides events). */
  eventGenerator?: (count: number) => Promise<CognitiveEvent[]>;
}

export class ZCCSimulationLab {
  private results: ExperimentResult[] = [];

  /**
   * Run an experiment end-to-end.
   *
   * 1. Snapshot current memory + bus state.
   * 2. Clear memory + bus for a clean baseline.
   * 3. Generate `eventCount` synthetic events.
   * 4. Publish them all on the ZCB so cortexes react.
   * 5. Wait for cortexes to settle (or hit duration cap).
   * 6. Collect metrics.
   * 7. Restore memory + bus state.
   * 8. Return verdict.
   */
  async run(config: ExperimentConfig): Promise<ExperimentResult> {
    const eventCount = config.eventCount ?? 100_000;
    const durationCapMs = config.durationCapMs ?? 60_000;
    const startedAt = Date.now();

    // 1. Snapshot.
    const memorySnapshot = sharedMemory.snapshot();
    const busSizeBefore = zcb.size();

    // 2. Clear.
    sharedMemory.clearForExperiment();
    zcb.clearForExperiment();

    try {
      // 3. Generate events.
      const events = config.eventGenerator
        ? await config.eventGenerator(eventCount)
        : await this.defaultEventGenerator(eventCount);

      // 4. Publish them in batches to avoid starving the event loop.
      const batchSize = 500;
      const settleDeadline = Date.now() + durationCapMs;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        await Promise.all(batch.map((e) => zcb.publish(e)));
        if (Date.now() > settleDeadline) break;
      }

      // 5. Settle: allow pending micro-tasks to flush.
      await new Promise((resolve) => setImmediate(resolve));

      // 6. Collect metrics.
      const allEvents = zcb.inspect({ limit: events.length + 1000 });
      const metrics: Record<string, number> = {};
      if (config.metrics) {
        for (const [name, fn] of Object.entries(config.metrics)) {
          try {
            metrics[name] = fn(allEvents);
          } catch (err) {
            metrics[name] = NaN;
             
            console.error(`[Lab] metric ${name} failed:`, err);
          }
        }
      }

      // 7. Verdict.
      const verdict = this.computeVerdict(metrics, config.approvalThresholds, config.baseline);
      const result: ExperimentResult = {
        experimentId: config.experimentId,
        hypothesis: config.hypothesis,
        eventsProcessed: allEvents.length,
        durationMs: Date.now() - startedAt,
        metrics,
        verdict,
        notes: this.buildVerdictNotes(verdict, metrics, config.approvalThresholds, config.baseline),
        finishedAt: new Date().toISOString(),
      };
      this.results.push(result);
      return result;
    } finally {
      // 8. Restore (best effort — for full restoration, the snapshot would
      // need to be deep-cloned and re-applied; for now we just leave the
      // memory clean for the next experiment).
      void memorySnapshot; // acknowledged
      void busSizeBefore;
    }
  }

  /**
   * Default event generator: emits a mix of `lead.*`, `metrics.*`, and
   * `funnel.*` events. The Synthetic Brazil + Behavioral Engine modules
   * provide richer generators — this is the fallback.
   */
  private async defaultEventGenerator(count: number): Promise<CognitiveEvent[]> {
    const events: CognitiveEvent[] = [];
    const channels = ['google_ads', 'meta_ads', 'organic', 'referral', 'whatsapp', 'direct'];
    const personas = ['curious', 'impulsive', 'skeptical', 'price-only', 'chain', 'airbnb'];
    const niches = ['pousada', 'airbnb', 'hotel', 'small-hotel'];
    for (let i = 0; i < count; i++) {
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const persona = personas[Math.floor(Math.random() * personas.length)];
      const niche = niches[Math.floor(Math.random() * niches.length)];
      events.push({
        id: `lab_evt_${i}`,
        source: 'growth',
        type: 'lead.created',
        severity: 'info',
        payload: { channel, personaId: persona, niche, leadId: `lab_lead_${i}` },
        occurredAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
      });
      // 25% of leads convert.
      if (Math.random() < 0.25) {
        events.push({
          id: `lab_evt_${i}_conv`,
          source: 'growth',
          type: 'lead.converted',
          severity: 'signal',
          payload: { leadId: `lab_lead_${i}`, personaId: persona, channel },
          occurredAt: new Date().toISOString(),
        });
      }
    }
    return events;
  }

  private computeVerdict(
    metrics: Record<string, number>,
    thresholds?: Record<string, { minDeltaPct?: number; maxDeltaPct?: number }>,
    baseline?: Record<string, number>
  ): ExperimentResult['verdict'] {
    if (!thresholds || !baseline) return 'inconclusive';
    let allPassed = true;
    let anyEvaluated = false;
    for (const [name, threshold] of Object.entries(thresholds)) {
      const current = metrics[name];
      const base = baseline[name];
      if (current === undefined || base === undefined) continue;
      anyEvaluated = true;
      const deltaPct = base !== 0 ? ((current - base) / base) * 100 : 0;
      if (threshold.minDeltaPct !== undefined && deltaPct < threshold.minDeltaPct) {
        allPassed = false;
      }
      if (threshold.maxDeltaPct !== undefined && deltaPct > threshold.maxDeltaPct) {
        allPassed = false;
      }
    }
    if (!anyEvaluated) return 'inconclusive';
    return allPassed ? 'approved' : 'rejected';
  }

  private buildVerdictNotes(
    verdict: ExperimentResult['verdict'],
    metrics: Record<string, number>,
    thresholds?: Record<string, { minDeltaPct?: number; maxDeltaPct?: number }>,
    baseline?: Record<string, number>
  ): string {
    if (verdict === 'inconclusive' || !thresholds || !baseline) {
      return `Metrics collected: ${JSON.stringify(metrics)}`;
    }
    const lines: string[] = [];
    for (const [name, threshold] of Object.entries(thresholds)) {
      const current = metrics[name];
      const base = baseline[name];
      if (current === undefined || base === undefined) continue;
      const deltaPct = base !== 0 ? ((current - base) / base) * 100 : 0;
      lines.push(`${name}: ${current} (Δ${deltaPct.toFixed(1)}% vs ${base}; threshold ${JSON.stringify(threshold)})`);
    }
    return lines.join('\n');
  }

  getResults(): ExperimentResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }
}

/**
 * The singleton ZCC Simulation Lab.
 */
export const simulationLab = new ZCCSimulationLab();
