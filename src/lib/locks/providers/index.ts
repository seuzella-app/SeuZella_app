// =============================================================================
// 🔐 SEU ZÉLLA — Registry canônico de providers de fechaduras
// =============================================================================

import type { LockBrand } from '../types';
import {
  getProviderCapabilities,
  hasCredentialsConfigured,
  isManualBrand,
  isRemoteUnlockSupported,
  listOperationalApiBrands,
  LOCK_PROVIDER_CAPABILITIES,
} from '../provider-capabilities';
import * as ttlockProvider from './ttlock';
import * as tuyaProvider from './tuya';
import * as igloohomeProvider from './igloohome';
import * as nukiProvider from './nuki';
import * as augustProvider from './august';
import * as manualProvider from './manual';

export { ttlockProvider, tuyaProvider, igloohomeProvider, nukiProvider, augustProvider, manualProvider };
export { getProviderCapabilities, hasCredentialsConfigured, isManualBrand, isRemoteUnlockSupported, listOperationalApiBrands, LOCK_PROVIDER_CAPABILITIES };

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
