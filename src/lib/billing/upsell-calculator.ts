/**
 * UPSELL CALCULATOR — Canonical Business Rule for Seu Zélla
 * RULE A: 7% of the FULL reservation value.
 * Eligibility: isSpecialDate && attributedToZehla.
 */

import { multiplyMoney, percentageOfMoney, roundHalfUp } from './money';

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

export function calculateUpsell(input: UpsellCalculationInput): UpsellCalculationOutput {
  const { baseRate, specialRate, nights, attributedToZehla, isSpecialDate } = input;
  if (![baseRate, specialRate, nights].every(Number.isFinite) || nights < 0) {
    throw new Error('INVALID_UPSELL_INPUT');
  }

  const effectiveRate = isSpecialDate ? specialRate : baseRate;
  const reservationValue = multiplyMoney(effectiveRate, nights);
  const baseValue = multiplyMoney(baseRate, nights);
  const incrementalValue = Math.max(0, roundHalfUp(reservationValue - baseValue));
  const commissionRate = 0.07;

  if (!isSpecialDate) {
    return { reservationValue, baseValue: reservationValue, incrementalValue: 0, commissionRate, upsellAmount: 0, ownerAmount: reservationValue, upsellDue: false, reason: 'NOT_SPECIAL_DATE - Tarifa normal, 100% da receita para o proprietário.' };
  }
  if (!attributedToZehla) {
    return { reservationValue, baseValue, incrementalValue, commissionRate, upsellAmount: 0, ownerAmount: reservationValue, upsellDue: false, reason: 'SPECIAL_DATE_BUT_NOT_ATTRIBUTED - Oportunidade não trabalhada pelo Zélla, 100% para o proprietário.' };
  }

  const upsellAmount = percentageOfMoney(reservationValue, commissionRate);
  const ownerAmount = roundHalfUp(reservationValue - upsellAmount);
  return {
    reservationValue,
    baseValue,
    incrementalValue,
    commissionRate,
    upsellAmount,
    ownerAmount,
    upsellDue: true,
    reason: `SPECIAL_DATE_AND_ATTRIBUTED - Comissão canônica de 7% (R$ ${upsellAmount.toFixed(2)}) para Seu Zélla.`,
  };
}

export interface MonthlyBillingInput {
  baseSubscription: number;
  upsellRecords: Array<{ commissionAmount: number; status: string; reservationId?: string }>;
}
export interface MonthlyBillingOutput { baseSubscription: number; upsellTotal: number; totalInvoice: number; upsellCount: number; }

export function calculateMonthlyBilling(input: MonthlyBillingInput): MonthlyBillingOutput {
  const confirmed = input.upsellRecords.filter(r => r.status === 'confirmed' || r.status === 'paid' || r.status === 'APPROVED');
  const upsellTotal = roundHalfUp(confirmed.reduce((sum, r) => sum + (r.commissionAmount || 0), 0));
  const baseSubscription = roundHalfUp(input.baseSubscription);
  return { baseSubscription, upsellTotal, totalInvoice: roundHalfUp(baseSubscription + upsellTotal), upsellCount: confirmed.length };
}
