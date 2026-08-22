import { describe, expect, it } from 'vitest';
import {
  LOCK_PROVIDER_CAPABILITIES,
  getProviderCapabilities,
  isManualBrand,
  isRemoteUnlockSupported,
  getMissingProviderEnv,
  hasCredentialsConfigured,
  listOperationalApiBrands,
} from '@/lib/locks/provider-capabilities';
import type { LockBrand } from '@/lib/locks/types';

describe('Lock provider capabilities matrix — contract', () => {
  it('declares 10 brands (5 API + 5 manual)', () => {
    const brands = Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[];
    expect(brands).toHaveLength(10);

    const apiBrands = brands.filter((b) => LOCK_PROVIDER_CAPABILITIES[b].apiAvailable);
    const manualBrands = brands.filter((b) => !LOCK_PROVIDER_CAPABILITIES[b].apiAvailable);
    expect(apiBrands).toHaveLength(5);
    expect(manualBrands).toHaveLength(5);
  });

  it('every API brand has oauth: true except August (non-official API)', () => {
    const apiBrands = (Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[]).filter(
      (b) => LOCK_PROVIDER_CAPABILITIES[b].apiAvailable,
    );
    for (const brand of apiBrands) {
      const caps = LOCK_PROVIDER_CAPABILITIES[brand];
      if (brand === 'august') {
        // August uses non-official API (see august.ts:4-5 risk register).
        expect(caps.oauth).toBe(false);
        expect(caps.requiredEnv).toContain('AUGUST_API_KEY');
        expect(caps.requiredEnv).toContain('AUGUST_INSTALL_ID');
      } else {
        expect(caps.oauth).toBe(true);
        expect(caps.requiredEnv.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('every API brand requires externalDeviceId', () => {
    const apiBrands = (Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[]).filter(
      (b) => LOCK_PROVIDER_CAPABILITIES[b].apiAvailable,
    );
    for (const brand of apiBrands) {
      expect(LOCK_PROVIDER_CAPABILITIES[brand].requiresExternalDeviceId).toBe(true);
    }
  });

  it('every manual brand has empty requiredEnv and no oauth', () => {
    const manualBrands = (Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[]).filter(
      (b) => !LOCK_PROVIDER_CAPABILITIES[b].apiAvailable,
    );
    for (const brand of manualBrands) {
      const caps = LOCK_PROVIDER_CAPABILITIES[brand];
      expect(caps.oauth).toBe(false);
      expect(caps.requiredEnv).toEqual([]);
      expect(caps.remoteUnlock).toBe(false);
    }
  });

  it('only Nuki and August advertise remoteUnlock capability', () => {
    const remoteUnlockBrands = (Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[]).filter(
      (b) => LOCK_PROVIDER_CAPABILITIES[b].remoteUnlock,
    );
    expect(remoteUnlockBrands.sort()).toEqual(['august', 'nuki']);
  });
});

describe('Lock provider capabilities — helper functions', () => {
  it('getProviderCapabilities returns the same object as direct lookup', () => {
    const brand: LockBrand = 'ttlock';
    expect(getProviderCapabilities(brand)).toBe(LOCK_PROVIDER_CAPABILITIES[brand]);
  });

  it('isManualBrand correctly identifies manual brands', () => {
    expect(isManualBrand('intelbras')).toBe(true);
    expect(isManualBrand('yale')).toBe(true);
    expect(isManualBrand('ttlock')).toBe(false);
    expect(isManualBrand('nuki')).toBe(false);
  });

  it('isRemoteUnlockSupported correctly identifies remote-unlock brands', () => {
    expect(isRemoteUnlockSupported('nuki')).toBe(true);
    expect(isRemoteUnlockSupported('august')).toBe(true);
    expect(isRemoteUnlockSupported('ttlock')).toBe(false);
    expect(isRemoteUnlockSupported('intelbras')).toBe(false);
  });

  it('getMissingProviderEnv returns all required env vars when none are set', () => {
    const originalEnv = { ...process.env };
    // Clear all lock provider env vars
    for (const key of ['TTLOCK_CLIENT_ID', 'TTLOCK_CLIENT_SECRET', 'TTLOCK_REDIRECT_URI']) {
      delete process.env[key];
    }
    const missing = getMissingProviderEnv('ttlock');
    expect(missing).toEqual(['TTLOCK_CLIENT_ID', 'TTLOCK_CLIENT_SECRET', 'TTLOCK_REDIRECT_URI']);
    process.env = originalEnv;
  });

  it('getMissingProviderEnv returns empty array when all env vars are set', () => {
    const originalEnv = { ...process.env };
    process.env.TTLOCK_CLIENT_ID = 'test_id';
    process.env.TTLOCK_CLIENT_SECRET = 'test_secret';
    process.env.TTLOCK_REDIRECT_URI = 'https://example.com/callback';
    const missing = getMissingProviderEnv('ttlock');
    expect(missing).toEqual([]);
    process.env = originalEnv;
  });

  it('hasCredentialsConfigured returns true for manual brands regardless of env', () => {
    expect(hasCredentialsConfigured('intelbras')).toBe(true);
    expect(hasCredentialsConfigured('yale')).toBe(true);
  });

  it('listOperationalApiBrands returns only API brands with all env vars set', () => {
    const originalEnv = { ...process.env };
    // Clear all
    for (const key of [
      'TTLOCK_CLIENT_ID', 'TTLOCK_CLIENT_SECRET', 'TTLOCK_REDIRECT_URI',
      'TUYA_CLIENT_ID', 'TUYA_CLIENT_SECRET',
      'IGLOOHOME_CLIENT_ID', 'IGLOOHOME_CLIENT_SECRET',
      'NUKI_CLIENT_ID', 'NUKI_CLIENT_SECRET',
      'AUGUST_API_KEY', 'AUGUST_INSTALL_ID', 'AUGUST_USERNAME', 'AUGUST_PASSWORD',
    ]) {
      delete process.env[key];
    }
    expect(listOperationalApiBrands()).toEqual([]);

    // Set TTLock only
    process.env.TTLOCK_CLIENT_ID = 'test';
    process.env.TTLOCK_CLIENT_SECRET = 'test';
    process.env.TTLOCK_REDIRECT_URI = 'test';
    expect(listOperationalApiBrands()).toEqual(['ttlock']);

    process.env = originalEnv;
  });
});

describe('Lock provider capabilities — August risk register', () => {
  it('August is the ONLY API brand that uses non-official API (no OAuth)', () => {
    // This is a known security/maintenance risk: August uses hardcoded iOS
    // User-Agent (see august.ts:4-5). The capability matrix MUST advertise
    // oauth: false so the OAuth flow UI doesn't surface for August installs.
    // A regression here would silently break the August pairing flow.
    const augustCaps = LOCK_PROVIDER_CAPABILITIES.august;
    expect(augustCaps.apiAvailable).toBe(true);
    expect(augustCaps.oauth).toBe(false);
    expect(augustCaps.requiredEnv).toContain('AUGUST_API_KEY');
    expect(augustCaps.requiredEnv).toContain('AUGUST_INSTALL_ID');
    expect(augustCaps.requiredEnv).toContain('AUGUST_USERNAME');
    expect(augustCaps.requiredEnv).toContain('AUGUST_PASSWORD');
  });
});
