/**
 * Zélla — DDC Mobile Notification System
 * Types & Contracts (Mock Mode)
 *
 * Designed for: WhatsApp, Google Ads, Meta Ads, OpenAI Ads (future).
 * Currently operating in MOCK MODE — all payloads are placeholder.
 */

import type { NicheType } from '@/contexts/NicheContext';
import type { PlanTier } from '@/lib/plan-features';

// ─── Niches ────────────────────────────────────────────────────────────────
export type NotificationNiche = 'pousada' | 'airbnb' | 'all';

// ─── Categories (9 total) ──────────────────────────────────────────────────
export type NotificationCategory =
  | 'reservations'    // Reservas (novas, confirmadas, canceladas, check-in/out)
  | 'financial'       // Financeiro (PIX, estornos, comissões OTA)
  | 'guests'          // Hóspedes (novos leads,CRM, escalonamentos)
  | 'ai'              // IA (Cérebro — aprendizado, anomalias, offline)
  | 'operations'      // Operações (iCal, OTA sync, double-booking)
  | 'marketing'       // Marketing (Google Ads, Meta Ads, OpenAI Ads)
  | 'system'          // Sistema (plano, faturamento, segurança)
  | 'achievements'    // Conquistas (gamificação PARCEIRO ZÉLLA)
  | 'external';       // Externo (reviews, métricas públicas, clima)

// ─── Priorities ────────────────────────────────────────────────────────────
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// ─── Status ────────────────────────────────────────────────────────────────
export type NotificationStatus = 'unread' | 'read' | 'archived';

// ─── Source (which system produced this notification) ──────────────────────
export type NotificationSource =
  | 'whatsapp'
  | 'cerebro'
  | 'ical'
  | 'ota_booking'
  | 'ota_airbnb'
  | 'dynamic_pricing'
  | 'reservation_flow'
  | 'webhook_payment'
  | 'webhook_whatsapp'
  | 'google_ads'
  | 'meta_ads'
  | 'openai_ads'
  | 'plan_system'
  | 'achievement_engine'
  | 'manual';

// ─── Plan gating ───────────────────────────────────────────────────────────
export type PlanAvailability = 'LITE' | 'PRO' | 'MAX' | 'PARCEIRO_ZELLA' | 'ALL';

// ─── Notification shape ────────────────────────────────────────────────────
export interface DDCNotification {
  id: string;
  niche: NotificationNiche;
  category: NotificationCategory;
  type: string;                // e.g. 'booking.created', 'payment.pix_received'
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  source: NotificationSource;
  entityId?: string;           // bookingId, guestId, paymentId, etc.
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string | null;   // ISO date — auto-archive after
  readAt?: string | null;
  createdAt: string;           // ISO date
  tenantId?: string;
  userId?: string;
  propertyId?: string;
  /** Plans that should see this notification. ALL = visible to every plan */
  planAvailability: PlanAvailability;
}

// ─── Producer input (what callers pass) ────────────────────────────────────
export interface ProduceNotificationInput {
  niche: NotificationNiche;
  category?: NotificationCategory;  // optional — catalog lookup fills if missing
  type: string;
  priority?: NotificationPriority;
  title?: string;                   // optional — catalog template fills if missing
  message?: string;                 // optional — catalog template fills if missing
  source?: NotificationSource;      // optional — catalog default fills if missing
  entityId?: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string | null;
  tenantId?: string;
  userId?: string;
  propertyId?: string;
  planAvailability?: PlanAvailability;
}

// ─── Query filters ─────────────────────────────────────────────────────────
export interface NotificationQuery {
  niche?: NotificationNiche;
  category?: NotificationCategory;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  source?: NotificationSource;
  plan?: PlanTier;
  limit?: number;
  cursor?: string;
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
  byCategory: Record<NotificationCategory, number>;
  byNiche: Record<'pousada' | 'airbnb' | 'all', number>;
}

// ─── Producer result ───────────────────────────────────────────────────────
export interface ProduceResult {
  success: boolean;
  notification?: DDCNotification;
  reason?: 'plan_blocked' | 'invalid_input' | 'store_unavailable';
}

// ─── Plan visibility map ───────────────────────────────────────────────────
export const PLAN_VISIBILITY: Record<PlanAvailability, PlanTier[]> = {
  LITE: ['gratuito', 'lite'],
  PRO: ['pro'],
  MAX: ['max'],
  PARCEIRO_ZELLA: ['parceiro'],
  ALL: ['gratuito', 'lite', 'pro', 'max', 'parceiro'],
};

export function isNotificationVisibleToPlan(
  notif: DDCNotification,
  plan: PlanTier
): boolean {
  if (notif.planAvailability === 'ALL') return true;
  return PLAN_VISIBILITY[notif.planAvailability].includes(plan);
}

export function isNotificationVisibleToNiche(
  notif: DDCNotification,
  niche: NicheType
): boolean {
  if (notif.niche === 'all') return true;
  return notif.niche === niche;
}
