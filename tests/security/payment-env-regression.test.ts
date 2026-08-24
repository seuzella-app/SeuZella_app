import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/env.ts', 'utf8');

describe('production payment environment contract', () => {
  it('supports only the approved production gateways', () => {
    expect(source).toContain("DEFAULT_PAYMENT_GATEWAY === 'asaas'");
    expect(source).toContain("DEFAULT_PAYMENT_GATEWAY === 'mercadopago'");
    expect(source).not.toContain("DEFAULT_PAYMENT_GATEWAY === 'stripe'");
  });

  it('requires provider webhook secrets without Stripe legacy configuration', () => {
    expect(source).toContain("requireProductionSecret('ASAAS_WEBHOOK_SECRET'");
    expect(source).toContain("requireProductionSecret('PAYMENT_WEBHOOK_SECRET'");
    expect(source).not.toContain("requireProductionSecret('STRIPE_WEBHOOK_SECRET'");
  });
});
