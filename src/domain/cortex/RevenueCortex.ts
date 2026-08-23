// ============================================================================
// Revenue Cortex
// ----------------------------------------------------------------------------
// Owns MRR, churn, expansion, LTV. Observes:
//   - Subscription lifecycle (created, upgraded, downgraded, churned)
//   - Payment outcomes
//   - Plan changes
//
// Publishes knowledge about:
//   - LTV by niche / persona / plan
//   - Churn predictors (e.g. "Tenants with <3 logins in first 14 days churn 4x")
//   - Expansion triggers (e.g. "Tenants who hit room limit upgrade within 30 days 80% of the time")
// ============================================================================

import { CortexBase } from './CortexBase';
import type { AdapterBundle } from '@/adapters';
import { runLearningCycle, type CognitiveEvent } from '@/domain/zcc';

interface LTVBySegment {
  segment: string; // e.g. 'niche:pousada|plan:PRO'
  ltvBRL: number;
  sampleSize: number;
  updatedAt: string;
}

interface ChurnPredictor {
  signal: string;
  churnMultiplier: number;
  sampleSize: number;
  updatedAt: string;
}

export class RevenueCortex extends CortexBase {
  readonly id = 'revenue' as const;

  private ltvBySegment = new Map<string, LTVBySegment>();
  private churnPredictors = new Map<string, ChurnPredictor>();

  protected async onStart(): Promise<void> {
    this.subscribe('subscription.created', (e) => this.handleSubCreated(e));
    this.subscribe('subscription.upgraded', (e) => this.handleUpgrade(e));
    this.subscribe('subscription.churned', (e) => this.handleChurn(e));
    this.subscribe('payment.succeeded', (e) => this.handlePayment(e));
    this.subscribe('churn.signal', (e) => this.handleChurnSignal(e));
  }

  private async handleSubCreated(event: CognitiveEvent): Promise<void> {
    const { niche, plan } = event.payload as { niche: string; plan: string };
    if (!niche || !plan) return;
    const key = `niche:${niche}|plan:${plan}`;
    if (!this.ltvBySegment.has(key)) {
      this.ltvBySegment.set(key, {
        segment: key,
        ltvBRL: 0,
        sampleSize: 0,
        updatedAt: new Date().toISOString(),
      });
    }
    const entry = this.ltvBySegment.get(key)!;
    entry.sampleSize += 1;
    this.ltvBySegment.set(key, entry);
  }

  private async handleUpgrade(event: CognitiveEvent): Promise<void> {
    const { niche, fromPlan, toPlan, monthlyDeltaBRL } = event.payload as {
      niche: string;
      fromPlan: string;
      toPlan: string;
      monthlyDeltaBRL: number;
    };
    // Update LTV projection for the upgraded segment.
    const key = `niche:${niche}|plan:${toPlan}`;
    const prev = this.ltvBySegment.get(key) ?? {
      segment: key,
      ltvBRL: 0,
      sampleSize: 0,
      updatedAt: new Date().toISOString(),
    };
    prev.ltvBRL += monthlyDeltaBRL * 12; // assume 12-month minimum tenure
    prev.updatedAt = new Date().toISOString();
    this.ltvBySegment.set(key, prev);
    await this.emit('revenue.expansion', { niche, fromPlan, toPlan, monthlyDeltaBRL });
  }

  private async handleChurn(event: CognitiveEvent): Promise<void> {
    const { niche, plan, tenureDays, reason } = event.payload as {
      niche: string;
      plan: string;
      tenureDays: number;
      reason: string;
    };
    await this.emit('revenue.churn', { niche, plan, tenureDays, reason });
    // If churn signal correlated, publish knowledge.
    if (reason) {
      const prev = this.churnPredictors.get(reason) ?? {
        signal: reason,
        churnMultiplier: 1.0,
        sampleSize: 0,
        updatedAt: new Date().toISOString(),
      };
      prev.sampleSize += 1;
      prev.churnMultiplier = Math.min(10, prev.churnMultiplier + 0.2);
      this.churnPredictors.set(reason, prev);
      if (prev.sampleSize >= 20) {
        await this.publishChurnPredictor(prev);
      }
    }
  }

  private async handlePayment(event: CognitiveEvent): Promise<void> {
    const { amountBRL, niche, plan } = event.payload as {
      amountBRL: number;
      niche: string;
      plan: string;
    };
    const key = `niche:${niche}|plan:${plan}`;
    const prev = this.ltvBySegment.get(key);
    if (!prev) return;
    prev.ltvBRL += amountBRL;
    prev.updatedAt = new Date().toISOString();
    this.ltvBySegment.set(key, prev);
  }

  private async handleChurnSignal(event: CognitiveEvent): Promise<void> {
    const { signal } = event.payload as { signal: string };
    const prev = this.churnPredictors.get(signal) ?? {
      signal,
      churnMultiplier: 1.0,
      sampleSize: 0,
      updatedAt: new Date().toISOString(),
    };
    prev.sampleSize += 1;
    this.churnPredictors.set(signal, prev);
  }

  private async publishChurnPredictor(p: ChurnPredictor): Promise<void> {
    await runLearningCycle(
      {
        cortex: 'revenue',
        knowledgeId: `revenue.churn-predictor.${p.signal.replace(/\s+/g, '_')}`,
        knowledgeType: 'churn-predictor',
        knowledgeTitle: `Churn signal: ${p.signal}`,
      },
      {
        observation: {
          description: `${p.sampleSize} tenants with signal "${p.signal}" → churn multiplier ${p.churnMultiplier.toFixed(2)}x`,
          data: p,
          sourceEventIds: [],
        },
        inference: {
          statement: `Signal "${p.signal}" predicts churn at ${p.churnMultiplier.toFixed(2)}x baseline`,
          method: 'cohort-comparison',
          priorConfidence: 0.6,
        },
        hypothesis: {
          prediction: 'Early intervention on this signal reduces churn by ≥20%',
          variables: ['intervention timing'],
          expectedEffect: '≥20% churn reduction',
          testType: 'ab',
        },
        test: {
          outcome: 'inconclusive',
          sampleSize: p.sampleSize,
          effectSize: p.churnMultiplier,
          pValue: NaN,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: Math.min(0.9, 0.5 + p.sampleSize / 100),
          publishable: p.sampleSize >= 20,
          notes: 'Observational; intervention A/B recommended',
        },
        body: { ...p, recommendedAction: 'design-intervention-experiment' } as Record<string, unknown>,
      }
    );
  }

  getLTVBySegment(): LTVBySegment[] {
    return Array.from(this.ltvBySegment.values());
  }

  getChurnPredictors(): ChurnPredictor[] {
    return Array.from(this.churnPredictors.values());
  }

  snapshot() {
    return {
      ltvBySegment: this.getLTVBySegment(),
      churnPredictors: this.getChurnPredictors(),
    };
  }
}
