// =============================================================================
// 🔐 SEU ZÉLLA — Barrel exports para providers de fechadura
// =============================================================================
// Centraliza imports dos 5 providers reais + o manual fallback.
// =============================================================================

import type { LockBrand } from '../types';
import * as ttlockProvider from './ttlock';
import * as tuyaProvider from './tuya';
import * as igloohomeProvider from './igloohome';
import * as nukiProvider from './nuki';
import * as augustProvider from './august';
import * as manualProvider from './manual';

export { ttlockProvider, tuyaProvider, igloohomeProvider, nukiProvider, augustProvider, manualProvider };

/**
 * Mapeamento estático de brand → provider module.
 * Usado pelo orchestrator para carregar o adapter correto sem dynamic import.
 *
 * As marcas manuais (intelbras, yale, papaiz, philco, samsung) e qualquer
 * marca com API cujas credenciais OAuth não estão configuradas no .env caem
 * no provider manual (host cola PIN).
 */
export function getProviderModule(brand: LockBrand) {
  switch (brand) {
    case 'ttlock':
      return { kind: 'api' as const, module: ttlockProvider };
    case 'tuya':
      return { kind: 'api' as const, module: tuyaProvider };
    case 'igloohome':
      return { kind: 'api' as const, module: igloohomeProvider };
    case 'nuki':
      return { kind: 'api' as const, module: nukiProvider };
    case 'august':
      return { kind: 'api' as const, module: augustProvider };
    case 'intelbras':
    case 'yale':
    case 'papaiz':
    case 'philco':
    case 'samsung':
    default:
      return { kind: 'manual' as const, module: manualProvider };
  }
}

/**
 * Verifica se a marca tem credenciais OAuth configuradas no ambiente.
 * Usado para decidir se cai no modo manual fallback ou usa API real.
 */
export function hasCredentialsConfigured(brand: LockBrand): boolean {
  const envMap: Partial<Record<LockBrand, string[]>> = {
    ttlock: ['TTLOCK_CLIENT_ID', 'TTLOCK_CLIENT_SECRET'],
    tuya: ['TUYA_CLIENT_ID', 'TUYA_CLIENT_SECRET'],
    igloohome: ['IGLOOHOME_CLIENT_ID', 'IGLOOHOME_CLIENT_SECRET'],
    nuki: ['NUKI_CLIENT_ID', 'NUKI_CLIENT_SECRET'],
    august: ['AUGUST_API_KEY', 'AUGUST_INSTALL_ID', 'AUGUST_USERNAME', 'AUGUST_PASSWORD'],
  };
  const required = envMap[brand];
  if (!required) return false;
  return required.every((key) => !!process.env[key]);
}

/**
 * Lista as marcas atualmente operacionais em modo API (com credenciais).
 */
export function listOperationalApiBrands(): LockBrand[] {
  const apiBrands: LockBrand[] = ['ttlock', 'tuya', 'igloohome', 'nuki', 'august'];
  return apiBrands.filter((b) => hasCredentialsConfigured(b));
}
