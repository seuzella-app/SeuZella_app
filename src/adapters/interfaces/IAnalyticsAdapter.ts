// ============================================================================
// IAnalyticsAdapter — contract for analytics (GA4, Search Console, etc.)
// ============================================================================

export interface AnalyticsEvent {
  /** Session/client id. */
  clientId: string;
  name: string;
  params?: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsPageView {
  clientId: string;
  path: string;
  referrer?: string;
  /** UTM parameters, when present. */
  utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  timestamp: string;
}

export interface AnalyticsSession {
  clientId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  pageViews: number;
  events: number;
  /** Did this session end in a conversion? */
  converted: boolean;
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface AnalyticsQueryOpts {
  from: string;
  to: string;
  path?: string;
  source?: string;
  campaign?: string;
  limit?: number;
}

export interface IAnalyticsAdapter {
  /** Track a single event. In Digital Twin mode this writes to a local store. */
  trackEvent(event: AnalyticsEvent): Promise<void>;
  /** Track a page view. */
  trackPageView(view: AnalyticsPageView): Promise<void>;
  /** List sessions matching the query. */
  listSessions(opts: AnalyticsQueryOpts): Promise<AnalyticsSession[]>;
  /** Aggregate conversion rate for a period, optionally broken down by source. */
  conversionRate(opts: AnalyticsQueryOpts): Promise<{ overall: number; bySource: Record<string, number> }>;
  isDigitalTwin(): boolean;
}
