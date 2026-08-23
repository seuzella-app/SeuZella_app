import { describe, expect, it } from 'vitest';
import {
  VALID_TRANSITIONS,
  type PaymentState,
} from '@/lib/finance/payment-state-machine';

describe('Payment state machine — transition matrix contract', () => {
  it('declares all 11 canonical states', () => {
    const states = Object.keys(VALID_TRANSITIONS) as PaymentState[];
    expect(states.sort()).toEqual([
      'ACTIVE',
      'AUTHORIZED',
      'CANCELLED',
      'CHARGEBACK',
      'CONFIRMED',
      'CREATED',
      'EXPIRED',
      'FAILED',
      'PAID',
      'PENDING',
      'REFUNDED',
    ]);
  });

  it('terminal states have empty transition arrays (no reactivation)', () => {
    const terminalStates: PaymentState[] = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'];
    for (const state of terminalStates) {
      expect(VALID_TRANSITIONS[state], `${state} must be terminal (no transitions)`).toEqual([]);
    }
  });

  it('REFUNDED cannot transition to ACTIVE (anti-fraud rule)', () => {
    // A refunded payment must NEVER be silently reactivated — that would
    // grant free service. This is the single most important contract.
    expect(VALID_TRANSITIONS.REFUNDED).not.toContain('ACTIVE');
    expect(VALID_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it('CHARGEBACK cannot transition to ACTIVE (anti-fraud rule)', () => {
    expect(VALID_TRANSITIONS.CHARGEBACK).not.toContain('ACTIVE');
    expect(VALID_TRANSITIONS.CHARGEBACK).toEqual([]);
  });

  it('PAID can transition to CONFIRMED or ACTIVE (forward flow)', () => {
    expect(VALID_TRANSITIONS.PAID).toContain('CONFIRMED');
    expect(VALID_TRANSITIONS.PAID).toContain('ACTIVE');
  });

  it('FAILED can retry (transition back to PENDING or CREATED)', () => {
    expect(VALID_TRANSITIONS.FAILED).toContain('PENDING');
    expect(VALID_TRANSITIONS.FAILED).toContain('CREATED');
  });

  it('CREATED can be cancelled or expired (escape hatches)', () => {
    expect(VALID_TRANSITIONS.CREATED).toContain('CANCELLED');
    expect(VALID_TRANSITIONS.CREATED).toContain('EXPIRED');
  });

  it('PENDING can fail or expire (no zombie payments)', () => {
    expect(VALID_TRANSITIONS.PENDING).toContain('FAILED');
    expect(VALID_TRANSITIONS.PENDING).toContain('EXPIRED');
  });

  it('PAID can be refunded or charged back (post-payment dispute handling)', () => {
    expect(VALID_TRANSITIONS.PAID).toContain('REFUNDED');
    expect(VALID_TRANSITIONS.PAID).toContain('CHARGEBACK');
  });

  it('ACTIVE can be refunded or charged back (mid-cycle dispute)', () => {
    expect(VALID_TRANSITIONS.ACTIVE).toContain('REFUNDED');
    expect(VALID_TRANSITIONS.ACTIVE).toContain('CHARGEBACK');
  });

  it('forward-only transitions are enforced (no PAID → PENDING regressions)', () => {
    // Once payment is captured, it cannot go back to PENDING.
    expect(VALID_TRANSITIONS.PAID).not.toContain('PENDING');
    expect(VALID_TRANSITIONS.CONFIRMED).not.toContain('PENDING');
    expect(VALID_TRANSITIONS.ACTIVE).not.toContain('PENDING');
  });
});
