// ============================================================================
// Real Adapters — deferred stubs
// ----------------------------------------------------------------------------
// These implementations are PLACEHOLDERS. They throw on every call so no
// production code accidentally runs against a half-built integration.
//
// When the time comes to connect a real provider:
//   1. Implement the corresponding interface here.
//   2. Flip the env var (e.g. `ZELLA_ADAPTER_GOOGLE_ADS=real`) to route
//      through the Real adapter instead of the Digital Twin.
//   3. Verify with the Simulation Lab first — run 100k events in Twin mode
//      against the same inputs you'll use in Real mode, then compare
//      outputs to catch contract drift.
//
// Each Real adapter, when implemented, must produce IDENTICAL events on
// the ZCB as the Digital Twin does. The cortexes can never tell which
// they're talking to.
// ============================================================================

import type {
  IGoogleAdsAdapter,
  IMetaAdsAdapter,
  IPaymentGatewayAdapter,
  ICRMAdapter,
  IWhatsAppAdapter,
  IAnalyticsAdapter,
  IEmailAdapter,
  IMapsAdapter,
} from '../interfaces';

class RealAdapterNotImplementedError extends Error {
  constructor(adapter: string) {
    super(
      `[Real:${adapter}] not implemented yet. The ZCC Digital Twin is the active implementation. ` +
      `Real provider integration is deferred until the Twin is fully validated.`
    );
    this.name = 'RealAdapterNotImplementedError';
  }
}

function notImplemented(adapter: string): never {
  throw new RealAdapterNotImplementedError(adapter);
}

// Use `any` casts on the throw-on-every-method pattern to satisfy TS:
// the methods are required by the interface but we want them to throw.

class GoogleAdsReal implements IGoogleAdsAdapter {
  async createCampaign(): Promise<any> { notImplemented('GoogleAds'); }
  async pauseCampaign(): Promise<void> { notImplemented('GoogleAds'); }
  async adjustBudget(): Promise<void> { notImplemented('GoogleAds'); }
  async fetchMetrics(): Promise<any> { notImplemented('GoogleAds'); }
  isDigitalTwin(): boolean { return false; }
}

class MetaAdsReal implements IMetaAdsAdapter {
  async createCampaign(): Promise<any> { notImplemented('MetaAds'); }
  async pauseCampaign(): Promise<void> { notImplemented('MetaAds'); }
  async adjustBudget(): Promise<void> { notImplemented('MetaAds'); }
  async fetchMetrics(): Promise<any> { notImplemented('MetaAds'); }
  isDigitalTwin(): boolean { return false; }
}

class PaymentReal implements IPaymentGatewayAdapter {
  async createIntent(): Promise<any> { notImplemented('Payment'); }
  async retrieveIntent(): Promise<any> { notImplemented('Payment'); }
  async refund(): Promise<any> { notImplemented('Payment'); }
  async parseWebhook(): Promise<any> { notImplemented('Payment'); }
  isDigitalTwin(): boolean { return false; }
}

class CRMReal implements ICRMAdapter {
  async createLead(): Promise<any> { notImplemented('CRM'); }
  async updateStage(): Promise<any> { notImplemented('CRM'); }
  async listLeads(): Promise<any> { notImplemented('CRM'); }
  async scoreLead(): Promise<any> { notImplemented('CRM'); }
  isDigitalTwin(): boolean { return false; }
}

class WhatsAppReal implements IWhatsAppAdapter {
  async send(): Promise<any> { notImplemented('WhatsApp'); }
  onInbound(): () => void { return () => {}; }
  async history(): Promise<any> { notImplemented('WhatsApp'); }
  async markRead(): Promise<void> { notImplemented('WhatsApp'); }
  isDigitalTwin(): boolean { return false; }
}

class AnalyticsReal implements IAnalyticsAdapter {
  async trackEvent(): Promise<void> { notImplemented('Analytics'); }
  async trackPageView(): Promise<void> { notImplemented('Analytics'); }
  async listSessions(): Promise<any> { notImplemented('Analytics'); }
  async conversionRate(): Promise<any> { notImplemented('Analytics'); }
  isDigitalTwin(): boolean { return false; }
}

class EmailReal implements IEmailAdapter {
  async send(): Promise<any> { notImplemented('Email'); }
  async history(): Promise<any> { notImplemented('Email'); }
  async suppress(): Promise<void> { notImplemented('Email'); }
  async isSuppressed(): Promise<any> { notImplemented('Email'); }
  isDigitalTwin(): boolean { return false; }
}

class MapsReal implements IMapsAdapter {
  async geocode(): Promise<any> { notImplemented('Maps'); }
  async reverseGeocode(): Promise<any> { notImplemented('Maps'); }
  async searchPlaces(): Promise<any> { notImplemented('Maps'); }
  async nearbySearch(): Promise<any> { notImplemented('Maps'); }
  async distanceMatrix(): Promise<any> { notImplemented('Maps'); }
  isDigitalTwin(): boolean { return false; }
}

export const googleAdsReal = new GoogleAdsReal();
export const metaAdsReal = new MetaAdsReal();
export const paymentReal = new PaymentReal();
export const crmReal = new CRMReal();
export const whatsappReal = new WhatsAppReal();
export const analyticsReal = new AnalyticsReal();
export const emailReal = new EmailReal();
export const mapsReal = new MapsReal();
