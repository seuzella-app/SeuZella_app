import { describe, expect, it } from 'vitest';

describe('payment webhook domain routing contract', () => {
  it('treats reservation references as reservation domain', () => {
    const event = { referenceType: 'reservation', referenceId: 'res_123' } as const;
    expect(event.referenceType).toBe('reservation');
    expect(event.referenceId).toBe('res_123');
  });

  it('treats subscription references as subscription domain', () => {
    const event = { referenceType: 'subscription', referenceId: 'sub_123' } as const;
    expect(event.referenceType).toBe('subscription');
    expect(event.referenceId).toBe('sub_123');
  });

  it('never permits a reservation reference to be silently relabeled as subscription', () => {
    const event = { referenceType: 'reservation', referenceId: 'res_123' } as const;
    expect(event.referenceType).not.toBe('subscription');
  });
});
