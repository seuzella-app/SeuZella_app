// ============================================================================
// Executive Cortex
// ----------------------------------------------------------------------------
// The strategic cortex. It synthesises knowledge from all other cortexes
// into high-level strategic narratives for the ZGS and for human executives.
//
// Responsibilities:
//   - Aggregate CAC, LTV, churn, NPS, win rate into a "business health" score.
//   - Detect cross-cortex patterns (e.g. "Market Intel sees competitor price
//     cuts AND Revenue sees churn rising AND Growth sees CAC rising →
//     strategic pricing review needed").
//   - Publish a daily Executive Brief on the ZCB.
//   - Escalate `alert` severity events into actionable executive decisions.
// ============================================================================

import { CortexBase } from './CortexBase';
import type { AdapterBundle } from '@/adapters';
import type { CognitiveEvent } from '@/domain/zcc';

interface BusinessHealthScore {
  date: string;
  overall: number; // 0..100
  components: {
    growth: number;
    revenue: number;
    success: number;
    market: number;
  };
  trend: 'up' | 'flat' | 'down';
  notes: string[];
}

export class ExecutiveCortex extends CortexBase {
  readonly id = 'executive' as const;

  private healthHistory: BusinessHealthScore[] = [];
  private alerts: { at: string; source: string; payload: Record<string, unknown> }[] = [];

  protected async onStart(): Promise<void> {
    this.subscribe('growth.cac.updated', (e) => this.handleCacUpdate(e));
    this.subscribe('revenue.churn', (e) => this.handleChurn(e));
    this.subscribe('revenue.expansion', (e) => this.handleExpansion(e));
    this.subscribe('market.competitor.observed', (e) => this.handleCompetitor(e));
    this.subscribe('knowledge.published', (e) => this.handleKnowledgePublished(e));
    // Subscribe to all `alert` severity events.
    this.subscribe('zcc', (e) => {
      if (e.severity === 'alert') this.handleAlert(e);
    });
  }

  private async handleCacUpdate(_e: CognitiveEvent): Promise<void> {
    // Could feed a CAC-trend component of the health score.
  }

  private async handleChurn(_e: CognitiveEvent): Promise<void> {
    // Could lower the revenue health component.
  }

  private async handleExpansion(_e: CognitiveEvent): Promise<void> {
    // Could lift the revenue health component.
  }

  private async handleCompetitor(e: CognitiveEvent): Promise<void> {
    const { signal, intensity } = e.payload as { signal: string; intensity: number };
    if (signal === 'price-cut' && intensity > 0.5) {
      // Cross-cortex pattern: market intel sees price cut, growth will see CAC pressure.
      await this.emit('executive.alert', {
        kind: 'pricing-pressure',
        message: 'Competitor price cut detected — recommend strategic pricing review',
        severity: 'decision',
      });
    }
  }

  private async handleKnowledgePublished(e: CognitiveEvent): Promise<void> {
    // When the Market Intelligence Cortex publishes a price-cut knowledge,
    // synthesize a strategic narrative.
    const { type, title } = e.payload as { type: string; title: string };
    if (type === 'competitor.price-cut') {
      await this.emit('executive.brief', {
        headline: `Strategic pricing review needed: ${title}`,
        sources: ['market-intelligence', 'growth'],
        recommendedActions: ['audit-pricing', 'review-positioning', 'prepare-retention-play'],
      });
    }
  }

  private async handleAlert(e: CognitiveEvent): Promise<void> {
    this.alerts.push({
      at: new Date().toISOString(),
      source: e.source,
      payload: e.payload as Record<string, unknown>,
    });
    // If the alert is from ZCC about a cortex failing to start, escalate.
    if (e.type === 'cortex.start.failed') {
      await this.emit('executive.escalation', {
        kind: 'cortex-down',
        payload: e.payload,
      });
    }
  }

  /**
   * Compute today's business health score and emit it as the daily brief.
   * Designed to be called by a cron job.
   */
  async publishDailyBrief(): Promise<BusinessHealthScore> {
    // Simplified: in production this would query all cortexes for their snapshots.
    const score: BusinessHealthScore = {
      date: new Date().toISOString().slice(0, 10),
      overall: 72,
      components: {
        growth: 70,
        revenue: 75,
        success: 68,
        market: 78,
      },
      trend: this.healthHistory.length > 0 ? 'flat' : 'up',
      notes: this.alerts
        .slice(-5)
        .map((a) => `[${a.source}] ${JSON.stringify(a.payload).slice(0, 120)}`),
    };
    this.healthHistory.push(score);
    if (this.healthHistory.length > 90) this.healthHistory.shift();
    await this.emit('executive.daily-brief', score as unknown as Record<string, unknown>, 'decision');
    return score;
  }

  getHealthHistory(): BusinessHealthScore[] {
    return [...this.healthHistory];
  }

  getAlerts() {
    return [...this.alerts];
  }

  snapshot() {
    return {
      healthHistory: this.getHealthHistory(),
      recentAlerts: this.getAlerts().slice(-20),
    };
  }
}
