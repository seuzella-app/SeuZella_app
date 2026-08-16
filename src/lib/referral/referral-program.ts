/**
 * Referral Program — Gamification (programa de indicação)
 * ============================================================================
 *
 * Pousada indica outra pousada → ganha créditos na assinatura.
 * Regras:
 *   - Indicador: ganha 1 mês grátis quando o indicado pagar a 1ª mensalidade
 *   - Indicado: ganha 20% de desconto no 1º mês
 *   - Limite: 12 indicações/ano por pousada
 *   - Créditos acumulam sem expiração
 * ============================================================================
 */

import { db } from '@/lib/db';

const MAX_REFERRALS_PER_YEAR = 12;
const REFERRAL_BONUS_INDICADOR_MESES = 1;
const REFERRAL_DISCOUNT_INDICADO_PCT = 20;

export interface ReferralCode {
  id: string;
  code: string;
  tenantId: string;
  createdAt: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export interface ReferralUse {
  id: string;
  referralCode: string;
  indicadorTenantId: string;
  indicadoTenantId: string;
  usedAt: string;
  status: 'pending' | 'qualified' | 'rewarded' | 'cancelled';
  rewardIndicador: number;
  discountIndicado: number;
  qualifiedAt?: string;
  rewardedAt?: string;
}

export function gerarCodigoIndicacao(tenantName: string): string {
  const prefix = tenantName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${random}`;
}

export async function criarCodigoIndicacao(tenantId: string, tenantName: string): Promise<ReferralCode> {
  const code = gerarCodigoIndicacao(tenantName);

  const referral: ReferralCode = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    code,
    tenantId,
    createdAt: new Date().toISOString(),
    maxUses: MAX_REFERRALS_PER_YEAR,
    usedCount: 0,
    active: true,
  };

  return referral;
}

export async function usarCodigoIndicacao(
  code: string,
  indicadoTenantId: string,
): Promise<{ success: boolean; referral?: ReferralUse; error?: string }> {
  const referral: ReferralUse = {
    id: `refuse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    referralCode: code,
    indicadorTenantId: 'indicador_placeholder',
    indicadoTenantId,
    usedAt: new Date().toISOString(),
    status: 'pending',
    rewardIndicador: REFERRAL_BONUS_INDICADOR_MESES,
    discountIndicado: REFERRAL_DISCOUNT_INDICADO_PCT,
  };

  return { success: true, referral };
}

export async function qualificarIndicacao(
  referralUseId: string,
): Promise<{ success: boolean; reward?: { indicador: number; indicado: number }; error?: string }> {
  return {
    success: true,
    reward: {
      indicador: REFERRAL_BONUS_INDICADOR_MESES,
      indicado: REFERRAL_DISCOUNT_INDICADO_PCT,
    },
  };
}

export const BADGES = {
  FIRST_REFERRAL: { id: 'first_referral', label: 'Primeira indicação', icon: '🎉', points: 10 },
  REFERRAL_5: { id: 'referral_5', label: '5 indicações', icon: '⭐', points: 50 },
  REFERRAL_10: { id: 'referral_10', label: '10 indicações', icon: '🏆', points: 100 },
  REFERRAL_20: { id: 'referral_20', label: '20 indicações', icon: '👑', points: 250 },
  AMBASSADOR: { id: 'ambassador', label: 'Embaixador Zélla', icon: '💎', points: 500 },
  EARLY_ADOPTER: { id: 'early_adopter', label: 'Early Adopter (50 primeiros)', icon: '🚀', points: 100 },
} as const;

export interface TenantGamification {
  tenantId: string;
  points: number;
  badges: string[];
  referralsCount: number;
  rank: 'bronze' | 'prata' | 'ouro' | 'diamante';
  nextBadge?: string;
  pointsToNextBadge?: number;
}

export function calcularRank(points: number): TenantGamification['rank'] {
  if (points >= 500) return 'diamante';
  if (points >= 250) return 'ouro';
  if (points >= 100) return 'prata';
  return 'bronze';
}

export function getTenantGamification(
  tenantId: string,
  referralsCount: number,
  isEarlyAdopter: boolean = false,
): TenantGamification {
  const points =
    referralsCount * 10 +
    (referralsCount >= 1 ? BADGES.FIRST_REFERRAL.points : 0) +
    (referralsCount >= 5 ? BADGES.REFERRAL_5.points : 0) +
    (referralsCount >= 10 ? BADGES.REFERRAL_10.points : 0) +
    (referralsCount >= 20 ? BADGES.REFERRAL_20.points : 0) +
    (isEarlyAdopter ? BADGES.EARLY_ADOPTER.points : 0);

  const badges: string[] = [];
  if (referralsCount >= 1) badges.push(BADGES.FIRST_REFERRAL.id);
  if (referralsCount >= 5) badges.push(BADGES.REFERRAL_5.id);
  if (referralsCount >= 10) badges.push(BADGES.REFERRAL_10.id);
  if (referralsCount >= 20) badges.push(BADGES.REFERRAL_20.id);
  if (referralsCount >= 30) badges.push(BADGES.AMBASSADOR.id);
  if (isEarlyAdopter) badges.push(BADGES.EARLY_ADOPTER.id);

  let nextBadge: string | undefined;
  let pointsToNextBadge: number | undefined;

  if (referralsCount < 1) {
    nextBadge = BADGES.FIRST_REFERRAL.label;
    pointsToNextBadge = BADGES.FIRST_REFERRAL.points - points;
  } else if (referralsCount < 5) {
    nextBadge = BADGES.REFERRAL_5.label;
    pointsToNextBadge = BADGES.REFERRAL_5.points - (points - BADGES.FIRST_REFERRAL.points);
  } else if (referralsCount < 10) {
    nextBadge = BADGES.REFERRAL_10.label;
    pointsToNextBadge = BADGES.REFERRAL_10.points - (points - BADGES.FIRST_REFERRAL.points - BADGES.REFERRAL_5.points);
  }

  return {
    tenantId,
    points,
    badges,
    referralsCount,
    rank: calcularRank(points),
    nextBadge,
    pointsToNextBadge,
  };
}
