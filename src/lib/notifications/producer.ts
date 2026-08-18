/**
 * Zélla — Notification Producer (MOCK MODE)
 *
 * Public API: notify(input) — creates a notification, runs plan/niche gating,
 * stores it, returns the result. Used by all event sources (webhooks, Cérebro,
 * iCal, dynamic pricing, reservation flow, etc.).
 *
 * Convenience wrappers (notifyBookingCreated, notifyPaymentPixReceived, ...)
 * make call sites readable.
 *
 * MOCK MODE: data is placeholder. When ready to go live, swap memoryStore
 * for db.notification.create() and update the bridges to use real payloads.
 */

import { memoryStore } from './store';
import { getCatalogEntry } from './catalog';
import {
  type DDCNotification,
  type NotificationCategory,
  type NotificationNiche,
  type NotificationPriority,
  type NotificationSource,
  type PlanAvailability,
  type ProduceNotificationInput,
  type ProduceResult,
} from './types';
import type { NicheType } from '@/contexts/NicheContext';

// ─── Helpers ───────────────────────────────────────────────────────────────
function fillTemplate(template: string, vars: Record<string, any> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
}

function toNiche(niche: NotificationNiche | NicheType): NotificationNiche {
  if (niche === 'pousada' || niche === 'airbnb' || niche === 'all') return niche;
  return 'all';
}

/** Strip framework fields from metadata so we don't leak them into the stored JSON */
function stripFrameworkFields<T extends Record<string, any>>(vars: T): Record<string, any> {
  const { niche, tenantId, propertyId, userId, ...rest } = vars as any;
  return rest;
}

// ─── Core producer ─────────────────────────────────────────────────────────
export function notify(input: ProduceNotificationInput): ProduceResult {
  // Lookup catalog for defaults
  const catalog = getCatalogEntry(input.type);

  const priority: NotificationPriority = input.priority ?? catalog?.defaultPriority ?? 'medium';
  const planAvailability: PlanAvailability =
    input.planAvailability ?? catalog?.defaultPlan ?? 'ALL';
  const source: NotificationSource = input.source ?? catalog?.source ?? 'manual';
  const category: NotificationCategory = input.category ?? catalog?.category ?? 'system';

  // Format title/message using catalog templates if input didn't provide explicit strings
  const metadata = input.metadata ?? {};
  const title = input.title || (catalog ? fillTemplate(catalog.titleTemplate, metadata) : 'Notificação');
  const message =
    input.message || (catalog ? fillTemplate(catalog.messageTemplate, metadata) : '');

  if (!title || !message) {
    return { success: false, reason: 'invalid_input' };
  }

  const notification: DDCNotification = {
    id: memoryStore.nextId(),
    niche: toNiche(input.niche),
    category,
    type: input.type,
    priority,
    status: 'unread',
    title,
    message,
    source,
    entityId: input.entityId,
    metadata,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
    expiresAt: input.expiresAt ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
    tenantId: input.tenantId,
    userId: input.userId,
    propertyId: input.propertyId,
    planAvailability,
  };

  memoryStore.insert(notification);

  return { success: true, notification };
}

// ─── Convenience wrappers (typed for common events) ────────────────────────

// Booking
export const notifyBookingCreated = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingId?: string;
  tenantId?: string;
  propertyId?: string;
}): ProduceResult => {
  const niche = toNiche(vars.niche);
  return notify({
    niche,
    type: 'booking.created',
    source: 'reservation_flow',
    entityId: vars.bookingId,
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
    propertyId: vars.propertyId,
    actionUrl: `/ddc/${niche === 'airbnb' ? 'airbnb' : 'pousada'}`,
    actionLabel: 'Ver reserva',
  });
};

export const notifyBookingConfirmed = (vars: {
  niche: NotificationNiche | NicheType;
  bookingId: string;
  guestName: string;
  tenantId?: string;
  propertyId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.confirmed',
    source: 'reservation_flow',
    entityId: vars.bookingId,
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
    propertyId: vars.propertyId,
  });

export const notifyBookingCancelled = (vars: {
  niche: NotificationNiche | NicheType;
  bookingId: string;
  guestName: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.cancelled',
    source: 'reservation_flow',
    entityId: vars.bookingId,
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyCheckinToday = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  roomName: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.checkin_today',
    source: 'reservation_flow',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyCheckoutToday = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  roomName: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.checkout_today',
    source: 'reservation_flow',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyDoubleBooking = (vars: {
  niche: NotificationNiche | NicheType;
  roomName: string;
  date: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.double_booking',
    source: 'reservation_flow',
    priority: 'urgent',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyEscalation = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  conversationId?: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'booking.escalated',
    source: 'whatsapp',
    priority: 'urgent',
    entityId: vars.conversationId,
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

// Payments
export const notifyPixReceived = (vars: {
  niche: NotificationNiche | NicheType;
  amount: number;
  guestName: string;
  paymentId?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'payment.pix_received',
    source: 'webhook_payment',
    entityId: vars.paymentId,
    metadata: { ...stripFrameworkFields(vars), amount: vars.amount.toFixed(2) },
    tenantId: vars.tenantId,
  });

export const notifyPaymentFailed = (vars: {
  niche: NotificationNiche | NicheType;
  amount: number;
  guestName: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'payment.failed',
    source: 'webhook_payment',
    priority: 'urgent',
    metadata: { ...stripFrameworkFields(vars), amount: vars.amount.toFixed(2) },
    tenantId: vars.tenantId,
  });

export const notifyPaymentOverdue = (vars: {
  niche: NotificationNiche | NicheType;
  amount: number;
  guestName: string;
  days: number;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'payment.overdue',
    source: 'webhook_payment',
    priority: 'urgent',
    metadata: { ...stripFrameworkFields(vars), amount: vars.amount.toFixed(2) },
    tenantId: vars.tenantId,
  });

// Guests
export const notifyNewLead = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  channel?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'guest.new_lead',
    source: 'whatsapp',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyHotLead = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  score?: number;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'guest.hot_lead',
    source: 'whatsapp',
    priority: 'high',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

// AI / Cérebro
export const notifyAIOffline = (vars: {
  niche?: NotificationNiche | NicheType;
  reason?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: 'ai.offline',
    source: 'cerebro',
    priority: 'urgent',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyAIOnline = (vars: {
  niche?: NotificationNiche | NicheType;
  count?: number;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: 'ai.online',
    source: 'cerebro',
    priority: 'low',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyAIPatternLearned = (vars: {
  niche?: NotificationNiche | NicheType;
  pattern: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: 'ai.pattern_learned',
    source: 'cerebro',
    priority: 'low',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyAIAnomaly = (vars: {
  niche?: NotificationNiche | NicheType;
  anomalyType: 'response_time' | 'conversion' | 'revenue' | 'cost' | 'escalation_spike';
  value: string | number;
  expected?: string | number;
  tenantId?: string;
}): ProduceResult => {
  const typeMap: Record<typeof vars.anomalyType, string> = {
    response_time: 'ai.anomaly_response_time',
    conversion: 'ai.anomaly_conversion',
    revenue: 'ai.anomaly_revenue',
    cost: 'ai.cost_alert',
    escalation_spike: 'ai.escalation_spike',
  };
  return notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: typeMap[vars.anomalyType],
    source: 'cerebro',
    metadata: { ...stripFrameworkFields(vars), value: String(vars.value), expected: vars.expected ? String(vars.expected) : undefined },
    tenantId: vars.tenantId,
  });
};

// Operations
export const notifyIcalSyncFailed = (vars: {
  niche: NotificationNiche | NicheType;
  calendarName: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'ical.sync_failed',
    source: 'ical',
    priority: 'high',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyIcalConflict = (vars: {
  niche: NotificationNiche | NicheType;
  roomName: string;
  date: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'ical.conflict_detected',
    source: 'ical',
    priority: 'urgent',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifyOtaTokenExpired = (vars: {
  niche: NotificationNiche | NicheType;
  provider: 'Booking.com' | 'Airbnb';
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'ota.token_expired',
    source: vars.provider === 'Airbnb' ? 'ota_airbnb' : 'ota_booking',
    priority: 'high',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

// Marketing / Ads
export const notifyAdsBudgetLow = (vars: {
  niche?: NotificationNiche | NicheType;
  platform: 'google' | 'meta' | 'openai';
  campaign: string;
  amount: number;
  tenantId?: string;
}): ProduceResult => {
  const typeMap = {
    google: 'ads.google.budget_low',
    meta: 'ads.meta.budget_low',
    openai: 'ads.openai.budget_low',
  } as const;
  const sourceMap = {
    google: 'google_ads',
    meta: 'meta_ads',
    openai: 'openai_ads',
  } as const;
  return notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: typeMap[vars.platform],
    source: sourceMap[vars.platform],
    metadata: { ...stripFrameworkFields(vars), amount: vars.amount.toFixed(2) },
    tenantId: vars.tenantId,
  });
};

// System
export const notifyPlanExpiring = (vars: {
  niche?: NotificationNiche | NicheType;
  days: number;
  plan: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: 'system.plan_expiring',
    source: 'plan_system',
    priority: vars.days <= 3 ? 'urgent' : 'high',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

export const notifySecurityAlert = (vars: {
  niche?: NotificationNiche | NicheType;
  ip: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: 'system.security_alert',
    source: 'plan_system',
    priority: 'urgent',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

// Achievements
export const notifyAchievement = (vars: {
  niche?: NotificationNiche | NicheType;
  achievementType: 'first_booking' | 'milestone_10' | 'milestone_100' | 'revenue_record' | 'partner_level_up';
  metadata?: Record<string, any>;
  tenantId?: string;
}): ProduceResult => {
  const typeMap = {
    first_booking: 'achievement.first_booking',
    milestone_10: 'achievement.milestone_10',
    milestone_100: 'achievement.milestone_100',
    revenue_record: 'achievement.revenue_record',
    partner_level_up: 'achievement.partner_level_up',
  } as const;
  return notify({
    niche: toNiche(vars.niche ?? 'all'),
    type: typeMap[vars.achievementType],
    source: 'achievement_engine',
    planAvailability: 'PARCEIRO_ZELLA',
    metadata: vars.metadata ?? stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });
};

// External
export const notifyReviewNegative = (vars: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  stars: number;
  platform?: 'Booking.com' | 'Airbnb';
  tenantId?: string;
}): ProduceResult =>
  notify({
    niche: toNiche(vars.niche),
    type: 'external.review_negative',
    source: vars.platform === 'Airbnb' ? 'ota_airbnb' : 'ota_booking',
    priority: 'high',
    metadata: stripFrameworkFields(vars),
    tenantId: vars.tenantId,
  });

// ─── Re-export store helpers for convenience ───────────────────────────────
export { memoryStore };

export const __testing = {
  toNiche,
  fillTemplate,
  stripFrameworkFields,
};
