import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { authorizeLockAccess, LockAuthorizationError, nextLockAccessState } from '@/lib/locks/authorization';
import { createLockOAuthState, validateLockOAuthState } from '@/lib/locks/oauth-state';
import { getProviderCapabilities, getMissingProviderEnv, hasCredentialsConfigured, isRemoteUnlockSupported } from '@/lib/locks/provider-capabilities';

describe('lock access policy', () => {
  const base = { reservationStatus: 'confirmed', paymentStatus: 'paid', checkIn: new Date('2026-08-21T14:00:00Z'), checkOut: new Date('2026-08-22T11:00:00Z'), now: new Date('2026-08-21T18:00:00Z') };
  it('normalizes reservation and payment status', () => expect(() => authorizeLockAccess(base)).not.toThrow());
  it('rejects invalid or reversed windows', () => expect(() => authorizeLockAccess({ ...base, checkOut: new Date('2026-08-21T13:00:00Z') })).toThrowError(new LockAuthorizationError('ACCESS_WINDOW_INVALID')));
  it('prevents impossible state transitions', () => {
    expect(() => nextLockAccessState(null, 'confirmed')).toThrow(LockAuthorizationError);
    expect(nextLockAccessState('ACCESS_REQUESTED', 'confirmed')).toBe('ACCESS_CONFIRMED');
    expect(() => nextLockAccessState('ACCESS_CONFIRMED', 'failed')).toThrow(LockAuthorizationError);
  });
});

describe('lock provider registry', () => {
  it('has one canonical capability definition per supported brand', () => {
    const brands = ['ttlock', 'tuya', 'igloohome', 'nuki', 'august', 'intelbras', 'yale', 'papaiz', 'philco', 'samsung'] as const;
    for (const brand of brands) expect(getProviderCapabilities(brand).brand).toBe(brand);
  });
  it('only advertises remote unlock for explicitly supported providers', () => {
    expect(isRemoteUnlockSupported('nuki')).toBe(true);
    expect(isRemoteUnlockSupported('august')).toBe(true);
    expect(isRemoteUnlockSupported('ttlock')).toBe(false);
    expect(isRemoteUnlockSupported('intelbras')).toBe(false);
  });
  it('requires TTLock redirect configuration before declaring it operational', () => {
    expect(getProviderCapabilities('ttlock').requiredEnv).toContain('TTLOCK_REDIRECT_URI');
    const previous = process.env.TTLOCK_REDIRECT_URI;
    delete process.env.TTLOCK_REDIRECT_URI;
    expect(getMissingProviderEnv('ttlock')).toContain('TTLOCK_REDIRECT_URI');
    expect(hasCredentialsConfigured('ttlock')).toBe(false);
    if (previous !== undefined) process.env.TTLOCK_REDIRECT_URI = previous;
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

describe('lock subsystem hardening contracts', () => {
  it('does not expose provider exception messages from remote unlock', () => {
    const source = fs.readFileSync('src/app/api/ddc/locks/[id]/unlock/route.ts', 'utf8');
    expect(source).not.toContain('error: error?.message');
    expect(source).toContain('REMOTE_UNLOCK_FAILED');
    expect(source).toContain('Cache-Control');
  });
  it('requires tenant ownership checks on lock mutations', () => {
    const source = fs.readFileSync('src/app/api/ddc/locks/[id]/route.ts', 'utf8');
    expect(source.match(/resolveTenantId\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(source).toContain('const owned = await getLockDevice(id)');
  });
  it('does not allow API provider failure to masquerade as local PIN generation', () => {
    const source = fs.readFileSync('src/lib/locks/providers/manual.ts', 'utf8');
    expect(source).toContain('API_PROVIDER_MANUAL_FALLBACK_NOT_ALLOWED');
    expect(source).toContain('API_PROVIDER_REQUIRES_REAL_PROVIDER');
  });
  it('keeps OAuth callback errors provider-neutral', () => {
    const source = fs.readFileSync('src/app/api/ddc/locks/oauth/[provider]/callback/route.ts', 'utf8');
    expect(source).not.toContain('(error as Error).message');
    expect(source).toContain('OAUTH_TOKEN_EXCHANGE_FAILED');
  });
  it('fails closed when TTLock opaque lock data is absent', () => {
    const source = fs.readFileSync('src/lib/locks/providers/ttlock.ts', 'utf8');
    expect(source).toContain('TTLOCK_LOCK_DATA_REQUIRED');
    expect(source).not.toContain('lockData: input.lockData ?? \'\'');
  });
  it('validates OAuth token material before persistence', () => {
    const source = fs.readFileSync('src/lib/locks/oauth-store.ts', 'utf8');
    expect(source).toContain('validateTokenMaterial');
    expect(source).toContain('INVALID_OAUTH_ACCESS_TOKEN');
    expect(source).toContain('INVALID_OAUTH_REFRESH_TOKEN');
  });
});
