import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Mercado Pago service regression contracts', () => {
  const source = fs.readFileSync('src/lib/payments/mercadopago-service.ts', 'utf8');

  it('supports the canonical MP_ACCESS_TOKEN environment name', () => {
    expect(source).toContain("process.env.MP_ACCESS_TOKEN");
  });

  it('does not return raw provider errors to callers', () => {
    expect(source).not.toContain('error: err.message');
    expect(source).not.toContain('data?.message');
    expect(source).toContain('MERCADOPAGO_REQUEST_FAILED');
  });
});
