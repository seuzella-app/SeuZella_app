// ==============================================================================
// SEUZÉLLA — Payments Library Barrel Export
// ==============================================================================
// Production payment scope: Asaas + Mercado Pago.
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

export { MercadoPagoGateway } from './providers/mercadopago';
export { AsaasGateway } from './providers/asaas';
