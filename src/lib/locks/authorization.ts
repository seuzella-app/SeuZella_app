export type LockAccessState =
  | 'ACCESS_REQUESTED'
  | 'ACCESS_CONFIRMED'
  | 'ACCESS_FAILED'
  | 'ACCESS_EXPIRED'
  | 'ACCESS_REVOKED';

export type LockReservationContext = {
  reservationStatus: string;
  paymentStatus: string;
  checkIn: Date;
  checkOut: Date;
  now?: Date;
};

export class LockAuthorizationError extends Error {
  constructor(public readonly code: 'RESERVATION_NOT_ELIGIBLE' | 'ACCESS_WINDOW_CLOSED' | 'ACCESS_ALREADY_REVOKED') {
    super(code);
    this.name = 'LockAuthorizationError';
  }
}

const ACTIVE_RESERVATIONS = new Set(['CONFIRMED', 'confirmed', 'ACTIVE', 'active', 'CHECKED_IN', 'checked_in']);
const PAID_STATES = new Set(['PAID', 'paid', 'APPROVED', 'approved', 'CONFIRMED', 'confirmed', 'ACTIVE', 'active']);

export function authorizeLockAccess(ctx: LockReservationContext): void {
  const now = ctx.now ?? new Date();
  if (!ACTIVE_RESERVATIONS.has(ctx.reservationStatus) || !PAID_STATES.has(ctx.paymentStatus)) {
    throw new LockAuthorizationError('RESERVATION_NOT_ELIGIBLE');
  }
  if (now < ctx.checkIn || now >= ctx.checkOut) {
    throw new LockAuthorizationError('ACCESS_WINDOW_CLOSED');
  }
}

export function nextLockAccessState(
  current: LockAccessState | null,
  event: 'request' | 'confirmed' | 'failed' | 'expire' | 'revoke',
): LockAccessState {
  if (current === 'ACCESS_REVOKED' && event !== 'revoke') {
    throw new LockAuthorizationError('ACCESS_ALREADY_REVOKED');
  }
  if (event === 'request') return 'ACCESS_REQUESTED';
  if (event === 'confirmed') {
    if (current !== 'ACCESS_REQUESTED') throw new Error(`Invalid lock transition: ${current ?? 'null'} -> ACCESS_CONFIRMED`);
    return 'ACCESS_CONFIRMED';
  }
  if (event === 'failed') return 'ACCESS_FAILED';
  if (event === 'expire') return 'ACCESS_EXPIRED';
  return 'ACCESS_REVOKED';
}

export function canTellGuestAccessConfirmed(state: LockAccessState): boolean {
  return state === 'ACCESS_CONFIRMED';
}
