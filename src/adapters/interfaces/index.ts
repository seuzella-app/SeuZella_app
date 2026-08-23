// ============================================================================
// Universal Adapter Layer — public surface
// ----------------------------------------------------------------------------
// Cortexes and the ZGS import adapters ONLY through this file, NEVER through
// a concrete Mock or Real implementation. The Adapter Registry picks the
// right implementation based on env config.
//
//   import { googleAds, metaAds, payment, crm, whatsapp, analytics, email, maps } from '@/adapters';
//
// At runtime, each name resolves to either the Digital Twin (Mock) or the
// Real adapter. Cortexes never branch on which.
// ============================================================================

export type { IGoogleAdsAdapter, GoogleAdsCampaignInput, GoogleAdsCampaignOutput, GoogleAdsMetric, GoogleAdsQueryRange } from './IGoogleAdsAdapter';
export type { IMetaAdsAdapter, MetaAdsCampaignInput, MetaAdsCampaignOutput, MetaAdsMetric, MetaAdsQueryRange } from './IMetaAdsAdapter';
export type { IPaymentGatewayAdapter, PaymentProvider, PaymentMethod, PaymentIntentInput, PaymentIntent, WebhookEvent } from './IPaymentGatewayAdapter';
export type { ICRMAdapter, CRMLeadInput, CRMLead, CRMStageUpdateInput, CRMQueryOpts } from './ICRMAdapter';
export type { IWhatsAppAdapter, WhatsAppMessageInput, WhatsAppMessage } from './IWhatsAppAdapter';
export type { IAnalyticsAdapter, AnalyticsEvent, AnalyticsPageView, AnalyticsSession, AnalyticsQueryOpts } from './IAnalyticsAdapter';
export type { IEmailAdapter, EmailInput, EmailRecord } from './IEmailAdapter';
export type { IMapsAdapter, GeoPoint, PlaceResult, NearbyQuery, DistanceMatrixEntry } from './IMapsAdapter';

import type { IGoogleAdsAdapter } from './IGoogleAdsAdapter';
import type { IMetaAdsAdapter } from './IMetaAdsAdapter';
import type { IPaymentGatewayAdapter } from './IPaymentGatewayAdapter';
import type { ICRMAdapter } from './ICRMAdapter';
import type { IWhatsAppAdapter } from './IWhatsAppAdapter';
import type { IAnalyticsAdapter } from './IAnalyticsAdapter';
import type { IEmailAdapter } from './IEmailAdapter';
import type { IMapsAdapter } from './IMapsAdapter';

/**
 * AdapterBundle — every adapter the system needs, in one object.
 * Cortexes receive this bundle on startup so they never resolve adapters
 * themselves.
 */
export interface AdapterBundle {
  googleAds: IGoogleAdsAdapter;
  metaAds: IMetaAdsAdapter;
  payment: IPaymentGatewayAdapter;
  crm: ICRMAdapter;
  whatsapp: IWhatsAppAdapter;
  analytics: IAnalyticsAdapter;
  email: IEmailAdapter;
  maps: IMapsAdapter;
}

/**
 * Per-adapter operating mode. By default every adapter is in Digital Twin
 * mode. Real mode is enabled by env, per adapter, so production rollout
 * can be gradual (e.g. enable Real Payment first, keep Ads on Twin).
 */
export interface AdapterModeMap {
  googleAds: 'digital-twin' | 'real';
  metaAds: 'digital-twin' | 'real';
  payment: 'digital-twin' | 'real';
  crm: 'digital-twin' | 'real';
  whatsapp: 'digital-twin' | 'real';
  analytics: 'digital-twin' | 'real';
  email: 'digital-twin' | 'real';
  maps: 'digital-twin' | 'real';
}
