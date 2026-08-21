import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  authorizeLockAccess,
  LockAuthorizationError,
  nextLockAccessState,
} from '@/lib/locks/authorization';
import { createLockOAuthState, validateLockOAuthState } from '@/lib/locks/oauth-state';
import {
  getProviderCapabilities,
  hasCredentialsConfigured,
  isRemoteUnlockSupported,
} from '@/lib/locks/providers';

describe('lock access policy', () => {
  const base = {
    reservationStatus: 'confirmed',
    paymentStatus: 'paid',
    checkIn: new Date('2026-08-21T14:00:00Z'),
    checkOut: new Date('2026-08-22T11:00:00Z'),
    now: new Date('2026-08-21T18:00:00Z'),
  };

  it('normalizes reservation and payment status', () => {
    expect(() => authorizeLockAccess(base)).not.toThrow();
  });

  it('rejects invalid or reversed windows', () => {
    expect(() => authorizeLockAccess({ ...base, checkOut: new Date('2026-08-21T13:00:00Z') }))
      .toThrowError(new LockAuthorizationError('ACCESS_WINDOW_INVALID'));
  });

  it('prevents impossible state transitions', () => {
    expect(() => nextLockAccessState(null, 'confirmed')).toThrow(LockAuthorizationError);
    expect(nextLockAccessState('ACCESS_REQUESTED', 'confirmed')).toBe('ACCESS_CONFIRMED');
    expect(() => nextLockAccessState('ACCESS_CONFIRMED', 'failed')).toThrow(LockAuthorizationError);
  });
});

describe('lock provider registry', () => {
  it('has one canonical capability definition per supported brand', () => {
    const brands = ['ttlock', 'tuya', 'igloohome', 'nuki', 'august', 'intelbras', 'yale', 'papaiz', 'philco', 'samsung'] as const;
    for (const brand of brands) {
      expect(getProviderCapabilities(brand).brand).toBe(brand);
    }
  });

  it('only advertises remote unlock for explicitly supported providers', () => {
    expect(isRemoteUnlockSupported('nuki')).toBe(true);
    expect(isRemoteUnlockSupported('august')).toBe(true);
    expect(isRemoteUnlockSupported('ttlock')).toBe(false);
    expect(isRemoteUnlockSupported('intelbras')).toBe(false);
  });

  it('does not consider missing API credentials configured', () => {
    expect(hasCredentialsConfigured('nuki')).toBe(false);
  });
});

describe('lock OAuth state', () => {
  it('binds state to tenant and provider and expires it', () => {
    const state = createLockOAuthState('tenant-a', 'nuki');
    expect(validateLockOAuthState(state, state, 'tenant-a', 'nuki')).toBe(true);
    expect(validateLockOAuthState(state, state, 'tenant-b', 'nuki')).toBe(false);
    expect(validateLockOAuthState(state, state, 'tenant-a', 'ttlock')).toBe(false);
    expect(validateLockOAuthState(state, state, 'tenant-a', 'nuki', Date.now() + 11 * 60 * 1000)).toBe(false);
  });
});

describe('physical lock endpoint hardening contracts', () => {
  it('does not expose provider exception messages from remote unlock', () => {
    const source = fs.readFileSync('src/app/api/ddc/locks/[id]/unlock/route.ts', 'utf8');
    expect(source).not.toContain('error: error?.message');
    expect(source).toContain('REMOTE_UNLOCK_FAILED');
    expect(source).toContain('Cache-Control');
  });
});
