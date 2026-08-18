// ==============================================================================
// SEUZÉLLA — Payments Library Barrel Export
// ==============================================================================
// Single import surface for the rest of the app:
//   import { getDefaultGateway, getPrice, activateSubscriptionIfNotActive } from '@/lib/payments';
// ==============================================================================

export * from './types';
export * from './pricing';
export * from './idempotency';
export {
  getGateway,
  getDefaultGateway,
  listConfiguredGateways,
  getGatewayHealth,
} from './gateway-factory';

// Re-export provider classes for direct access (rare use cases)
export { MercadoPagoGateway } from './providers/mercadopago';
export { AsaasGateway } from './providers/asaas';
export { StripeGateway } from './providers/stripe';
