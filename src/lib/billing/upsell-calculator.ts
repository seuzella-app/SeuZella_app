/**
 * UPSELL CALCULATOR — Canonical Business Rule for Seu Zélla
 * ============================================================================
 * NON-NEGOTIABLE DEFINITION:
 * Upsell is the 7% operational fee applied exclusively to reservations that utilize
 * special-date tariffs recommended by Seu Zélla and approved by the owner.
 *
 * UPSELL IS NOT: breakfast, late checkout, tour, beach kit, minibar, or ancillary services.
 */

export interface UpsellCalculationInput {
  baseRate: number;
  specialRate: number;
  nights: number;
  attributedToZehla: boolean;
  isSpecialDate: boolean;
}

export interface UpsellCalculationOutput {
  reservationValue: number;
  baseValue: number;
  incrementalValue: number;
  commissionRate: number;
  upsellAmount: number;
  ownerAmount: number;
  upsellDue: boolean;
  reason: string;
}

/**
 * Calculates the canonical 7% upsell fee on eligible special-date reservations.
 * Pure, deterministic, and rounded to 2 decimal places.
 */
export function calculateUpsell(input: UpsellCalculationInput): UpsellCalculationOutput {
  const { baseRate, specialRate, nights, attributedToZehla, isSpecialDate } = input;
  const effectiveRate = isSpecialDate ? specialRate : baseRate;
  const reservationValue = Math.round(effectiveRate * nights * 100) / 100;
  const baseValue = Math.round(baseRate * nights * 100) / 100;
  const incrementalValue = Math.max(0, Math.round((reservationValue - baseValue) * 100) / 100);
  const commissionRate = 0.07;

  if (!isSpecialDate) {
    return {
      reservationValue,
      baseValue: reservationValue,
      incrementalValue: 0,
      commissionRate,
      upsellAmount: 0,
      ownerAmount: reservationValue,
      upsellDue: false,
      reason: 'NOT_SPECIAL_DATE - Tarifa normal, 100% da receita para o proprietário.',
    };
  }

  if (!attributedToZehla) {
    return {
      reservationValue,
      baseValue,
      incrementalValue,
      commissionRate,
      upsellAmount: 0,
      ownerAmount: reservationValue,
      upsellDue: false,
      reason: 'SPECIAL_DATE_BUT_NOT_ATTRIBUTED - Oportunidade não trabalhada pelo Zélla, 100% para o proprietário.',
    };
  }

  // 7% fee on the full special-rate reservation value worked by Zélla
  const upsellAmount = Math.round(reservationValue * commissionRate * 100) / 100;
  const ownerAmount = Math.round((reservationValue - upsellAmount) * 100) / 100;

  return {
    reservationValue,
    baseValue,
    incrementalValue,
    commissionRate,
    upsellAmount,
    ownerAmount,
    upsellDue: true,
    reason: `SPECIAL_DATE_AND_ATTRIBUTED - Comissão canônica de 7% (R$ ${upsellAmount}) para Seu Zélla.`,
  };
}

export interface MonthlyBillingInput {
  baseSubscription: number;
  upsellRecords: Array<{ commissionAmount: number; status: string; reservationId?: string }>;
}

export interface MonthlyBillingOutput {
  baseSubscription: number;
  upsellTotal: number;
  totalInvoice: number;
  upsellCount: number;
}

/**
 * Consolidates the base monthly plan subscription with confirmed upsell commissions.
 */
export function calculateMonthlyBilling(input: MonthlyBillingInput): MonthlyBillingOutput {
  const { baseSubscription, upsellRecords } = input;
  const confirmed = upsellRecords.filter(
    (r) => r.status === 'confirmed' || r.status === 'paid' || r.status === 'APPROVED'
  );
  const upsellTotal = confirmed.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);
  const roundedUpsell = Math.round(upsellTotal * 100) / 100;
  const totalInvoice = Math.round((baseSubscription + roundedUpsell) * 100) / 100;

  return {
    baseSubscription: Math.round(baseSubscription * 100) / 100,
    upsellTotal: roundedUpsell,
    totalInvoice,
    upsellCount: confirmed.length,
  };
}
