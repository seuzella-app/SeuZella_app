// ============================================================================
// Success Cortex
// ----------------------------------------------------------------------------
// Owns post-onboarding customer success. Observes:
//   - Feature adoption (which features the tenant has used in the first 7/14/30 days)
//   - Support ticket volume + resolution time
//   - NPS / CSAT signals
//   - Health score (composite of usage + payment + support)
//
// Publishes knowledge about:
//   - Activation patterns (which feature sequences predict long-term retention)
//   - At-risk tenants (health score thresholds)
//   - Expansion-ready tenants (usage patterns that precede upgrades)
// ============================================================================

import { CortexBase } from './CortexBase';
import type { AdapterBundle } from '@/adapters';
import { runLearningCycle, type CognitiveEvent } from '@/domain/zcc';

interface HealthScore {
  tenantId: string;
  score: number; // 0..100
  factors: Record<string, number>;
  updatedAt: string;
}

interface ActivationPattern {
  featureSequence: string[];
  retentionLift: number;
  sampleSize: number;
  updatedAt: string;
}

export class SuccessCortex extends CortexBase {
  readonly id = 'success' as const;

  private healthScores = new Map<string, HealthScore>();
  private activationPatterns: ActivationPattern[] = [];

  protected async onStart(): Promise<void> {
    this.subscribe('tenant.feature.used', (e) => this.handleFeatureUse(e));
    this.subscribe('support.ticket.created', (e) => this.handleTicket(e));
    this.subscribe('support.ticket.resolved', (e) => this.handleTicketResolved(e));
    this.subscribe('nps.submitted', (e) => this.handleNps(e));
    this.subscribe('activation.pattern.observed', (e) => this.handleActivationPattern(e));
  }

  private async handleFeatureUse(event: CognitiveEvent): Promise<void> {
    const { tenantId, feature } = event.payload as { tenantId: string; feature: string };
    const prev = this.healthScores.get(tenantId) ?? {
      tenantId,
      score: 50,
      factors: {},
      updatedAt: new Date().toISOString(),
    };
    prev.factors[`feature_${feature}`] = (prev.factors[`feature_${feature}`] ?? 0) + 1;
    prev.score = this.computeHealth(prev);
    prev.updatedAt = new Date().toISOString();
    this.healthScores.set(tenantId, prev);
  }

  private async handleTicket(event: CognitiveEvent): Promise<void> {
    const { tenantId } = event.payload as { tenantId: string };
    const prev = this.healthScores.get(tenantId) ?? {
      tenantId,
      score: 50,
      factors: {},
      updatedAt: new Date().toISOString(),
    };
    prev.factors.openTickets = (prev.factors.openTickets ?? 0) + 1;
    prev.score = this.computeHealth(prev);
    this.healthScores.set(tenantId, prev);
  }

  private async handleTicketResolved(event: CognitiveEvent): Promise<void> {
    const { tenantId, resolutionHours } = event.payload as { tenantId: string; resolutionHours: number };
    const prev = this.healthScores.get(tenantId);
    if (!prev) return;
    prev.factors.openTickets = Math.max(0, (prev.factors.openTickets ?? 0) - 1);
    if (resolutionHours < 24) prev.factors.fastResolutions = (prev.factors.fastResolutions ?? 0) + 1;
    prev.score = this.computeHealth(prev);
    this.healthScores.set(tenantId, prev);
  }

  private async handleNps(event: CognitiveEvent): Promise<void> {
    const { tenantId, score } = event.payload as { tenantId: string; score: number };
    const prev = this.healthScores.get(tenantId) ?? {
      tenantId,
      score: 50,
      factors: {},
      updatedAt: new Date().toISOString(),
    };
    prev.factors.nps = score;
    prev.score = this.computeHealth(prev);
    this.healthScores.set(tenantId, prev);
  }

  private async handleActivationPattern(event: CognitiveEvent): Promise<void> {
    const { features, retentionLift } = event.payload as { features: string[]; retentionLift: number };
    const existing = this.activationPatterns.find(
      (p) => p.featureSequence.join('→') === features.join('→')
    );
    if (existing) {
      existing.sampleSize += 1;
      existing.retentionLift = (existing.retentionLift * (existing.sampleSize - 1) + retentionLift) / existing.sampleSize;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.activationPatterns.push({
        featureSequence: features,
        retentionLift,
        sampleSize: 1,
        updatedAt: new Date().toISOString(),
      });
    }

    // Publish knowledge for strong patterns.
    const pattern = this.activationPatterns.find((p) => p.featureSequence.join('→') === features.join('→'));
    if (pattern && pattern.sampleSize >= 30 && pattern.retentionLift > 0.2) {
      await this.publishActivationKnowledge(pattern);
    }
  }

  private computeHealth(h: HealthScore): number {
    let score = 50;
    // +5 per feature used, max +30.
    const featureCount = Object.keys(h.factors)
      .filter((k) => k.startsWith('feature_'))
      .length;
    score += Math.min(30, featureCount * 5);
    // -5 per open ticket, max -20.
    score -= Math.min(20, (h.factors.openTickets ?? 0) * 5);
    // +3 per fast resolution, max +15.
    score += Math.min(15, (h.factors.fastResolutions ?? 0) * 3);
    // NPS adjustment.
    if (typeof h.factors.nps === 'number') {
      score += (h.factors.nps - 5) * 2;
    }
    return Math.max(0, Math.min(100, score));
  }

  private async publishActivationKnowledge(p: ActivationPattern): Promise<void> {
    await runLearningCycle(
      {
        cortex: 'success',
        knowledgeId: `success.activation.${p.featureSequence.join('_')}`,
        knowledgeType: 'activation-pattern',
        knowledgeTitle: `Activation pattern: ${p.featureSequence.join(' → ')}`,
      },
      {
        observation: {
          description: `${p.sampleSize} tenants activated via ${p.featureSequence.join(' → ')} → retention lift ${(p.retentionLift * 100).toFixed(0)}%`,
          data: p,
          sourceEventIds: [],
        },
        inference: {
          statement: `Activation via ${p.featureSequence.join(' → ')} lifts retention by ${(p.retentionLift * 100).toFixed(0)}%`,
          method: 'cohort-comparison',
          priorConfidence: 0.7,
        },
        hypothesis: {
          prediction: 'Onboarding new tenants through this sequence will lift retention by ≥15%',
          variables: ['onboarding sequence'],
          expectedEffect: '≥15% retention lift',
          testType: 'ab',
        },
        test: {
          outcome: 'inconclusive',
          sampleSize: p.sampleSize,
          effectSize: p.retentionLift,
          pValue: NaN,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: Math.min(0.9, 0.5 + p.sampleSize / 100),
          publishable: p.sampleSize >= 30,
          notes: 'Observational; onboarding A/B test recommended',
        },
        body: { ...p, recommendedAction: 'codify-into-onboarding' } as Record<string, unknown>,
      }
    );
  }

  getHealthScores(): HealthScore[] {
    return Array.from(this.healthScores.values());
  }

  getActivationPatterns(): ActivationPattern[] {
    return [...this.activationPatterns];
  }

  snapshot() {
    return {
      healthScores: this.getHealthScores(),
      activationPatterns: this.getActivationPatterns(),
    };
  }
}
