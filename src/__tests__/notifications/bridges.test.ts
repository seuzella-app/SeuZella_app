/**
 * Tests for src/lib/notifications/bridges.ts
 *
 * Validates each of the 13 bridges:
 *  - Returns ProduceResult with correct notification type on valid payload
 *  - Handles all switch cases (created/confirmed/cancelled/etc.)
 *  - Non-blocking: doesn't throw on invalid input (returns invalid_input)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  bridgeWhatsAppIncoming,
  bridgeWhatsAppEscalation,
  bridgeReservationEvent,
  bridgePaymentEvent,
  bridgeCerebroAlert,
  bridgeIcalSync,
  bridgeOtaTokenExpired,
  bridgeDynamicPricingAlert,
  bridgeAdsBudgetLow,
  bridgePlanExpiring,
  bridgeSecurityAlert,
  bridgeReviewNegative,
  bridgeAchievement,
  BRIDGES,
} from '@/lib/notifications/bridges';
import { memoryStore } from '@/lib/notifications/producer';

describe('BRIDGES constant exports all 13 bridges', () => {
  it('should export exactly 13 bridges', () => {
    const keys = Object.keys(BRIDGES);
    expect(keys.length).toBe(13);
  });

  it('exports all expected bridge names', () => {
    const keys = Object.keys(BRIDGES).sort();
    expect(keys).toEqual([
      'achievement',
      'adsBudgetLow',
      'cerebroAlert',
      'dynamicPricingAlert',
      'icalSync',
      'otaTokenExpired',
      'payment',
      'planExpiring',
      'reservation',
      'reviewNegative',
      'securityAlert',
      'whatsappEscalation',
      'whatsappIncoming',
    ]);
  });
});

describe('bridgeWhatsAppIncoming', () => {
  beforeEach(() => memoryStore.clear());

  it('produces a new_lead notification for any incoming message', () => {
    const results = bridgeWhatsAppIncoming({
      niche: 'pousada',
      guestName: 'João',
      message: 'Oi, quero reservar',
    });
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].notification?.type).toBe('guest.new_lead');
  });

  it('produces a hot_lead notification when isHotLead=true', () => {
    const results = bridgeWhatsAppIncoming({
      niche: 'pousada',
      guestName: 'Maria',
      message: 'Quero reservar hoje',
      isHotLead: true,
      score: 85,
    });
    expect(results.length).toBe(2);
    expect(results[0].notification?.type).toBe('guest.new_lead');
    expect(results[1].notification?.type).toBe('guest.hot_lead');
    expect(results[1].notification?.priority).toBe('high');
  });

  it('produces a hot_lead notification when score >= 70 (without isHotLead flag)', () => {
    const results = bridgeWhatsAppIncoming({
      niche: 'airbnb',
      guestName: 'Pedro',
      message: 'Reserva',
      score: 75,
    });
    expect(results.length).toBe(2);
    expect(results[1].notification?.type).toBe('guest.hot_lead');
  });

  it('does NOT produce hot_lead when score < 70', () => {
    const results = bridgeWhatsAppIncoming({
      niche: 'pousada',
      guestName: 'Ana',
      message: 'Oi',
      score: 50,
    });
    expect(results.length).toBe(1);
  });
});

describe('bridgeWhatsAppEscalation', () => {
  beforeEach(() => memoryStore.clear());

  it('produces an urgent escalation notification', () => {
    const r = bridgeWhatsAppEscalation({
      niche: 'all',
      guestName: 'Carlos',
      conversationId: 'conv-123',
      reason: 'AI confidence < 60%',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.escalated');
    expect(r.notification?.priority).toBe('urgent');
    expect(r.notification?.entityId).toBe('conv-123');
  });
});

describe('bridgeReservationEvent', () => {
  beforeEach(() => memoryStore.clear());

  it('handles created status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'created',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.created');
  });

  it('handles confirmed status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'confirmed',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.confirmed');
  });

  it('handles cancelled status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'cancelled',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.cancelled');
  });

  it('handles checkin_today status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'checkin_today',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.checkin_today');
  });

  it('handles checkout_today status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'checkout_today',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.checkout_today');
  });

  it('handles double_booking status as urgent', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'double_booking',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('booking.double_booking');
    expect(r.notification?.priority).toBe('urgent');
  });

  it('returns invalid_input on unknown status', () => {
    const r = bridgeReservationEvent({
      niche: 'pousada',
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      // @ts-expect-error — testing invalid status
      status: 'unknown_status',
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('invalid_input');
  });
});

describe('bridgePaymentEvent', () => {
  beforeEach(() => memoryStore.clear());

  it('handles received status (PIX)', () => {
    const r = bridgePaymentEvent({
      niche: 'pousada',
      paymentId: 'pay-1',
      amount: 1500,
      guestName: 'Maria',
      method: 'pix',
      status: 'received',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('payment.pix_received');
  });

  it('handles failed status as urgent', () => {
    const r = bridgePaymentEvent({
      niche: 'pousada',
      paymentId: 'pay-1',
      amount: 800,
      guestName: 'Pedro',
      status: 'failed',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('payment.failed');
    expect(r.notification?.priority).toBe('urgent');
  });

  it('handles overdue status as urgent', () => {
    const r = bridgePaymentEvent({
      niche: 'pousada',
      paymentId: 'pay-1',
      amount: 1200,
      guestName: 'Ana',
      status: 'overdue',
      daysOverdue: 5,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('payment.overdue');
    expect(r.notification?.priority).toBe('urgent');
  });

  it('returns invalid_input on refunded status (not implemented)', () => {
    const r = bridgePaymentEvent({
      niche: 'pousada',
      paymentId: 'pay-1',
      amount: 500,
      guestName: 'Ana',
      status: 'refunded',
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('invalid_input');
  });
});

describe('bridgeCerebroAlert', () => {
  beforeEach(() => memoryStore.clear());

  it('handles ai_offline as urgent', () => {
    const r = bridgeCerebroAlert({ alertType: 'ai_offline' });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.offline');
    expect(r.notification?.priority).toBe('urgent');
  });

  it('handles ai_online as low priority', () => {
    const r = bridgeCerebroAlert({ alertType: 'ai_online', count: 3 });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.online');
    expect(r.notification?.priority).toBe('low');
  });

  it('handles pattern_learned', () => {
    const r = bridgeCerebroAlert({ alertType: 'pattern_learned', pattern: 'Wi-Fi questions' });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.pattern_learned');
  });

  it('handles anomaly_response_time', () => {
    const r = bridgeCerebroAlert({
      alertType: 'anomaly_response_time',
      value: 8000,
      expected: 2000,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.anomaly_response_time');
  });

  it('handles cost_alert', () => {
    const r = bridgeCerebroAlert({
      alertType: 'cost_alert',
      value: 95,
      expected: 100,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.cost_alert');
  });

  it('handles escalation_spike', () => {
    const r = bridgeCerebroAlert({
      alertType: 'escalation_spike',
      value: 10,
      expected: 2,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ai.escalation_spike');
  });
});

describe('bridgeIcalSync', () => {
  beforeEach(() => memoryStore.clear());

  it('handles sync_failed as high priority', () => {
    const r = bridgeIcalSync({
      niche: 'pousada',
      status: 'sync_failed',
      calendarName: 'Booking.com',
      reason: 'HTTP 500',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ical.sync_failed');
    expect(r.notification?.priority).toBe('high');
  });

  it('handles conflict_detected as urgent', () => {
    const r = bridgeIcalSync({
      niche: 'pousada',
      status: 'conflict_detected',
      roomName: 'Quarto 1',
      date: '2026-09-15',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ical.conflict_detected');
    expect(r.notification?.priority).toBe('urgent');
  });
});

describe('bridgeOtaTokenExpired', () => {
  beforeEach(() => memoryStore.clear());

  it('creates Booking.com token expired notification', () => {
    const r = bridgeOtaTokenExpired({
      niche: 'pousada',
      provider: 'Booking.com',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ota.token_expired');
    expect(r.notification?.source).toBe('ota_booking');
  });
});

describe('bridgeAdsBudgetLow', () => {
  beforeEach(() => memoryStore.clear());

  it('creates a Google Ads budget low notification', () => {
    const r = bridgeAdsBudgetLow({
      platform: 'google',
      campaign: 'Summer',
      amount: 25,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ads.google.budget_low');
  });

  it('creates a Meta Ads budget low notification', () => {
    const r = bridgeAdsBudgetLow({
      platform: 'meta',
      campaign: 'Black Friday',
      amount: 15,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.type).toBe('ads.meta.budget_low');
  });
});

describe('bridgePlanExpiring', () => {
  beforeEach(() => memoryStore.clear());

  it('creates urgent plan expiring when days=1', () => {
    const r = bridgePlanExpiring({ days: 1, plan: 'lite' });
    expect(r.success).toBe(true);
    expect(r.notification?.priority).toBe('urgent');
  });
});

describe('bridgeSecurityAlert', () => {
  beforeEach(() => memoryStore.clear());

  it('creates urgent security alert', () => {
    const r = bridgeSecurityAlert({
      ip: '203.0.113.1',
      reason: '5 failed logins',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.priority).toBe('urgent');
  });
});

describe('bridgeReviewNegative', () => {
  beforeEach(() => memoryStore.clear());

  it('creates high-priority review negative notification', () => {
    const r = bridgeReviewNegative({
      niche: 'all',
      guestName: 'John',
      stars: 2,
      platform: 'Booking.com',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.priority).toBe('high');
  });
});

describe('bridgeAchievement', () => {
  beforeEach(() => memoryStore.clear());

  it('creates achievement with PARCEIRO_ZELLA plan', () => {
    const r = bridgeAchievement({
      achievementType: 'first_booking',
    });
    expect(r.success).toBe(true);
    expect(r.notification?.planAvailability).toBe('PARCEIRO_ZELLA');
  });
});

describe('bridgeDynamicPricingAlert', () => {
  beforeEach(() => memoryStore.clear());

  it('creates a system feature_released notification with pricing info', () => {
    const r = bridgeDynamicPricingAlert({
      niche: 'pousada',
      ruleName: 'High Season',
      roomName: 'Suíte 1',
      basePrice: 350,
      calculatedPrice: 525,
      modifier: 50,
    });
    expect(r.success).toBe(true);
    expect(r.notification?.metadata?.ruleName).toBe('High Season');
  });
});

describe('idempotency', () => {
  beforeEach(() => memoryStore.clear());

  it('creates 2 notifications when called twice with same payload', () => {
    const payload = {
      niche: 'pousada' as const,
      bookingId: 'bk-1',
      guestName: 'João',
      roomName: 'Quarto 1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      status: 'created' as const,
    };
    bridgeReservationEvent(payload);
    bridgeReservationEvent(payload);
    expect(memoryStore.size()).toBe(2);
  });
});
