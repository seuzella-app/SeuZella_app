import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('checkout Mercado Pago webhook regression contracts', () => {
  const source = fs.readFileSync('src/app/api/checkout/webhook/route.ts', 'utf8');

  it('passes payment id and request id into signature verification', () => {
    expect(source).toContain('verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId)');
  });

  it('enforces a real body-size limit and invalid JSON is a client error', () => {
    expect(source).toContain("Buffer.byteLength(rawBody, 'utf8')");
    expect(source).toContain('PAYLOAD_TOO_LARGE');
    expect(source).toContain('INVALID_JSON');
  });

  it('does not expose raw provider exceptions', () => {
    expect(source).not.toContain('mpError.message');
    expect(source).toContain('PAYMENT_PROVIDER_UNAVAILABLE');
  });
});
