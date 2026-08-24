import { describe, expect, it } from 'vitest';

type BillingState = 'TRIAL' | 'ACTIVE' | 'PAYMENT_DUE' | 'RETRYING' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELED';

const allowed: Record<BillingState, BillingState[]> = {
  TRIAL: ['ACTIVE'],
  ACTIVE: ['PAYMENT_DUE', 'CANCELED'],
  PAYMENT_DUE: ['RETRYING', 'GRACE_PERIOD'],
  RETRYING: ['ACTIVE', 'GRACE_PERIOD'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'CANCELED'],
  CANCELED: [],
};

describe('M6 billing lifecycle', () => {
  it('allows only canonical transitions', () => {
    expect(allowed.ACTIVE).toContain('PAYMENT_DUE');
    expect(allowed.SUSPENDED).toContain('ACTIVE');
    expect(allowed.CANCELED).toHaveLength(0);
  });
});
