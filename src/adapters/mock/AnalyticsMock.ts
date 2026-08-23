// ============================================================================
// AnalyticsMock — Digital Twin analytics (GA4 + Search Console equivalent)
// ============================================================================

import type {
  IAnalyticsAdapter,
  AnalyticsEvent,
  AnalyticsPageView,
  AnalyticsSession,
  AnalyticsQueryOpts,
} from '../interfaces';
import { mulberry32, seedFromString, beta, gaussian } from './_stats';

class AnalyticsMock implements IAnalyticsAdapter {
  private events: AnalyticsEvent[] = [];
  private pageViews: AnalyticsPageView[] = [];

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
  }

  async trackPageView(view: AnalyticsPageView): Promise<void> {
    this.pageViews.push(view);
  }

  async listSessions(opts: AnalyticsQueryOpts): Promise<AnalyticsSession[]> {
    // Group page views by clientId + 30-min window.
    const byClient = new Map<string, AnalyticsPageView[]>();
    for (const pv of this.pageViews) {
      if (pv.timestamp < opts.from) continue;
      if (pv.timestamp > opts.to) continue;
      if (opts.path && pv.path !== opts.path) continue;
      if (opts.source && pv.utm?.source !== opts.source) continue;
      if (opts.campaign && pv.utm?.campaign !== opts.campaign) continue;
      const arr = byClient.get(pv.clientId) ?? [];
      arr.push(pv);
      byClient.set(pv.clientId, arr);
    }

    const sessions: AnalyticsSession[] = [];
    for (const [clientId, views] of byClient) {
      views.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      let current: AnalyticsSession | null = null;
      for (const v of views) {
        if (!current || Date.parse(v.timestamp) - Date.parse(current.endedAt) > 30 * 60 * 1000) {
          if (current) sessions.push(current);
          current = {
            clientId,
            sessionId: `${clientId}_${v.timestamp}`,
            startedAt: v.timestamp,
            endedAt: v.timestamp,
            pageViews: 1,
            events: 0,
            converted: false,
            source: v.utm?.source,
            medium: v.utm?.medium,
            campaign: v.utm?.campaign,
          };
        } else {
          current.endedAt = v.timestamp;
          current.pageViews += 1;
        }
      }
      if (current) sessions.push(current);
    }

    // Enrich with events + conversion status.
    for (const s of sessions) {
      s.events = this.events.filter(
        (e) => e.clientId === s.clientId && e.timestamp >= s.startedAt && e.timestamp <= s.endedAt
      ).length;
      s.converted = this.events.some(
        (e) => e.clientId === s.clientId &&
          e.timestamp >= s.startedAt &&
          e.timestamp <= s.endedAt &&
          e.name === 'checkout_complete'
      );
    }

    return sessions.slice(0, opts.limit ?? 1000);
  }

  async conversionRate(opts: AnalyticsQueryOpts): Promise<{ overall: number; bySource: Record<string, number> }> {
    const sessions = await this.listSessions(opts);
    if (sessions.length === 0) return { overall: 0, bySource: {} };
    const converted = sessions.filter((s) => s.converted).length;
    const overall = converted / sessions.length;

    const bySource: Record<string, number> = {};
    const bySourceTotal: Record<string, number> = {};
    for (const s of sessions) {
      const src = s.source ?? 'direct';
      bySourceTotal[src] = (bySourceTotal[src] ?? 0) + 1;
      if (s.converted) bySource[src] = (bySource[src] ?? 0) + 1;
    }
    for (const k of Object.keys(bySourceTotal)) {
      bySource[k] = (bySource[k] ?? 0) / bySourceTotal[k];
    }
    return { overall, bySource };
  }

  isDigitalTwin(): boolean {
    return true;
  }

  /**
   * Behavioral Engine helper: simulate a synthetic visit.
   * Returns the clientId used so the caller can chain events.
   */
  async simulateVisit(opts: {
    path: string;
    source?: string;
    medium?: string;
    campaign?: string;
    willConvert?: boolean;
    pageViewCount?: number;
  }): Promise<string> {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const seed = seedFromString(clientId);
    const rng = mulberry32(seed);

    const pageViewCount = opts.pageViewCount ?? Math.max(1, Math.floor(gaussian(rng, 2, 1.5)));
    const baseTime = Date.now();
    for (let i = 0; i < pageViewCount; i++) {
      await this.trackPageView({
        clientId,
        path: opts.path,
        referrer: opts.source ? `https://${opts.source}.com` : undefined,
        utm: opts.source ? {
          source: opts.source,
          medium: opts.medium ?? 'cpc',
          campaign: opts.campaign ?? 'sim',
        } : undefined,
        timestamp: new Date(baseTime + i * 60_000).toISOString(),
      });
    }

    // Conversion events follow a Beta distribution.
    const willConvert = opts.willConvert ?? beta(rng, 2, 80) > 0.5;
    if (willConvert) {
      await this.trackEvent({
        clientId,
        name: 'checkout_complete',
        timestamp: new Date(baseTime + pageViewCount * 60_000 + 30_000).toISOString(),
      });
    }

    return clientId;
  }
}

export const analyticsMock = new AnalyticsMock();
