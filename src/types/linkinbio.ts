// ==============================================================================
// ZEHLA SmartHotel — Link-in-Bio Types
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';

export interface LinkInBioLink {
  id: string;
  label: string;
  url: string;
  icon?: string; // emoji or lucide icon name
  isHighlight?: boolean; // primary CTA (Reservar Agora)
  order: number;
  isActive: boolean;
}

export interface LinkInBioReview {
  id: string;
  authorName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: Date | string;
}

export interface LinkInBioProfile {
  id: string;
  slug: string; // "pousadaserenity" → seusella.com/pousadaserenity
  propertyName: string;
  subtitle: string;
  description?: string;
  avatarUrl?: string;
  backgroundImageUrl?: string; // 20% opacity background
  accentColor: string; // hex
  rating?: number; // e.g. 4.9
  reviewCount?: number;
  showReviews?: boolean; // Habilitar/desabilitar exibição de avaliações
  reviewSource?: 'google' | 'airbnb' | 'booking' | 'direct'; // Plataforma de origem da nota
  googleReviewsUrl?: string; // Link para avaliar direto no Google Meu Negócio
  airbnbListingUrl?: string; // Link do anúncio ou avaliações no Airbnb
  reviews?: LinkInBioReview[]; // Comentários e notas reais deixados por hóspedes/amigos
  links: LinkInBioLink[];
  whatsappNumber?: string;
  instagramHandle?: string;
  isActive: boolean;
  plan: PlanTier;
  isBetaPartner: boolean; // Programa Beta → Selo Especial
  createdAt: Date;
  updatedAt: Date;
  // Plan-specific dates
  planStartDate?: Date;
  planExpiresAt?: Date; // LITE = startDate + 60 days; null for PRO/MAX while paying
  betaEndDate?: Date; // Beta = startDate + 24 months
}

// Expiration notification config per plan
export interface ExpirationConfig {
  plan: PlanTier;
  daysBeforeNotification: number; // LITE=2, PRO/MAX=2 (if payment fails)
  notificationType: 'expiry_warning' | 'payment_overdue' | 'suspended';
}

export const PLAN_EXPIRATION_CONFIG: Record<PlanTier, ExpirationConfig> = {
  gratuito: {
    plan: 'gratuito',
    daysBeforeNotification: 2,
    notificationType: 'expiry_warning',
  },
  lite: {
    plan: 'lite',
    daysBeforeNotification: 2,
    notificationType: 'expiry_warning',
  },
  pro: {
    plan: 'pro',
    daysBeforeNotification: 2,
    notificationType: 'payment_overdue',
  },
  max: {
    plan: 'max',
    daysBeforeNotification: 2,
    notificationType: 'payment_overdue',
  },
  parceiro: {
    plan: 'parceiro',
    daysBeforeNotification: 2,
    notificationType: 'payment_overdue',
  },
};

// LITE: Link-in-Bio liberado enquanto plano ativo (sem limite de dias)
export const LITE_LINKINBIO_DAYS = 0; // 0 = sem expiração enquanto assinante

// Beta: 24 months
export const BETA_PARTNERSHIP_MONTHS = 24;
export const BETA_MONTHLY_PRICE = 247; // R$ 247/mês

export function getLinkInBioExpiryDate(_plan: PlanTier, _startDate: Date): Date | null {
  // LITE/PRO/MAX: sem expiração enquanto plano estiver ativo
  return null;
}

export function getDaysUntilExpiry(expiresAt: Date | null | undefined): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isLinkInBioActive(profile: LinkInBioProfile): boolean {
  if (!profile.isActive) return false;
  // LITE/PRO/MAX: ativo enquanto o plano estiver pago (isActive = true)
  if (profile.plan === 'lite' || profile.plan === 'pro' || profile.plan === 'max' || profile.plan === 'parceiro') {
    return true;
  }
  // Beta: enquanto vigente
  if (profile.isBetaPartner && profile.betaEndDate) {
    return new Date() < profile.betaEndDate;
  }
  return false;
}