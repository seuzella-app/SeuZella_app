import { describe, expect, it } from 'vitest';
import { calculateUpsell } from '@/lib/billing/upsell-calculator';
import { roundHalfUp } from '@/lib/billing/money';

describe('Wave 13 F01 — Rule A', () => {
  it('charges 7% on the full special-date reservation value', () => {
    const result = calculateUpsell({ baseRate: 300, specialRate: 600, nights: 1, attributedToZehla: true, isSpecialDate: true });
    expect(result.reservationValue).toBe(600);
    expect(result.upsellAmount).toBe(42);
    expect(result.ownerAmount).toBe(558);
  });

  it('does not calculate the fee from the incremental delta', () => {
    const result = calculateUpsell({ baseRate: 300, specialRate: 600, nights: 1, attributedToZehla: true, isSpecialDate: true });
    expect(result.incrementalValue).toBe(300);
    expect(result.upsellAmount).not.toBe(21);
  });

  it('requires both eligibility flags', () => {
    expect(calculateUpsell({ baseRate: 300, specialRate: 600, nights: 2, attributedToZehla: false, isSpecialDate: true }).upsellDue).toBe(false);
    expect(calculateUpsell({ baseRate: 300, specialRate: 600, nights: 2, attributedToZehla: true, isSpecialDate: false }).upsellDue).toBe(false);
  });

  it('uses half-up rounding at two decimal places', () => {
    expect(roundHalfUp(1.005)).toBe(1.01);
    expect(roundHalfUp(1.004)).toBe(1);
    expect(roundHalfUp(-1.005)).toBe(-1.01);
  });
});
