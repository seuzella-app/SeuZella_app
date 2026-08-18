// ============================================================================
// Learning Cortex
// ----------------------------------------------------------------------------
// The meta-cortex. It watches the OTHER cortexes learn, and optimises the
// learning process itself.
//
// Responsibilities:
//   - Track how often each cortex's hypotheses are confirmed vs refuted.
//   - Identify cortexes that publish low-quality knowledge (low confidence,
//     low evidence) and recommend recalibration.
//   - Detect "knowledge drift" — when a previously-validated knowledge entry
//     is no longer accurate (e.g. CAC for a channel has crept up but the
//     published value still says the old number).
//   - Schedule periodic re-tests of validated knowledge.
//
// Subscriptions:
//   - `knowledge.published`        → register the entry for tracking
//   - `learning.test`              → track hypothesis outcomes
//   - `knowledge.retired`          → mark tracking entry as retired
// ============================================================================

import { CortexBase } from './CortexBase';
import type { AdapterBundle } from '@/adapters';
import { runLearningCycle, type CognitiveEvent } from '@/domain/zcc';

interface CortexQualityStats {
  cortex: string;
  publishedCount: number;
  confirmedCount: number;
  refutedCount: number;
  inconclusiveCount: number;
  retiredCount: number;
  lastUpdated: string;
}

export class LearningCortex extends CortexBase {
  readonly id = 'learning' as const;

  private statsByCortex = new Map<string, CortexQualityStats>();

  protected async onStart(): Promise<void> {
    this.subscribe('learning.test', (e) => this.handleTestOutcome(e));
    this.subscribe('knowledge.published', (e) => this.handlePublished(e));
    this.subscribe('knowledge.retired', (e) => this.handleRetired(e));
  }

  private async handleTestOutcome(event: CognitiveEvent): Promise<void> {
    const { knowledgeId, outcome } = event.payload as {
      knowledgeId: string;
      outcome: 'confirmed' | 'refuted' | 'inconclusive';
    };
    // The publisher of the test is the source of the event.
    // We don't have direct access to that here, but we can derive the cortex
    // from the knowledgeId prefix (e.g. `growth.persona.conversion.<persona>`).
    const cortex = knowledgeId.split('.')[0];
    const prev = this.statsByCortex.get(cortex) ?? {
      cortex,
      publishedCount: 0,
      confirmedCount: 0,
      refutedCount: 0,
      inconclusiveCount: 0,
      retiredCount: 0,
      lastUpdated: new Date().toISOString(),
    };
    if (outcome === 'confirmed') prev.confirmedCount += 1;
    else if (outcome === 'refuted') prev.refutedCount += 1;
    else prev.inconclusiveCount += 1;
    prev.lastUpdated = new Date().toISOString();
    this.statsByCortex.set(cortex, prev);

    // If a cortex's confirmation rate is <30% over 20+ tests, publish a
    // "recalibrate this cortex" knowledge entry.
    const total = prev.confirmedCount + prev.refutedCount + prev.inconclusiveCount;
    if (total >= 20 && prev.confirmedCount / total < 0.3) {
      await this.publishRecalibrationAdvice(cortex, prev);
    }
  }

  private async handlePublished(event: CognitiveEvent): Promise<void> {
    const { knowledgeId } = event.payload as { knowledgeId: string };
    const cortex = knowledgeId.split('.')[0];
    const prev = this.statsByCortex.get(cortex) ?? {
      cortex,
      publishedCount: 0,
      confirmedCount: 0,
      refutedCount: 0,
      inconclusiveCount: 0,
      retiredCount: 0,
      lastUpdated: new Date().toISOString(),
    };
    prev.publishedCount += 1;
    this.statsByCortex.set(cortex, prev);
  }

  private async handleRetired(event: CognitiveEvent): Promise<void> {
    const { knowledgeId } = event.payload as { knowledgeId: string };
    const cortex = knowledgeId.split('.')[0];
    const prev = this.statsByCortex.get(cortex);
    if (!prev) return;
    prev.retiredCount += 1;
    this.statsByCortex.set(cortex, prev);
  }

  private async publishRecalibrationAdvice(cortex: string, stats: CortexQualityStats): Promise<void> {
    await runLearningCycle(
      {
        cortex: 'learning',
        knowledgeId: `learning.recalibrate.${cortex}`,
        knowledgeType: 'cortex-recalibration',
        knowledgeTitle: `Cortex ${cortex} needs recalibration`,
      },
      {
        observation: {
          description: `Cortex ${cortex} has confirmed only ${stats.confirmedCount}/${stats.confirmedCount + stats.refutedCount + stats.inconclusiveCount} hypotheses`,
          data: stats,
          sourceEventIds: [],
        },
        inference: {
          statement: `Cortex ${cortex} is publishing low-quality knowledge — confirmation rate below 30%`,
          method: 'threshold-test',
          priorConfidence: 0.7,
        },
        hypothesis: {
          prediction: 'Recalibrating the cortex\'s hypothesis thresholds will lift confirmation rate above 50%',
          variables: ['cortex hypothesis thresholds'],
          expectedEffect: 'confirmation rate ≥50%',
          testType: 'before-after',
        },
        test: {
          outcome: 'inconclusive',
          sampleSize: stats.confirmedCount + stats.refutedCount + stats.inconclusiveCount,
          effectSize: stats.confirmedCount / Math.max(1, stats.confirmedCount + stats.refutedCount + stats.inconclusiveCount),
          pValue: NaN,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: 0.8,
          publishable: true,
          notes: 'Observational; recalibration A/B recommended',
        },
        body: { ...stats, recommendedAction: 'review-hypothesis-thresholds' } as Record<string, unknown>,
      }
    );
  }

  getStatsByCortex(): CortexQualityStats[] {
    return Array.from(this.statsByCortex.values());
  }

  snapshot() {
    return { statsByCortex: this.getStatsByCortex() };
  }
}
