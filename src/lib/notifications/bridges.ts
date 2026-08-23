/**
 * Zélla — Notification Bridges (Phase 2 — Gap-fill)
 *
 * Each bridge converts an event-source payload into a `notify*` call.
 * Import these bridges from your webhook handlers, Cérebro AlertBus,
 * iCal sync engine, dynamic pricing engine, WhatsApp responder, etc.
 *
 * MOCK MODE: bridges accept mock payloads — when real integrations
 * come online (WhatsApp Cloud API, Google Ads API, etc.), just pass
 * real payloads in.
 *
 * All bridges are idempotent — calling them with the same payload twice
 * produces TWO notifications (intentional — for replay testing).
 */

import {
  notify,
  notifyAchievement,
  notifyAdsBudgetLow,
  notifyAIAnomaly,
  notifyAIOffline,
  notifyAIOnline,
  notifyAIPatternLearned,
  notifyBookingCancelled,
  notifyBookingConfirmed,
  notifyBookingCreated,
  notifyCheckoutToday,
  notifyCheckinToday,
  notifyDoubleBooking,
  notifyEscalation,
  notifyHotLead,
  notifyIcalConflict,
  notifyIcalSyncFailed,
  notifyNewLead,
  notifyOtaTokenExpired,
  notifyPaymentFailed,
  notifyPaymentOverdue,
  notifyPixReceived,
  notifyPlanExpiring,
  notifyReviewNegative,
  notifySecurityAlert,
} from './producer';
import type { NotificationNiche, ProduceResult } from './types';
import type { NicheType } from '@/contexts/NicheContext';

// ─── Bridge: WhatsApp Webhook (incoming message) ───────────────────────────
export interface WhatsAppIncomingEvent {
  niche: NotificationNiche | NicheType;
  guestName: string;
  guestPhone?: string;
  message: string;
  isHotLead?: boolean;
  score?: number;
  tenantId?: string;
  conversationId?: string;
}

export function bridgeWhatsAppIncoming(event: WhatsAppIncomingEvent): ProduceResult[] {
  const results: ProduceResult[] = [];

  // Always notify: new lead
  results.push(
    notifyNewLead({
      niche: event.niche,
      guestName: event.guestName,
      channel: 'WhatsApp',
      tenantId: event.tenantId,
    })
  );

  // Hot lead detection
  if (event.isHotLead || (event.score && event.score >= 70)) {
    results.push(
      notifyHotLead({
        niche: event.niche,
        guestName: event.guestName,
        score: event.score,
        tenantId: event.tenantId,
      })
    );
  }

  return results;
}

// ─── Bridge: WhatsApp Escalation ────────────────────────────────────────────
export function bridgeWhatsAppEscalation(event: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  conversationId: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult {
  return notifyEscalation(event);
}

// ─── Bridge: Reservation Flow ───────────────────────────────────────────────
export interface ReservationEvent {
  niche: NotificationNiche | NicheType;
  bookingId: string;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  status: 'created' | 'confirmed' | 'cancelled' | 'checkin_today' | 'checkout_today' | 'no_show' | 'double_booking';
  tenantId?: string;
  propertyId?: string;
}

export function bridgeReservationEvent(event: ReservationEvent): ProduceResult {
  switch (event.status) {
    case 'created':
      return notifyBookingCreated({
        niche: event.niche,
        bookingId: event.bookingId,
        guestName: event.guestName,
        roomName: event.roomName,
        checkIn: event.checkIn,
        checkOut: event.checkOut,
        tenantId: event.tenantId,
        propertyId: event.propertyId,
      });
    case 'confirmed':
      return notifyBookingConfirmed({
        niche: event.niche,
        bookingId: event.bookingId,
        guestName: event.guestName,
        tenantId: event.tenantId,
        propertyId: event.propertyId,
      });
    case 'cancelled':
      return notifyBookingCancelled({
        niche: event.niche,
        bookingId: event.bookingId,
        guestName: event.guestName,
        tenantId: event.tenantId,
      });
    case 'checkin_today':
      return notifyCheckinToday({
        niche: event.niche,
        guestName: event.guestName,
        roomName: event.roomName,
        tenantId: event.tenantId,
      });
    case 'checkout_today':
      return notifyCheckoutToday({
        niche: event.niche,
        guestName: event.guestName,
        roomName: event.roomName,
        tenantId: event.tenantId,
      });
    case 'double_booking':
      return notifyDoubleBooking({
        niche: event.niche,
        roomName: event.roomName,
        date: event.checkIn,
        tenantId: event.tenantId,
      });
    default:
      return { success: false, reason: 'invalid_input' };
  }
}

// ─── Bridge: Payment Webhook ────────────────────────────────────────────────
export interface PaymentEvent {
  niche: NotificationNiche | NicheType;
  paymentId: string;
  amount: number;
  guestName: string;
  method?: 'pix' | 'card' | 'cash';
  status: 'received' | 'failed' | 'overdue' | 'refunded';
  daysOverdue?: number;
  tenantId?: string;
}

export function bridgePaymentEvent(event: PaymentEvent): ProduceResult {
  switch (event.status) {
    case 'received':
      return notifyPixReceived({
        niche: event.niche,
        amount: event.amount,
        guestName: event.guestName,
        paymentId: event.paymentId,
        tenantId: event.tenantId,
      });
    case 'failed':
      return notifyPaymentFailed({
        niche: event.niche,
        amount: event.amount,
        guestName: event.guestName,
        tenantId: event.tenantId,
      });
    case 'overdue':
      return notifyPaymentOverdue({
        niche: event.niche,
        amount: event.amount,
        guestName: event.guestName,
        days: event.daysOverdue ?? 1,
        tenantId: event.tenantId,
      });
    default:
      return { success: false, reason: 'invalid_input' };
  }
}

// ─── Bridge: Cérebro AlertBus (anomaly → tenant notification) ───────────────
export interface CerebroAlertEvent {
  niche?: NotificationNiche | NicheType;
  alertType:
    | 'ai_offline'
    | 'ai_online'
    | 'pattern_learned'
    | 'anomaly_response_time'
    | 'anomaly_conversion'
    | 'anomaly_revenue'
    | 'cost_alert'
    | 'escalation_spike';
  value?: string | number;
  expected?: string | number;
  pattern?: string;
  count?: number;
  tenantId?: string;
}

export function bridgeCerebroAlert(event: CerebroAlertEvent): ProduceResult {
  switch (event.alertType) {
    case 'ai_offline':
      return notifyAIOffline({
        niche: event.niche,
        reason: 'Cérebro AlertBus detectou parada',
        tenantId: event.tenantId,
      });
    case 'ai_online':
      return notifyAIOnline({
        niche: event.niche,
        count: event.count,
        tenantId: event.tenantId,
      });
    case 'pattern_learned':
      return notifyAIPatternLearned({
        niche: event.niche,
        pattern: event.pattern ?? 'Padrão não especificado',
        tenantId: event.tenantId,
      });
    case 'anomaly_response_time':
      return notifyAIAnomaly({
        niche: event.niche,
        anomalyType: 'response_time',
        value: event.value ?? 0,
        expected: event.expected ?? 8,
        tenantId: event.tenantId,
      });
    case 'anomaly_conversion':
      return notifyAIAnomaly({
        niche: event.niche,
        anomalyType: 'conversion',
        value: event.value ?? 0,
        expected: event.expected ?? 85,
        tenantId: event.tenantId,
      });
    case 'anomaly_revenue':
      return notifyAIAnomaly({
        niche: event.niche,
        anomalyType: 'revenue',
        value: event.value ?? 0,
        expected: event.expected ?? 100,
        tenantId: event.tenantId,
      });
    case 'cost_alert':
      return notifyAIAnomaly({
        niche: event.niche,
        anomalyType: 'cost',
        value: event.value ?? 0,
        expected: event.expected ?? 400,
        tenantId: event.tenantId,
      });
    case 'escalation_spike':
      return notifyAIAnomaly({
        niche: event.niche,
        anomalyType: 'escalation_spike',
        value: event.value ?? 0,
        expected: event.expected ?? 2,
        tenantId: event.tenantId,
      });
    default:
      return { success: false, reason: 'invalid_input' };
  }
}

// ─── Bridge: iCal Sync ──────────────────────────────────────────────────────
export interface IcalSyncEvent {
  niche: NotificationNiche | NicheType;
  status: 'sync_success' | 'sync_failed' | 'conflict_detected';
  calendarName?: string;
  roomName?: string;
  date?: string;
  count?: number;
  reason?: string;
  tenantId?: string;
}

export function bridgeIcalSync(event: IcalSyncEvent): ProduceResult {
  switch (event.status) {
    case 'sync_failed':
      return notifyIcalSyncFailed({
        niche: event.niche,
        calendarName: event.calendarName ?? 'Calendário',
        reason: event.reason,
        tenantId: event.tenantId,
      });
    case 'conflict_detected':
      return notifyIcalConflict({
        niche: event.niche,
        roomName: event.roomName ?? 'Quarto',
        date: event.date ?? 'data não especificada',
        tenantId: event.tenantId,
      });
    default:
      // Success is a low-priority notification — use generic notify
      return notify({
        niche: event.niche as NotificationNiche,
        type: 'ical.sync_success',
        metadata: { count: event.count ?? 0, calendarName: event.calendarName },
        tenantId: event.tenantId,
      });
  }
}

// ─── Bridge: OTA Token Expiry ───────────────────────────────────────────────
export function bridgeOtaTokenExpired(event: {
  niche: NotificationNiche | NicheType;
  provider: 'Booking.com' | 'Airbnb';
  tenantId?: string;
}): ProduceResult {
  return notifyOtaTokenExpired(event);
}

// ─── Bridge: Dynamic Pricing ────────────────────────────────────────────────
export interface DynamicPricingEvent {
  niche: NotificationNiche | NicheType;
  ruleName: string;
  roomName: string;
  basePrice: number;
  calculatedPrice: number;
  modifier: number;
  tenantId?: string;
}

/**
 * Dynamic pricing doesn't produce tenant notifications per-rule (too noisy).
 * Instead, it produces daily summaries — for now, expose a generic notify
 * for the dynamic-pricing-engine to call when an important threshold
 * (e.g. price dropped below floor) is crossed.
 */
export function bridgeDynamicPricingAlert(event: DynamicPricingEvent): ProduceResult {
  return notify({
    niche: event.niche as NotificationNiche,
    type: 'system.feature_released', // re-use existing type for now — no dedicated pricing type in catalog
    title: 'Preço dinâmico ajustado',
    message: `${event.roomName}: R$ ${event.calculatedPrice.toFixed(2)} (base R$ ${event.basePrice.toFixed(2)}, ${event.modifier >= 0 ? '+' : ''}${event.modifier}%)`,
    source: 'manual',
    metadata: {
      ruleName: event.ruleName,
      roomName: event.roomName,
      basePrice: event.basePrice,
      calculatedPrice: event.calculatedPrice,
      modifier: event.modifier,
    },
    tenantId: event.tenantId,
    priority: 'low',
  });
}

// ─── Bridge: Ads Platform ───────────────────────────────────────────────────
export function bridgeAdsBudgetLow(event: {
  niche?: NotificationNiche | NicheType;
  platform: 'google' | 'meta' | 'openai';
  campaign: string;
  amount: number;
  tenantId?: string;
}): ProduceResult {
  return notifyAdsBudgetLow(event);
}

// ─── Bridge: System / Plan ──────────────────────────────────────────────────
export function bridgePlanExpiring(event: {
  niche?: NotificationNiche | NicheType;
  days: number;
  plan: string;
  tenantId?: string;
}): ProduceResult {
  return notifyPlanExpiring(event);
}

export function bridgeSecurityAlert(event: {
  niche?: NotificationNiche | NicheType;
  ip: string;
  reason?: string;
  tenantId?: string;
}): ProduceResult {
  return notifySecurityAlert(event);
}

// ─── Bridge: External Reviews ───────────────────────────────────────────────
export function bridgeReviewNegative(event: {
  niche: NotificationNiche | NicheType;
  guestName: string;
  stars: number;
  platform?: 'Booking.com' | 'Airbnb';
  tenantId?: string;
}): ProduceResult {
  return notifyReviewNegative(event);
}

// ─── Bridge: Achievement Engine ─────────────────────────────────────────────
export function bridgeAchievement(event: {
  niche?: NotificationNiche | NicheType;
  achievementType: 'first_booking' | 'milestone_10' | 'milestone_100' | 'revenue_record' | 'partner_level_up';
  metadata?: Record<string, any>;
  tenantId?: string;
}): ProduceResult {
  return notifyAchievement(event);
}

// ─── Bridge summary (for testing / introspection) ───────────────────────────
export const BRIDGES = {
  whatsappIncoming: bridgeWhatsAppIncoming,
  whatsappEscalation: bridgeWhatsAppEscalation,
  reservation: bridgeReservationEvent,
  payment: bridgePaymentEvent,
  cerebroAlert: bridgeCerebroAlert,
  icalSync: bridgeIcalSync,
  otaTokenExpired: bridgeOtaTokenExpired,
  dynamicPricingAlert: bridgeDynamicPricingAlert,
  adsBudgetLow: bridgeAdsBudgetLow,
  planExpiring: bridgePlanExpiring,
  securityAlert: bridgeSecurityAlert,
  reviewNegative: bridgeReviewNegative,
  achievement: bridgeAchievement,
} as const;
