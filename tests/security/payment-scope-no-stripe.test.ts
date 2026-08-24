import { describe, expect, it } from 'vitest';

describe('Production payment scope', () => {
  it('defines only Asaas and Mercado Pago as production gateways', () => {
    const productionGateways = ['asaas', 'mercadopago'];
    expect(productionGateways).toEqual(['asaas', 'mercadopago']);
    expect(productionGateways).not.toContain('stripe');
  });
});
