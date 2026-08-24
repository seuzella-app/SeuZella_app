import { describe, expect, it } from 'vitest';
import { getGateway } from '@/lib/payments/gateway-factory';

describe('payment gateway scope', () => {
  it('supports only the declared production gateways plus mock', () => {
    expect(getGateway('asaas').id).toBe('asaas');
    expect(getGateway('mercadopago').id).toBe('mercadopago');
    expect(getGateway('mock').id).toBe('mock');
  });

  it('keeps the checkout contract independent from provider-specific APIs', () => {
    const asaas = getGateway('asaas');
    const mercadoPago = getGateway('mercadopago');
    expect(typeof asaas.createPayment).toBe('function');
    expect(typeof mercadoPago.createPayment).toBe('function');
    expect(typeof asaas.parseWebhookEvent).toBe('function');
    expect(typeof mercadoPago.parseWebhookEvent).toBe('function');
  });
});
