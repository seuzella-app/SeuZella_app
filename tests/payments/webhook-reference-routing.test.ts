import { describe, expect, it } from 'vitest';

function referenceWhere(event: { referenceType: 'subscription' | 'reservation'; referenceId: string }) {
  return event.referenceType === 'reservation'
    ? { reservationId: event.referenceId }
    : { subscriptionId: event.referenceId };
}

describe('canonical webhook reference routing', () => {
  it('routes reservation events to reservationId only', () => {
    expect(referenceWhere({ referenceType: 'reservation', referenceId: 'res_123' })).toEqual({
      reservationId: 'res_123',
    });
  });

  it('routes subscription events to subscriptionId only', () => {
    expect(referenceWhere({ referenceType: 'subscription', referenceId: 'sub_123' })).toEqual({
      subscriptionId: 'sub_123',
    });
  });

  it('never routes a reservation through the subscription ledger key', () => {
    const where = referenceWhere({ referenceType: 'reservation', referenceId: 'res_456' });
    expect(where).not.toHaveProperty('subscriptionId');
  });

  it('never routes a subscription through the reservation ledger key', () => {
    const where = referenceWhere({ referenceType: 'subscription', referenceId: 'sub_456' });
    expect(where).not.toHaveProperty('reservationId');
  });
});
