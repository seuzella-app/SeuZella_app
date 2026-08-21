// =============================================================================
// 🔐 SEU ZÉLLA — Registry canônico de providers de fechaduras
// =============================================================================
// Este arquivo é a única fonte de verdade para descoberta de provider,
// capacidades e requisitos de credenciais. O restante do módulo não deve
// duplicar listas de marcas ou nomes de variáveis de ambiente.
// =============================================================================

import type { LockBrand, ProviderType } from '../types';
import * as ttlockProvider from './ttlock';
import * as tuyaProvider from './tuya';
import * as igloohomeProvider from './igloohome';
import * as nukiProvider from './nuki';
import * as augustProvider from './august';
import * as manualProvider from './manual';

export { ttlockProvider, tuyaProvider, igloohomeProvider, nukiProvider, augustProvider, manualProvider };

export type LockProviderCapabilities = {
  brand: LockBrand;
  providerType: ProviderType;
  apiAvailable: boolean;
  remoteUnlock: boolean;
  oauth: boolean;
  requiresExternalDeviceId: boolean;
  requiredEnv: readonly string[];
};

const PROVIDER_CONFIG: Record<LockBrand, LockProviderCapabilities> = {
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
  return PROVIDER_CONFIG[brand];
}

export function isManualBrand(brand: LockBrand): boolean {
  return PROVIDER_CONFIG[brand].providerType === 'manual';
}

export function isRemoteUnlockSupported(brand: LockBrand): boolean {
  return PROVIDER_CONFIG[brand].remoteUnlock;
}

export function getProviderModule(brand: LockBrand) {
  switch (brand) {
    case 'ttlock': return { kind: 'api' as const, module: ttlockProvider };
    case 'tuya': return { kind: 'api' as const, module: tuyaProvider };
    case 'igloohome': return { kind: 'api' as const, module: igloohomeProvider };
    case 'nuki': return { kind: 'api' as const, module: nukiProvider };
    case 'august': return { kind: 'api' as const, module: augustProvider };
    default: return { kind: 'manual' as const, module: manualProvider };
  }
}

export function hasCredentialsConfigured(brand: LockBrand): boolean {
  const required = PROVIDER_CONFIG[brand].requiredEnv;
  return required.length === 0 || required.every((key) => Boolean(process.env[key]?.trim()));
}

/** Retorna apenas providers de API realmente configurados no ambiente. */
export function listOperationalApiBrands(): LockBrand[] {
  return (Object.keys(PROVIDER_CONFIG) as LockBrand[]).filter(
    (brand) => PROVIDER_CONFIG[brand].apiAvailable && hasCredentialsConfigured(brand),
  );
}
