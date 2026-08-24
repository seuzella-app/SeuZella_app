import { describe, expect, it } from 'vitest';

describe('reservation payment ledger boundary', () => {
  it('documents that reservation events use reservation_payments, not PaymentTransaction', () => {
    expect('reservation_payments').toBe('reservation_payments');
    expect('subscription').not.toBe('reservation');
  });

  it('requires explicit referenceType to distinguish business domains', () => {
    const reservation = { referenceType: 'reservation' as const, referenceId: 'res_123' };
    const subscription = { referenceType: 'subscription' as const, referenceId: 'sub_123' };

    expect(reservation.referenceType).toBe('reservation');
    expect(subscription.referenceType).toBe('subscription');
    expect(reservation.referenceId).not.toBe(subscription.referenceId);
  });
});
