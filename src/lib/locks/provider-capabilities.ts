import type { LockBrand, ProviderType } from './types';

export type LockProviderCapabilities = {
  brand: LockBrand;
  providerType: ProviderType;
  apiAvailable: boolean;
  remoteUnlock: boolean;
  oauth: boolean;
  requiresExternalDeviceId: boolean;
  requiredEnv: readonly string[];
};

export const LOCK_PROVIDER_CAPABILITIES: Record<LockBrand, LockProviderCapabilities> = {
  ttlock: { brand: 'ttlock', providerType: 'api', apiAvailable: true, remoteUnlock: false, oauth: true, requiresExternalDeviceId: true, requiredEnv: ['TTLOCK_CLIENT_ID', 'TTLOCK_CLIENT_SECRET'] },
  tuya: { brand: 'tuya', providerType: 'api', apiAvailable: true, remoteUnlock: false, oauth: true, requiresExternalDeviceId: true, requiredEnv: ['TUYA_CLIENT_ID', 'TUYA_CLIENT_SECRET'] },
  igloohome: { brand: 'igloohome', providerType: 'api', apiAvailable: true, remoteUnlock: false, oauth: true, requiresExternalDeviceId: true, requiredEnv: ['IGLOOHOME_CLIENT_ID', 'IGLOOHOME_CLIENT_SECRET'] },
  nuki: { brand: 'nuki', providerType: 'api', apiAvailable: true, remoteUnlock: true, oauth: true, requiresExternalDeviceId: true, requiredEnv: ['NUKI_CLIENT_ID', 'NUKI_CLIENT_SECRET'] },
  august: { brand: 'august', providerType: 'api', apiAvailable: true, remoteUnlock: true, oauth: false, requiresExternalDeviceId: true, requiredEnv: ['AUGUST_API_KEY', 'AUGUST_INSTALL_ID', 'AUGUST_USERNAME', 'AUGUST_PASSWORD'] },
  intelbras: { brand: 'intelbras', providerType: 'manual', apiAvailable: false, remoteUnlock: false, oauth: false, requiresExternalDeviceId: false, requiredEnv: [] },
  yale: { brand: 'yale', providerType: 'manual', apiAvailable: false, remoteUnlock: false, oauth: false, requiresExternalDeviceId: false, requiredEnv: [] },
  papaiz: { brand: 'papaiz', providerType: 'manual', apiAvailable: false, remoteUnlock: false, oauth: false, requiresExternalDeviceId: false, requiredEnv: [] },
  philco: { brand: 'philco', providerType: 'manual', apiAvailable: false, remoteUnlock: false, oauth: false, requiresExternalDeviceId: false, requiredEnv: [] },
  samsung: { brand: 'samsung', providerType: 'manual', apiAvailable: false, remoteUnlock: false, oauth: false, requiresExternalDeviceId: false, requiredEnv: [] },
};

export function getProviderCapabilities(brand: LockBrand): LockProviderCapabilities {
  return LOCK_PROVIDER_CAPABILITIES[brand];
}

export function isManualBrand(brand: LockBrand): boolean {
  return LOCK_PROVIDER_CAPABILITIES[brand].providerType === 'manual';
}

export function isRemoteUnlockSupported(brand: LockBrand): boolean {
  return LOCK_PROVIDER_CAPABILITIES[brand].remoteUnlock;
}

export function hasCredentialsConfigured(brand: LockBrand): boolean {
  const required = LOCK_PROVIDER_CAPABILITIES[brand].requiredEnv;
  return required.length === 0 || required.every((key) => Boolean(process.env[key]?.trim()));
}

export function listOperationalApiBrands(): LockBrand[] {
  return (Object.keys(LOCK_PROVIDER_CAPABILITIES) as LockBrand[]).filter(
    (brand) => LOCK_PROVIDER_CAPABILITIES[brand].apiAvailable && hasCredentialsConfigured(brand),
  );
}
