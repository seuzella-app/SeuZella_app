// ============================================================================
// Universal Adapter Layer — public surface
// ----------------------------------------------------------------------------
// Cortexes import adapters ONLY through this file:
//
//   import { getAdapters } from '@/adapters';
//   const { googleAds, metaAds, payment, crm, whatsapp, analytics, email, maps } = getAdapters();
// ============================================================================

export * from './interfaces';
export { getAdapters, buildAdapterBundle, resolveModeMap, __resetAdaptersForTest } from './registry';
export type { AdapterBundle, AdapterModeMap } from './interfaces';
