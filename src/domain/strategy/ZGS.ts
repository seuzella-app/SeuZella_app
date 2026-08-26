// ============================================================================
// ZGS — Zélla Growth Strategy
// ----------------------------------------------------------------------------
// The strategic decision layer above the Growth Cortex.
//
//   Growth Cortex learns → ZGS decides.
//
// The ZGS reads knowledge published by Growth, Market Intelligence, Sales,
// Revenue, Success, and Executive cortexes, and converts it into strategic
// decisions:
//
//   - Budget allocation: which channels get more / less budget next month
//   - Campaign creation: what new campaigns to launch (channels, audiences)
//   - Pricing strategy: plan / room price adjustments
//   - ICP refinement: which personas / niches to prioritise
//   - Funnel intervention: which funnel steps to fix first
//
// The ZGS does NOT execute decisions directly. It emits `zgs.decision.*`
// events on the ZCB. A downstream executor (human or automation) picks them
// up. This separation keeps the ZGS pure: it only reasons, never acts.
//
// Subscriptions:
//   - `knowledge.published`   → ingest new validated knowledge
//   - `growth.cac.updated`    → react to CAC changes
//   - `market.competitor.*`   → react to competitor moves
//   - `revenue.churn`         → react to churn
//   - `executive.daily-brief` → incorporate daily brief into strategy
// ============================================================================

import { CortexBase } from '@/domain/cortex/CortexBase';
import type { AdapterBundle } from '@/adapters';
import type { KnowledgeEntry, CognitiveEvent } from '@/domain/zcc';
import { sharedMemory } from '@/domain/zcc';

export interface StrategicDecision {
  decisionId: string;
  kind: 'budget-reallocation' | 'campaign-creation' | 'pricing-change' | 'icp-refinement' | 'funnel-intervention';
  rationale: string;
  inputs: { knowledgeId: string; weight: number }[];
  recommendation: Record<string, unknown>;
  expectedImpact: { metric: string; deltaPct: number; confidence: number };
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
  createdAt: string;
}

export class ZellaGrowthStrategy extends CortexBase {
  readonly id = 'zgs' as const;

  private decisions: StrategicDecision[] = [];

  protected async onStart(): Promise<void> {
    this.subscribe('knowledge.published', (e) => this.handleKnowledge(e));
    this.subscribe('growth.cac.updated', (e) => this.handleCacUpdate(e));
    this.subscribe('market.competitor.observed', (e) => this.handleCompetitor(e));
    this.subscribe('revenue.churn', (e) => this.handleChurn(e));
    this.subscribe('executive.daily-brief', (e) => this.handleDailyBrief(e));
  }

  // ---- Knowledge ingestion -----------------------------------------------

  private async handleKnowledge(event: CognitiveEvent): Promise<void> {
    const { knowledgeId, type, confidence } = event.payload as {
      knowledgeId: string;
      type: string;
      confidence: number;
    };

    // Only act on high-confidence knowledge.
    if (confidence < 0.6) return;

    switch (type) {
      case 'funnel.dropoff':
        await this.proposeFunnelIntervention(knowledgeId, confidence);
        break;
      case 'competitor.price-cut':
        await this.proposePricingResponse(knowledgeId, confidence);
        break;
      case 'persona.conversion':
        await this.proposeICPRefinement(knowledgeId, confidence);
        break;
      case 'churn-predictor':
        await this.proposeRetentionPlay(knowledgeId, confidence);
        break;
      case 'keyword.opportunity':
        await this.proposeNewCampaign(knowledgeId, confidence, 'google_ads');
        break;
    }
  }

  private async handleCacUpdate(event: CognitiveEvent): Promise<void> {
    const { channel, cacBRL, sampleSize } = event.payload as {
      channel: string;
      cacBRL: number;
      sampleSize: number;
    };
    if (sampleSize < 30) return; // not enough data
    // Compare with portfolio average.
    const portfolioAvg = await this.computePortfolioAvgCAC();
    if (portfolioAvg === 0) return;
    const ratio = cacBRL / portfolioAvg;
    if (ratio > 1.5) {
      // This channel is 50%+ more expensive → propose budget reallocation away.
      await this.proposeBudgetReallocation({
        from: channel,
        to: ratio > 2 ? 'best-performing' : 'shared',
        reason: `CAC for ${channel} (R$ ${cacBRL.toFixed(2)}) is ${(ratio * 100 - 100).toFixed(0)}% above portfolio average`,
        confidence: Math.min(0.9, sampleSize / 100),
      });
    } else if (ratio < 0.6) {
      // This channel is 40%+ cheaper → propose budget reallocation toward.
      await this.proposeBudgetReallocation({
        from: 'shared',
        to: channel,
        reason: `CAC for ${channel} (R$ ${cacBRL.toFixed(2)}) is ${((1 - ratio) * 100).toFixed(0)}% below portfolio average`,
        confidence: Math.min(0.9, sampleSize / 100),
      });
    }
  }

  private async handleCompetitor(event: CognitiveEvent): Promise<void> {
    const { signal, intensity } = event.payload as { signal: string; intensity: number };
    if (signal === 'price-cut' && intensity > 0.7) {
      await this.proposePricingResponse('competitor-event', 0.7);
    }
  }

  private async handleChurn(event: CognitiveEvent): Promise<void> {
    const { niche, reason } = event.payload as { niche: string; reason: string };
    if (!reason) return;
    await this.proposeRetentionPlay(`churn-event:${niche}:${reason}`, 0.6);
  }

  private async handleDailyBrief(event: CognitiveEvent): Promise<void> {
    const brief = event.payload as { overall: number; trend: string };
    if (brief.overall < 50) {
      await this.proposeStrategicReview(brief.overall, brief.trend);
    }
  }

  // ---- Decision proposals ------------------------------------------------

  private async proposeBudgetReallocation(opts: {
    from: string;
    to: string;
    reason: string;
    confidence: number;
  }): Promise<void> {
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'budget-reallocation',
      rationale: opts.reason,
      inputs: [],
      recommendation: {
        from: opts.from,
        to: opts.to,
        magnitudePct: 15, // move 15% of budget
        timeframe: 'next-30-days',
      },
      expectedImpact: {
        metric: 'blended-cac',
        deltaPct: -8,
        confidence: opts.confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposeNewCampaign(
    knowledgeId: string,
    confidence: number,
    channel: 'google_ads' | 'meta_ads'
  ): Promise<void> {
    const entry = sharedMemory.get(knowledgeId);
    if (!entry) return;
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'campaign-creation',
      rationale: `New campaign based on market intel: ${entry.title}`,
      inputs: [{ knowledgeId, weight: 1.0 }],
      recommendation: {
        channel,
        budgetDailyBRL: 50, // small test budget
        durationDays: 14,
        ...entry.body,
      },
      expectedImpact: {
        metric: 'qualified-leads',
        deltaPct: 20,
        confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposePricingResponse(_knowledgeId: string, confidence: number): Promise<void> {
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'pricing-change',
      rationale: 'Competitor price cut detected — review positioning before responding with price',
      inputs: [],
      recommendation: {
        action: 'review-positioning-first',
        avoidPriceWar: true,
        counterMoves: ['add-value', 'improve-onboarding', 'reinforce-brand'],
      },
      expectedImpact: {
        metric: 'gross-margin',
        deltaPct: 0, // protect margin, not grow it
        confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposeICPRefinement(knowledgeId: string, confidence: number): Promise<void> {
    const entry = sharedMemory.get(knowledgeId);
    if (!entry) return;
    const {personaId} = (entry.body as { personaId?: string });
    if (!personaId) return;
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'icp-refinement',
      rationale: `Persona ${personaId} shows distinct conversion pattern`,
      inputs: [{ knowledgeId, weight: 1.0 }],
      recommendation: {
        personaId,
        action: 'adjust-targeting',
        segmentBudget: 'increase' as const,
      },
      expectedImpact: {
        metric: 'lead-quality',
        deltaPct: 12,
        confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposeFunnelIntervention(knowledgeId: string, confidence: number): Promise<void> {
    const entry = sharedMemory.get(knowledgeId);
    if (!entry) return;
    const {step} = (entry.body as { step?: string });
    if (!step) return;
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'funnel-intervention',
      rationale: `Funnel step "${step}" has high drop-off`,
      inputs: [{ knowledgeId, weight: 1.0 }],
      recommendation: {
        step,
        action: 'ux-audit-and-ab-test',
        expectedDropoffReductionPct: 15,
      },
      expectedImpact: {
        metric: 'conversion-rate',
        deltaPct: 15,
        confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposeRetentionPlay(knowledgeId: string, confidence: number): Promise<void> {
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'funnel-intervention',
      rationale: `Churn signal detected: ${knowledgeId}`,
      inputs: [{ knowledgeId, weight: 1.0 }],
      recommendation: {
        action: 'design-retention-play',
        steps: ['identify-at-risk-cohort', 'design-intervention', 'ab-test'],
      },
      expectedImpact: {
        metric: 'churn-rate',
        deltaPct: -20,
        confidence,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  private async proposeStrategicReview(overall: number, trend: string): Promise<void> {
    const decision: StrategicDecision = {
      decisionId: `zgs_decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'icp-refinement',
      rationale: `Business health score ${overall}/100 (${trend}) — strategic review needed`,
      inputs: [],
      recommendation: {
        action: 'convene-strategic-review',
        participants: ['executive', 'growth', 'revenue', 'success'],
        scope: 'full-funnel-audit',
      },
      expectedImpact: {
        metric: 'business-health',
        deltaPct: 15,
        confidence: 0.6,
      },
      status: 'proposed',
      createdAt: new Date().toISOString(),
    };
    this.decisions.push(decision);
    await this.emit('zgs.decision.proposed', decision as unknown as Record<string, unknown>, 'decision');
  }

  // ---- Helpers -----------------------------------------------------------

  private async computePortfolioAvgCAC(): Promise<number> {
    // Query the Growth Cortex's published CAC knowledge.
    const entries = sharedMemory.query({
      type: 'channel-cac',
      status: 'validated',
      minConfidence: 0.5,
    });
    if (entries.length === 0) return 0;
    const sum = entries.reduce((s, e) => s + ((e.body as { cacBRL?: number }).cacBRL ?? 0), 0);
    return sum / entries.length;
  }

  // ---- Public API --------------------------------------------------------

  getDecisions(opts?: { status?: StrategicDecision['status']; kind?: StrategicDecision['kind']; limit?: number }): StrategicDecision[] {
    let d = [...this.decisions];
    if (opts?.status) d = d.filter((x) => x.status === opts.status);
    if (opts?.kind) d = d.filter((x) => x.kind === opts.kind);
    if (opts?.limit) d = d.slice(-opts.limit);
    return d;
  }

  /**
   * Update the status of a decision (e.g. mark as approved / executed).
   * Called by the human / automation that picked up the decision.
   */
  async updateDecisionStatus(decisionId: string, status: StrategicDecision['status']): Promise<void> {
    const idx = this.decisions.findIndex((d) => d.decisionId === decisionId);
    if (idx === -1) return;
    this.decisions[idx] = { ...this.decisions[idx], status };
    await this.emit('zgs.decision.status-changed', { decisionId, status }, 'decision');
  }

  snapshot() {
    return {
      decisions: this.getDecisions(),
      proposedCount: this.decisions.filter((d) => d.status === 'proposed').length,
      approvedCount: this.decisions.filter((d) => d.status === 'approved').length,
      executedCount: this.decisions.filter((d) => d.status === 'executed').length,
    };
  }
}
