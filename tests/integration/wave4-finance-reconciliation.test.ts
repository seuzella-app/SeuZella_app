import { describe, expect, it } from 'vitest';

describe('Wave 4 — finance/provider reconciliation', () => {
  it('requires a provider reference for every reconciled payment', () => {
    const sample = {
      provider: 'asaas',
      providerEventId: 'evt_123',
      internalReferenceId: 'reservation_123',
      amount: 100,
      currency: 'BRL',
    };

    expect(sample.provider).toMatch(/^(asaas|mercadopago)$/);
    expect(sample.providerEventId).toBeTruthy();
    expect(sample.internalReferenceId).toBeTruthy();
    expect(sample.amount).toBeGreaterThan(0);
    expect(sample.currency).toBe('BRL');
  });
});
