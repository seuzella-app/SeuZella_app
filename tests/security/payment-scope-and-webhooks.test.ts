import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('payment scope and webhook security', () => {
  it('keeps production payment scope restricted to Asaas and Mercado Pago', () => {
    const types = fs.readFileSync('src/lib/payments/types.ts', 'utf8');
    const factory = fs.readFileSync('src/lib/payments/gateway-factory.ts', 'utf8');
    expect(types).toContain("'mercadopago' | 'asaas' | 'mock'");
    expect(types).not.toContain("'stripe'");
    expect(factory).toContain("const PREFERENCE_ORDER: GatewayId[] = ['asaas', 'mercadopago'];");
    expect(factory).not.toContain('StripeGateway');
  });

  it('keeps Stripe out of active webhook routes', () => {
    expect(fs.existsSync('src/app/api/webhooks/stripe/route.ts')).toBe(false);
    expect(fs.existsSync('src/lib/payments/providers/stripe/index.ts')).toBe(false);
  });

  it('requires strong provider webhook verification', () => {
    const asaas = fs.readFileSync('src/lib/payments/providers/asaas/index.ts', 'utf8');
    const mp = fs.readFileSync('src/lib/payments/providers/mercadopago/index.ts', 'utf8');
    expect(asaas).toContain('timingSafeEqual');
    expect(mp).toContain('timingSafeEqual');
    expect(mp).toContain('id:${context.dataId};request-id:${context.requestId};ts:${ts};');
  });

  it('uses provider event IDs for idempotency', () => {
    const types = fs.readFileSync('src/lib/payments/types.ts', 'utf8');
    const idem = fs.readFileSync('src/lib/payments/idempotency.ts', 'utf8');
    expect(types).toContain('providerEventId: string');
    expect(idem).toContain('event.providerEventId || event.gatewayPaymentId');
    expect(idem).toContain('pg_advisory_xact_lock');
  });
});
