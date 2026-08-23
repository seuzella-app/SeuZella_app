// ============================================================================
// Digital Twin Mock Adapters — public surface
// ----------------------------------------------------------------------------
// Every Mock here is a "Digital Twin" implementation. They share an
// in-memory store, deterministic seeding, and statistically realistic
// behaviour. Cortexes never import from here directly — they receive
// adapters via the Adapter Registry.
// ============================================================================

export { googleAdsMock } from './GoogleAdsMock';
export { metaAdsMock } from './MetaAdsMock';
export { paymentMock, makePaymentMock } from './PaymentMock';
export { crmMock } from './CRMMock';
export { whatsappMock } from './WhatsAppMock';
export { analyticsMock } from './AnalyticsMock';
export { emailMock } from './EmailMock';
export { mapsMock } from './MapsMock';

// Statistical primitives — exported for use by the simulators.
export {
  mulberry32,
  seedFromString,
  uniform,
  gaussian,
  beta,
  logNormal,
  exponential,
  pick,
  weightedPick,
  timeOfDayLift,
  dayOfWeekLift,
  seasonalLift,
} from './_stats';
