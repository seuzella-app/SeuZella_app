// =============================================================================
// ZÉLLA — Telemetry Event Types
// =============================================================================
// Defines all telemetry event types captured from DDC (client dashboards)
// and fed into ZCC (admin panel). These events power the Burn Rate Center,
// FintechHub, TenantXRay, and other ZCC modules.
// =============================================================================

// ── Event Type Enum ────────────────────────────────────────────────────────────

export type TelemetryEventType =
  | 'whatsapp.message_sent' // Burn rate tracking
  | 'whatsapp.message_bundled' // Cost savings tracking
  | 'reservation.created' // Revenue tracking
  | 'reservation.cancelled' // Churn tracking
  | 'payment.received' // MRR tracking
  | 'payment.failed' // Risk tracking
  | 'ai.response_generated' // AI usage tracking
  | 'guest.checkin' // Operations tracking
  | 'guest.checkout' // Operations tracking
  | 'ical.sync_completed' // Integration tracking
  | 'oauth.connected' // Integration tracking
  | 'tenant.plan_changed' // Subscription tracking
  | 'tenant.suspended' // Kill switch event
  | 'tenant.reactivated' // Kill switch event
  | 'airbnb.review_received' // Quality tracking
  | 'airbnb.response_time' // Algorithm health
;

// ── Category Grouping ──────────────────────────────────────────────────────────

export type TelemetryCategory =
  | 'whatsapp'
  | 'reservation'
  | 'payment'
  | 'ai'
  | 'guest'
  | 'integration'
  | 'tenant'
  | 'airbnb'
;

/** Maps event types to their categories for aggregation */
export const EVENT_CATEGORY_MAP: Record<TelemetryEventType, TelemetryCategory> = {
  'whatsapp.message_sent': 'whatsapp',
  'whatsapp.message_bundled': 'whatsapp',
  'reservation.created': 'reservation',
  'reservation.cancelled': 'reservation',
  'payment.received': 'payment',
  'payment.failed': 'payment',
  'ai.response_generated': 'ai',
  'guest.checkin': 'guest',
  'guest.checkout': 'guest',
  'ical.sync_completed': 'integration',
  'oauth.connected': 'integration',
  'tenant.plan_changed': 'tenant',
  'tenant.suspended': 'tenant',
  'tenant.reactivated': 'tenant',
  'airbnb.review_received': 'airbnb',
  'airbnb.response_time': 'airbnb',
};

// ── Core Event Interface ───────────────────────────────────────────────────────

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  tenantId: string;
  timestamp: string;
  data: Record<string, any>;
}

// ── Specialized Update Interfaces ──────────────────────────────────────────────

export interface BurnRateUpdate {
  tenantId: string;
  messagesSent: number;
  messagesBundled: number;
  costUsd: number;
  savingsUsd: number;
}

export interface RevenueUpdate {
  tenantId: string;
  amount: number;
  currency: 'BRL' | 'USD';
  source: 'pix' | 'credit_card' | 'booking' | 'airbnb';
}

// ── Ingest API Request/Response ────────────────────────────────────────────────

export interface TelemetryIngestRequest {
  type: TelemetryEventType;
  tenantId: string;
  data: Record<string, any>;
}

export interface TelemetryIngestResponse {
  received: boolean;
  eventId: string;
}

// ── Query API Request/Response ─────────────────────────────────────────────────

export interface TelemetryQueryParams {
  type?: TelemetryEventType;
  tenantId?: string;
  category?: TelemetryCategory;
  since?: string;
  until?: string;
  limit?: number;
}

export interface TelemetryQueryResponse {
  events: TelemetryEvent[];
  total: number;
  aggregates: TelemetryAggregates;
}

// ── Aggregates ─────────────────────────────────────────────────────────────────

export interface TelemetryAggregates {
  eventCounts: Record<TelemetryEventType, number>;
  categoryCounts: Record<TelemetryCategory, number>;
  burnRate: {
    totalMessagesSent: number;
    totalMessagesBundled: number;
    totalCostUsd: number;
    totalSavingsUsd: number;
    savingsRate: number;
  };
  revenue: {
    totalAmount: number;
    byCurrency: Record<string, number>;
    bySource: Record<string, number>;
  };
}

// ── Burn Rate Per-Tenant ───────────────────────────────────────────────────────

export interface TenantBurnRate {
  tenantId: string;
  messagesSent: number;
  messagesBundled: number;
  costUsd: number;
  savingsUsd: number;
  savingsRate: number;
  lastMessageAt: string | null;
}

// ── Revenue Per-Tenant ─────────────────────────────────────────────────────────

export interface TenantRevenue {
  tenantId: string;
  totalAmount: number;
  byCurrency: Record<string, number>;
  bySource: Record<string, number>;
  transactionCount: number;
  lastPaymentAt: string | null;
}

// ── Valid Event Types (for validation) ─────────────────────────────────────────

export const VALID_EVENT_TYPES: Set<TelemetryEventType> = new Set([
  'whatsapp.message_sent',
  'whatsapp.message_bundled',
  'reservation.created',
  'reservation.cancelled',
  'payment.received',
  'payment.failed',
  'ai.response_generated',
  'guest.checkin',
  'guest.checkout',
  'ical.sync_completed',
  'oauth.connected',
  'tenant.plan_changed',
  'tenant.suspended',
  'tenant.reactivated',
  'airbnb.review_received',
  'airbnb.response_time',
]);
