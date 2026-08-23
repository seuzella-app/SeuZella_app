// ============================================================================
// Adapter Registry
// ----------------------------------------------------------------------------
// Resolves each adapter interface to either:
//   - The Digital Twin (Mock) implementation, OR
//   - The Real implementation (currently a stub that throws).
//
// The decision is per-adapter, driven by env vars:
//
//   ZELLA_ADAPTER_GOOGLE_ADS = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_META_ADS   = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_PAYMENT    = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_CRM        = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_WHATSAPP   = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_ANALYTICS  = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_EMAIL      = 'digital-twin' | 'real'   (default: digital-twin)
//   ZELLA_ADAPTER_MAPS       = 'digital-twin' | 'real'   (default: digital-twin)
//
// A single global override `ZELLA_OPERATING_MODE=production` flips ALL
// adapters to Real (still per-adapter overridable).
//
// Cortexes receive an `AdapterBundle` on startup. They never resolve
// adapters themselves.
// ============================================================================

import type {
  AdapterBundle,
  AdapterModeMap,
  IGoogleAdsAdapter,
  IMetaAdsAdapter,
  IPaymentGatewayAdapter,
  ICRMAdapter,
  IWhatsAppAdapter,
  IAnalyticsAdapter,
  IEmailAdapter,
  IMapsAdapter,
} from './interfaces';

import {
  googleAdsMock,
  metaAdsMock,
  paymentMock,
  crmMock,
  whatsappMock,
  analyticsMock,
  emailMock,
  mapsMock,
} from './mock';

import {
  googleAdsReal,
  metaAdsReal,
  paymentReal,
  crmReal,
  whatsappReal,
  analyticsReal,
  emailReal,
  mapsReal,
} from './real';

type Mode = 'digital-twin' | 'real';

function readMode(envKey: string, globalMode: Mode): Mode {
  const v = process.env[envKey]?.toLowerCase();
  if (v === 'real' || v === 'production') return 'real';
  if (v === 'digital-twin' || v === 'mock' || v === 'twin') return 'digital-twin';
  return globalMode;
}

/**
 * Resolve the per-adapter mode map from env vars.
 * Exported for testability and for the Simulation Lab to override.
 */
export function resolveModeMap(): AdapterModeMap {
  const globalMode: Mode =
    process.env.ZELLA_OPERATING_MODE?.toLowerCase() === 'production' ? 'real' : 'digital-twin';

  return {
    googleAds: readMode('ZELLA_ADAPTER_GOOGLE_ADS', globalMode),
    metaAds: readMode('ZELLA_ADAPTER_META_ADS', globalMode),
    payment: readMode('ZELLA_ADAPTER_PAYMENT', globalMode),
    crm: readMode('ZELLA_ADAPTER_CRM', globalMode),
    whatsapp: readMode('ZELLA_ADAPTER_WHATSAPP', globalMode),
    analytics: readMode('ZELLA_ADAPTER_ANALYTICS', globalMode),
    email: readMode('ZELLA_ADAPTER_EMAIL', globalMode),
    maps: readMode('ZELLA_ADAPTER_MAPS', globalMode),
  };
}

/**
 * Build the runtime adapter bundle from the current env.
 * This is called once on ZCC boot.
 */
export function buildAdapterBundle(modeMap?: AdapterModeMap): AdapterBundle {
  const m = modeMap ?? resolveModeMap();
  const googleAds: IGoogleAdsAdapter = m.googleAds === 'real' ? googleAdsReal : googleAdsMock;
  const metaAds: IMetaAdsAdapter = m.metaAds === 'real' ? metaAdsReal : metaAdsMock;
  const payment: IPaymentGatewayAdapter = m.payment === 'real' ? paymentReal : paymentMock;
  const crm: ICRMAdapter = m.crm === 'real' ? crmReal : crmMock;
  const whatsapp: IWhatsAppAdapter = m.whatsapp === 'real' ? whatsappReal : whatsappMock;
  const analytics: IAnalyticsAdapter = m.analytics === 'real' ? analyticsReal : analyticsMock;
  const email: IEmailAdapter = m.email === 'real' ? emailReal : emailMock;
  const maps: IMapsAdapter = m.maps === 'real' ? mapsReal : mapsMock;
  return { googleAds, metaAds, payment, crm, whatsapp, analytics, email, maps };
}

/**
 * The singleton adapter bundle. Cortexes receive this on startup.
 * Resolved lazily on first access.
 */
let _bundle: AdapterBundle | undefined;
export function getAdapters(): AdapterBundle {
  if (!_bundle) _bundle = buildAdapterBundle();
  return _bundle;
}

/**
 * Test/Simulation Lab helper: rebuild the bundle with a forced mode map.
 * Production code never calls this.
 */
export function __resetAdaptersForTest(modeMap?: AdapterModeMap): AdapterBundle {
  _bundle = buildAdapterBundle(modeMap);
  return _bundle;
}
