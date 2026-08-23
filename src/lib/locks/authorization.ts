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
  constructor(
    public readonly code:
      | 'RESERVATION_NOT_ELIGIBLE'
      | 'ACCESS_WINDOW_CLOSED'
      | 'ACCESS_WINDOW_INVALID'
      | 'ACCESS_ALREADY_REVOKED'
      | 'INVALID_LOCK_TRANSITION',
  ) {
    super(code);
    this.name = 'LockAuthorizationError';
  }
}

const ACTIVE_RESERVATIONS = new Set(['CONFIRMED', 'ACTIVE', 'CHECKED_IN']);
const PAID_STATES = new Set(['PAID', 'APPROVED', 'CONFIRMED', 'ACTIVE']);

function normalizeStatus(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Política única de autorização do Zélla para acesso físico.
 * Nunca concede acesso apenas porque existe um PIN ou porque o dispositivo
 * pertence ao tenant: reserva, pagamento e janela temporal precisam coincidir.
 */
export function authorizeLockAccess(ctx: LockReservationContext): void {
  const now = ctx.now ?? new Date();
  const reservationStatus = normalizeStatus(ctx.reservationStatus);
  const paymentStatus = normalizeStatus(ctx.paymentStatus);

  if (!ACTIVE_RESERVATIONS.has(reservationStatus) || !PAID_STATES.has(paymentStatus)) {
    throw new LockAuthorizationError('RESERVATION_NOT_ELIGIBLE');
  }

  if (!(ctx.checkIn instanceof Date) || Number.isNaN(ctx.checkIn.getTime()) || !(ctx.checkOut instanceof Date) || Number.isNaN(ctx.checkOut.getTime()) || ctx.checkOut <= ctx.checkIn) {
    throw new LockAuthorizationError('ACCESS_WINDOW_INVALID');
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

  if (event === 'request') {
    if (current && current !== 'ACCESS_FAILED' && current !== 'ACCESS_EXPIRED') {
      throw new LockAuthorizationError('INVALID_LOCK_TRANSITION');
    }
    return 'ACCESS_REQUESTED';
  }

  if (event === 'confirmed') {
    if (current !== 'ACCESS_REQUESTED') {
      throw new LockAuthorizationError('INVALID_LOCK_TRANSITION');
    }
    return 'ACCESS_CONFIRMED';
  }

  if (event === 'failed') {
    if (current !== 'ACCESS_REQUESTED') {
      throw new LockAuthorizationError('INVALID_LOCK_TRANSITION');
    }
    return 'ACCESS_FAILED';
  }

  if (event === 'expire') {
    if (current !== 'ACCESS_REQUESTED' && current !== 'ACCESS_CONFIRMED') {
      throw new LockAuthorizationError('INVALID_LOCK_TRANSITION');
    }
    return 'ACCESS_EXPIRED';
  }

  return 'ACCESS_REVOKED';
}

export function canTellGuestAccessConfirmed(state: LockAccessState): boolean {
  return state === 'ACCESS_CONFIRMED';
}
