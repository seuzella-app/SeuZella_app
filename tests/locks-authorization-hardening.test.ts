import { describe, expect, it } from 'vitest';
import {
  authorizeLockAccess,
  canTellGuestAccessConfirmed,
  nextLockAccessState,
} from '@/lib/locks/authorization';

describe('smart lock authorization hardening', () => {
  const checkIn = new Date('2026-09-10T14:00:00Z');
  const checkOut = new Date('2026-09-15T11:00:00Z');

  it('requires an eligible paid reservation inside the access window', () => {
    expect(() => authorizeLockAccess({
      reservationStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      checkIn,
      checkOut,
      now: new Date('2026-09-11T10:00:00Z'),
    })).not.toThrow();
  });

  it('denies access after checkout and before check-in', () => {
    expect(() => authorizeLockAccess({
      reservationStatus: 'CONFIRMED', paymentStatus: 'PAID', checkIn, checkOut,
      now: new Date('2026-09-15T11:00:00Z'),
    })).toThrow('ACCESS_WINDOW_CLOSED');

    expect(() => authorizeLockAccess({
      reservationStatus: 'CONFIRMED', paymentStatus: 'PAID', checkIn, checkOut,
      now: new Date('2026-09-10T13:59:59Z'),
    })).toThrow('ACCESS_WINDOW_CLOSED');
  });

  it('denies cancelled or unpaid reservations', () => {
    expect(() => authorizeLockAccess({
      reservationStatus: 'CANCELLED', paymentStatus: 'PAID', checkIn, checkOut,
      now: new Date('2026-09-11T10:00:00Z'),
    })).toThrow('RESERVATION_NOT_ELIGIBLE');

    expect(() => authorizeLockAccess({
      reservationStatus: 'CONFIRMED', paymentStatus: 'REFUNDED', checkIn, checkOut,
      now: new Date('2026-09-11T10:00:00Z'),
    })).toThrow('RESERVATION_NOT_ELIGIBLE');
  });

  it('does not claim provider success before confirmation', () => {
    expect(nextLockAccessState(null, 'request')).toBe('ACCESS_REQUESTED');
    expect(canTellGuestAccessConfirmed('ACCESS_REQUESTED')).toBe(false);
    expect(nextLockAccessState('ACCESS_REQUESTED', 'confirmed')).toBe('ACCESS_CONFIRMED');
    expect(canTellGuestAccessConfirmed('ACCESS_CONFIRMED')).toBe(true);
  });

  it('revoked access cannot silently become confirmed again', () => {
    expect(nextLockAccessState('ACCESS_CONFIRMED', 'revoke')).toBe('ACCESS_REVOKED');
    expect(() => nextLockAccessState('ACCESS_REVOKED', 'confirmed')).toThrow('ACCESS_ALREADY_REVOKED');
  });
});
