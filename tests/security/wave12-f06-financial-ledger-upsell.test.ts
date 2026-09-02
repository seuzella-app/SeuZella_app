/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { calculateUpsell } from '@/lib/billing/upsell-calculator';
import { writeReversalTransaction } from '@/lib/payments/reservation-payment-effects';

describe('💰 F06: Financial Invariants, Ledger & 7% Upsell Contract Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Canonical RULE A & 7% Upsell Mathematical Properties', () => {
    it('calculates exact 7% commission for R$ 600 special rate (600 * 0.07 = 42.00)', () => {
      const result = calculateUpsell({
        baseRate: 300,
        specialRate: 600,
        nights: 1,
        attributedToZehla: true,
        isSpecialDate: true,
      });

      expect(result.upsellDue).toBe(true);
      expect(result.reservationValue).toBe(600.0);
      expect(result.commissionRate).toBe(0.07);
      expect(result.upsellAmount).toBe(42.0);
      expect(result.ownerAmount).toBe(558.0);
      expect(result.upsellAmount + result.ownerAmount).toBe(result.reservationValue);
    });

    it('calculates exact 7% commission for R$ 99.99 special rate with strict 2-decimal rounding (99.99 * 0.07 = 7.00)', () => {
      const result = calculateUpsell({
        baseRate: 50,
        specialRate: 99.99,
        nights: 1,
        attributedToZehla: true,
        isSpecialDate: true,
      });

      expect(result.upsellDue).toBe(true);
      expect(result.reservationValue).toBe(99.99);
      expect(result.upsellAmount).toBe(7.0); // 99.99 * 0.07 = 6.9993 -> 7.00
      expect(result.ownerAmount).toBe(92.99);
      expect(result.upsellAmount + result.ownerAmount).toBe(result.reservationValue);
    });

    it('guarantees ZERO commission when attributedToZehla is false (0% fee, 100% to host)', () => {
      const result = calculateUpsell({
        baseRate: 300,
        specialRate: 600,
        nights: 2,
        attributedToZehla: false,
        isSpecialDate: true,
      });

      expect(result.upsellDue).toBe(false);
      expect(result.upsellAmount).toBe(0);
      expect(result.reservationValue).toBe(1200.0);
      expect(result.ownerAmount).toBe(1200.0);
      expect(result.reason).toContain('NOT_ATTRIBUTED');
    });

    it('guarantees ZERO commission when isSpecialDate is false (regular dates, 100% to host)', () => {
      const result = calculateUpsell({
        baseRate: 350,
        specialRate: 500,
        nights: 3,
        attributedToZehla: true,
        isSpecialDate: false,
      });

      expect(result.upsellDue).toBe(false);
      expect(result.upsellAmount).toBe(0);
      expect(result.reservationValue).toBe(1050.0);
      expect(result.ownerAmount).toBe(1050.0);
      expect(result.reason).toContain('NOT_SPECIAL_DATE');
    });

    it('enforces bounding invariants: 0 <= commission <= reservationValue across edge tariffs', () => {
      const testCases = [
        { base: 0, special: 10, nights: 1 },
        { base: 100, special: 100, nights: 5 },
        { base: 500, special: 1500, nights: 7 },
        { base: 1234.56, special: 2345.67, nights: 4 },
      ];

      for (const tc of testCases) {
        const out = calculateUpsell({
          baseRate: tc.base,
          specialRate: tc.special,
          nights: tc.nights,
          attributedToZehla: true,
          isSpecialDate: true,
        });

        expect(out.upsellAmount).toBeGreaterThanOrEqual(0);
        expect(out.upsellAmount).toBeLessThanOrEqual(out.reservationValue);
        expect(out.ownerAmount).toBeGreaterThanOrEqual(0);
        expect(out.ownerAmount).toBeLessThanOrEqual(out.reservationValue);
        expect(Math.round((out.upsellAmount + out.ownerAmount) * 100) / 100).toBe(out.reservationValue);
      }
    });
  });

  describe('2. Ledger & Reversal Idempotency Side Effects', () => {
    it('writes reversal transaction on first refund event and deduplicates subsequent refund replays', async () => {
      const mockTx = {
        transaction: {
          findFirst: vi.fn(),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx_rev_001', ...data })),
        },
      };

      // 1st refund call: no prior reversal found
      mockTx.transaction.findFirst.mockResolvedValueOnce(null);

      const firstCall = await writeReversalTransaction(mockTx as any, {
        tenantId: 'tenant_abc',
        reservationId: 'res_abc',
        amount: 500,
        gateway: 'asaas',
        providerEventId: 'evt_refund_1',
        reason: 'refund',
      });

      expect(firstCall.alreadyReversed).toBe(false);
      expect(firstCall.transactionId).toBe('tx_rev_001');
      expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);

      // 2nd refund replay: prior reversal transaction exists
      mockTx.transaction.findFirst.mockResolvedValueOnce({ id: 'tx_rev_001' });

      const secondCall = await writeReversalTransaction(mockTx as any, {
        tenantId: 'tenant_abc',
        reservationId: 'res_abc',
        amount: 500,
        gateway: 'asaas',
        providerEventId: 'evt_refund_1',
        reason: 'refund',
      });

      expect(secondCall.alreadyReversed).toBe(true);
      expect(secondCall.transactionId).toBe('tx_rev_001');
      expect(mockTx.transaction.create).toHaveBeenCalledTimes(1); // not called again
    });
  });
});
